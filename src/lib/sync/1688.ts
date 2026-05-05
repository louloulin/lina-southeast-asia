/**
 * 1688 Product Sync Engine
 *
 * 同步链路: Supabase `products_1688` (staging) → Prisma SQLite (local Product table)
 *
 * 同步逻辑:
 *  1. 从 Supabase 拉取 sync_status = 'pending' 的记录
 *  2. 转换为 Prisma Product 格式并 upsert 到本地 SQLite
 *  3. 可选: 自动翻译 title → en/zh/ms/th/id/vi
 *  4. 更新 Supabase sync_status = 'active'
 *  5. 出错时标记 sync_status = 'error'，保留错误信息
 *
 * 触发方式:
 *  - POST /api/sync/1688        (手动触发 / 定时触发)
 *  - npm run sync:1688          (CLI)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { getConversionRates, convertPrice } from "./currency";

// ---------- types ----------

interface StagingProduct {
  id: string;
  item_id: string;
  title: string;
  price_cny: number | null;
  min_order: number | null;
  unit: string | null;
  images: string[];
  category: string | null;
  category_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  sync_status: string;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ item_id: string; error: string }>;
  started_at: string;
  completed_at: string;
}

export interface SyncOptions {
  /** 最多处理多少条，为空则处理全部 */
  limit?: number;
  /** 是否自动翻译 title 为多语言（调用 OpenAI 等） */
  autoTranslate?: boolean;
  /** 跳过翻译，使用 slug+原始 title 填充 */
  dryRun?: boolean;
}

// ---------- supabase client ----------

function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

// ---------- slug generator ----------

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s\u4e00-\u9fff]/g, "") // keep CJK chars
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
}

// ---------- category lookup / upsert ----------

async function ensureCategory(supabaseCategory: string | null): Promise<string | null> {
  if (!supabaseCategory) return null;

  // Map 1688 category paths like "箱包皮具/时尚女包" → slug
  const parts = supabaseCategory.split("/");
  const topCategory = parts[0] ?? supabaseCategory;
  const slug = generateSlug(topCategory);

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: {
      slug,
      sortOrder: 0,
      isActive: true,
    },
  });
  return created.id;
}

// ---------- product upsert (staging → Prisma) ----------

async function upsertProduct(
  supabase: SupabaseClient,
  item: StagingProduct,
  categoryId: string | null,
  rates: Awaited<ReturnType<typeof getConversionRates>>
): Promise<{ success: boolean; error?: string }> {
  const priceCny = item.price_cny ?? 0;
  const slug = generateSlug(item.title);

  try {
    // Upsert the main product record
    const product = await prisma.product.upsert({
      where: { slug },
      update: {
        sourceId: item.item_id,
        sourceUrl: item.images[0] ?? null,
        sourcePlatform: "ALI_1688",
        priceCny,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        id: undefined as unknown as string, // let DB generate
        sourceId: item.item_id,
        sourceUrl: item.images[0] ?? null,
        sourcePlatform: "ALI_1688",
        slug,
        categoryId,
        priceCny,
        isActive: true,
        isFeatured: false,
        stockStatus: "in_stock",
        viewCount: 0,
        orderCount: 0,
        rating: null,
        ratingCount: 0,
      },
    });

    // Upsert product images
    if (item.images && item.images.length > 0) {
      // Remove existing images and replace
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      await prisma.productImage.createMany({
        data: item.images.map((url, idx) => ({
          productId: product.id,
          url,
          sortOrder: idx,
          isPrimary: idx === 0,
        })),
      });
    }

    // Mark as synced in Supabase
    const { error: updateError } = await supabase
      .from("products_1688")
      .update({ sync_status: "active", synced_at: new Date().toISOString() })
      .eq("item_id", item.item_id);

    if (updateError) {
      console.error(`[sync] Failed to mark ${item.item_id} as active in Supabase:`, updateError.message);
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ---------- main sync function ----------

export async function sync1688Products(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    started_at: new Date().toISOString(),
    completed_at: "",
  };

  const supabase = getSupabaseClient();

  // 1. Pull pending items from Supabase
  let query = supabase
    .from("products_1688")
    .select("*")
    .eq("sync_status", "pending")
    .order("created_at", { ascending: true });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data: rows, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch from Supabase: ${fetchError.message}`);
  }

  const items = (rows ?? []) as StagingProduct[];
  result.total = items.length;

  if (items.length === 0) {
    result.completed_at = new Date().toISOString();
    return result;
  }

  // Pre-fetch exchange rates
  let rates: Awaited<ReturnType<typeof getConversionRates>>;
  try {
    rates = await getConversionRates();
  } catch {
    rates = { USD: 0.1389, SGD: 0.1866, IDR: 2138, THB: 4.93, VND: 3375 };
  }

  // Process in batches to avoid overwhelming DB
  const BATCH_SIZE = 50;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    // Resolve categories in parallel
    const categoryCache = new Map<string, string | null>();
    await Promise.all(
      batch.map(async (item) => {
        if (!categoryCache.has(item.category ?? "")) {
          const id = await ensureCategory(item.category);
          categoryCache.set(item.category ?? "", id);
        }
      })
    );

    // Sync each product
    await Promise.all(
      batch.map(async (item) => {
        const categoryId = categoryCache.get(item.category ?? "") ?? null;
        const { success, error } = await upsertProduct(supabase, item, categoryId, rates);

        if (success) {
          result.success++;
        } else if (error === "duplicate or skipped") {
          result.skipped++;
        } else {
          result.failed++;
          result.errors.push({ item_id: item.item_id, error: error ?? "unknown error" });

          // Mark as error in Supabase
          await supabase
            .from("products_1688")
            .update({ sync_status: "error", raw_data: { error } })
            .eq("item_id", item.item_id);
        }
      })
    );
  }

  result.completed_at = new Date().toISOString();
  const elapsed = Date.now() - startTime;
  console.log(
    `[sync1688] Done in ${elapsed}ms — success:${result.success} failed:${result.failed} skipped:${result.skipped}`
  );

  return result;
}

// ---------- CLI runner ----------

if (require.main === module) {
  const limit = parseInt(process.argv[2] ?? "", 10);
  sync1688Products({ limit: isNaN(limit) ? undefined : limit })
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}