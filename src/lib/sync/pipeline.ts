import { supabase, getSupabaseClient } from '../supabase/client';
import { prisma } from '@/lib/prisma';
import { getConversionRates, type PriceMap } from './currency';
import { batchTranslate, type TranslationResult } from './translate';
import { processImages } from './images';
import { generateSlug, generateSku } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product1688Row {
  id: string;
  item_id: string;
  title: string | null;
  price_cny: number | null;
  min_order: number | null;
  unit: string | null;
  images: string[] | null;
  category: string | null;
  category_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  raw_data: Record<string, unknown> | null;
  sync_status: string;
}

export interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// SyncState helpers
// ---------------------------------------------------------------------------

const SYNC_STATE_ID = 'sync_state';

async function upsertSyncState(data: {
  lastRunAt?: Date;
  runningSince?: Date;
  lastSuccessAt?: Date;
  lastErrorAt?: Date;
  lastError?: string | null;
}) {
  await prisma.syncState.upsert({
    where: { id: SYNC_STATE_ID },
    update: {
      ...(data.lastRunAt !== undefined ? { lastRunAt: data.lastRunAt } : {}),
      ...(data.runningSince !== undefined ? { runningSince: data.runningSince } : {}),
      ...(data.lastSuccessAt !== undefined ? { lastSuccessAt: data.lastSuccessAt } : {}),
      ...(data.lastErrorAt !== undefined ? { lastErrorAt: data.lastErrorAt } : {}),
      ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
    },
    create: {
      id: SYNC_STATE_ID,
      lastRunAt: data.lastRunAt ?? null,
      runningSince: data.runningSince ?? null,
      lastSuccessAt: data.lastSuccessAt ?? null,
      lastErrorAt: data.lastErrorAt ?? null,
      lastError: data.lastError ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Sync job tracking (Supabase sync_jobs table — LINA-31, LINA-49)
// LINA-49: syncJobs table is polled every 10 min by the cron to detect stuck/stalled jobs.
// ---------------------------------------------------------------------------

const JOB_TYPE = '1688_sync';

/**
 * Insert a new sync_jobs row with status='running'.
 * Returns the job id so we can UPDATE it when the sync finishes.
 */
async function startSyncJob(): Promise<string | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const { error } = await sb.from('sync_jobs').insert({
    id,
    job_type: JOB_TYPE,
    status: 'running',
    started_at: new Date().toISOString(),
    records_synced: 0,
  });
  if (error) {
    console.error('[sync-jobs] failed to insert job record:', error.message);
  }
  return id;
}

/**
 * Mark the sync job as completed (or failed).
 * Call this in a finally block so it always runs.
 */
async function finishSyncJob(
  jobId: string | null,
  result: SyncResult,
  error?: Error
): Promise<void> {
  if (!jobId) return;
  const sb = getSupabaseClient();
  if (!sb) return;
  const update: Record<string, unknown> = {
    status: error ? 'failed' : 'completed',
    finished_at: new Date().toISOString(),
    records_synced: result.synced,
  };
  if (error) {
    update.error_message = error.message;
  }
  const { error: updateError } = await sb
    .from('sync_jobs')
    .update(update)
    .eq('id', jobId);
  if (updateError) {
    console.error('[sync-jobs] failed to update job record:', updateError.message);
  }
}

// ---------------------------------------------------------------------------
// Main sync pipeline
// ---------------------------------------------------------------------------

/**
 * Sync 1688 products from staging table to storefront tables.
 *
 * Flow:
 * 1. Fetch pending/updated products from products_1688
 * 2. Batch translate titles & descriptions (ZH → EN/ID/TH/VN)
 * 3. Convert prices (CNY → multi-currency)
 * 4. Upsert into products + product_translations + product_images
 *
 * State tracking (SyncState table):
 * - Sets lastRunAt before starting
 * - Sets runningSince at start, clears it on success/error
 * - On success: lastSuccessAt = now
 * - On error: lastErrorAt = now, lastError = message
 *
 * Job tracking (Supabase sync_jobs table — LINA-31):
 * - INSERT row with status='running' on job start
 * - UPDATE row with status='completed' or 'failed' on finish
 */
export async function sync1688Products(
  opts: { limit?: number; itemId?: string } = {}
): Promise<SyncResult> {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  const { limit = 50, itemId } = opts;
  const errors: string[] = [];
  let synced = 0;
  let skipped = 0;

  const now = new Date();
  await upsertSyncState({ lastRunAt: now, runningSince: now });

  // LINA-31: track each run in sync_jobs (best-effort — don't fail sync if this errors)
  const jobId = await startSyncJob();
  let result: SyncResult = { total: 0, synced: 0, skipped: 0, errors: [] };
  let caughtError: Error | undefined;

  try {
    // Step 1: Fetch products from staging table
    let query = supabase
    .from('products_1688')
    .select('*')
    .eq('sync_status', 'active')
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (itemId) {
    query = supabase
      .from('products_1688')
      .select('*')
      .eq('item_id', itemId)
      .limit(1);
  }

  const { data: sourceProducts, error: fetchError } = await query;

  if (fetchError) {
    await upsertSyncState({ lastErrorAt: now, lastError: `Fetch failed: ${fetchError.message}` });
    throw new Error(`Failed to fetch products_1688: ${fetchError.message}`);
  }

  if (!sourceProducts || sourceProducts.length === 0) {
    await upsertSyncState({ lastSuccessAt: now });
    result = { total: 0, synced: 0, skipped: 0, errors: [] };
    // Don't return early — fall through to finally so finishSyncJob always runs
  }

  const products = sourceProducts as Product1688Row[];

  // Step 2: Batch translate
  const translationBatches = await batchTranslate(
    products.map(p => ({
      titleZh: p.title ?? 'Untitled Product',
      descriptionZh: (p.raw_data as Record<string, unknown>)?.description as string | null ?? null,
    }))
  );

  // Step 3: Get conversion rates
  const rates = await getConversionRates();

  // Step 4: Process each product
  for (let i = 0; i < products.length; i++) {
    const source = products[i];
    const translations = translationBatches[i];

    try {
      await syncSingleProduct(source, translations, rates);
      synced++;
    } catch (err) {
      const msg = `Product ${source.item_id}: ${err instanceof Error ? err.message : String(err)}`;
      errors.push(msg);
      console.error(msg);
      skipped++;
    }
  }

  result = { total: products.length, synced, skipped, errors };

  if (errors.length === 0) {
    await upsertSyncState({ lastSuccessAt: now, runningSince: undefined });
  } else {
    await upsertSyncState({ lastErrorAt: now, lastError: errors[0], runningSince: undefined });
  }

  return result;

  } catch (err) {
    caughtError = err instanceof Error ? err : new Error(String(err));
    await upsertSyncState({
      lastErrorAt: now,
      lastError: caughtError.message,
      runningSince: undefined,
    });
    throw caughtError;
  } finally {
    // LINA-31: always update the sync_jobs row so the health check can rely on it
    await finishSyncJob(
      jobId,
      result.total > 0 || result.synced > 0 ? result : { total: 0, synced: 0, skipped, errors },
      caughtError
    );
  }
}

// ---------------------------------------------------------------------------
// Single product sync
// ---------------------------------------------------------------------------

async function syncSingleProduct(
  source: Product1688Row,
  translations: TranslationResult[],
  _rates: PriceMap
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');

  const priceCny = source.price_cny ?? 0;
  const slug = generateSlug(source.title ?? '', source.item_id);

  // Upsert product (match on source_id for idempotent syncs)
  const { data: product, error: upsertError } = await supabase
    .from('products')
    .upsert(
      {
        source_id: source.item_id,
        source_url: `https://detail.1688.com/offer/${source.item_id}.html`,
        source_platform: '1688',
        slug,
        price_cny: priceCny,
        is_active: true,
        stock_status: 'in_stock',
        raw_attributes: (source.raw_data ?? {}) as import('@/types/supabase').Json,
      },
      { onConflict: 'source_id' }
    )
    .select('id')
    .single();

  if (upsertError || !product) {
    throw new Error(`Product upsert failed: ${upsertError?.message}`);
  }

  const productId = product.id;

  // Upsert translations (one row per language per product)
  const translationRows = translations.map(t => ({
    product_id: productId,
    language_code: t.languageCode,
    name: t.name,
    description: t.description ?? null,
    short_desc: t.name.slice(0, 200),
  }));

  const { error: transError } = await supabase
    .from('product_translations')
    .upsert(translationRows, { onConflict: 'product_id,language_code' });

  if (transError) {
    throw new Error(`Translation upsert failed: ${transError.message}`);
  }

  // Upsert images
  if (source.images && source.images.length > 0) {
    const imageData = await processImages(productId, source.images);

    if (imageData.length > 0) {
      // Delete existing and re-insert (simpler than per-URL conflict handling)
      await supabase.from('product_images').delete().eq('product_id', productId);

      const imageRows = imageData.map(img => ({
        product_id: productId,
        url: img.url,
        sort_order: img.sortOrder,
        is_primary: img.isPrimary,
      }));

      const { error: imgError } = await supabase
        .from('product_images')
        .insert(imageRows);

      if (imgError) {
        console.error(`Image insert failed for ${source.item_id}:`, imgError);
      }
    }
  }

  // Create default variant if none exists
  const { data: existingVariants } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)
    .limit(1);

  if (!existingVariants || existingVariants.length === 0) {
    const sku = generateSku(source.item_id);
    await supabase.from('product_variants').upsert(
      {
        product_id: productId,
        sku,
        name: 'Default',
        source_sku_id: source.item_id,
        price_cny: priceCny,
        stock_qty: 100, // Default stock for MVP
        is_active: true,
      },
      { onConflict: 'sku' }
    );
  }

  // Update sync timestamp on source record
  await supabase
    .from('products_1688')
    .update({ synced_at: new Date().toISOString() })
    .eq('id', source.id);

  // ---- Step 5: Sync to Prisma SQLite (local storefront DB) ----
  await syncToPrisma(productId, source, translations, _rates);
}

// ---------------------------------------------------------------------------
// Prisma SQLite sync
// ---------------------------------------------------------------------------

async function syncToPrisma(
  _supabaseProductId: string,
  source: Product1688Row,
  translations: TranslationResult[],
  rates: PriceMap
): Promise<void> {
  const priceCny = source.price_cny ?? 0;
  const slug = generateSlug(source.title ?? '', source.item_id);

  // Upsert into local Prisma SQLite (sourceId = item_id from 1688)
  const product = await prisma.product.upsert({
    where: { slug },
    update: {
      sourceId: source.item_id,
      sourceUrl: source.images?.[0] ?? null,
      sourcePlatform: 'ALI_1688',
      priceCny,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      sourceId: source.item_id,
      sourceUrl: source.images?.[0] ?? null,
      sourcePlatform: 'ALI_1688',
      slug,
      priceCny,
      isActive: true,
      isFeatured: false,
      stockStatus: 'in_stock',
      viewCount: 0,
      orderCount: 0,
      rating: null,
      ratingCount: 0,
    },
  });

  // Sync images to Prisma
  if (source.images && source.images.length > 0) {
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: source.images.map((url, idx) => ({
        productId: product.id,
        url,
        sortOrder: idx,
        isPrimary: idx === 0,
      })),
    });
  }

  // Sync translations to Prisma
  for (const t of translations) {
    await prisma.productTranslation.upsert({
      where: { productId_languageCode: { productId: product.id, languageCode: t.languageCode } },
      update: {
        name: t.name,
        description: t.description ?? null,
        shortDesc: t.name.slice(0, 200),
      },
      create: {
        productId: product.id,
        languageCode: t.languageCode,
        name: t.name,
        description: t.description ?? null,
        shortDesc: t.name.slice(0, 200),
      },
    });
  }

  // Ensure default variant exists
  const sku = generateSku(source.item_id);
  await prisma.productVariant.upsert({
    where: { sku },
    update: { priceCny, stockQty: 100 },
    create: {
      productId: product.id,
      sku,
      name: 'Default',
      sourceSkuId: source.item_id,
      priceCny,
      stockQty: 100,
      isActive: true,
    },
  });

  console.log(`[prisma-sync] ${slug} synced (Supabase→Prisma)`);
}
