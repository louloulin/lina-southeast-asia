#!/usr/bin/env npx tsx
/**
 * 1688 商品 CSV 批量导入脚本
 *
 * 用法:
 *   npx tsx scripts/import_csv.ts data/sample_products.csv
 *   # 或
 *   npm run import -- data/sample_products.csv
 *
 * 环境变量:
 *   SUPABASE_URL  — 项目 URL
 *   SUPABASE_SERVICE_ROLE_KEY — 服务端密钥（需要写入权限）
 *
 * CSV 格式:
 *   item_id, title, price_cny, min_order, unit, images(分号分隔), category, category_id, supplier_id, supplier_name
 */

import fs from "node:fs";
import path from "node:path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------- helpers ----------

function clean(val: string): string {
  return val.replace(/^\s*["']|["']\s*$/g, "").trim();
}

function parseImages(raw: string): string[] {
  // 支持分号或逗号分隔
  return raw
    .split(/[;,]/)
    .map((s) => clean(s))
    .filter(Boolean);
}

interface ProductRow {
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
  sync_status: "active";
  synced_at: string;
}

// ---------- CSV parser (minimal, no deps) ----------

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(cell);
        cell = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++; // skip \r\n
        current.push(cell);
        cell = "";
        if (current.some((c) => c !== "")) rows.push(current);
        current = [];
      } else {
        cell += ch;
      }
    }
  }
  // last line (no trailing newline)
  current.push(cell);
  if (current.some((c) => c !== "")) rows.push(current);

  return rows;
}

// ---------- main ----------

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: npx tsx scripts/import_csv.ts <path-to-csv>");
    process.exit(1);
  }

  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment or .env file"
    );
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  const content = fs.readFileSync(absPath, "utf-8");
  const rows = parseCsvRows(content);
  if (rows.length < 2) {
    console.error("CSV is empty or has only a header row");
    process.exit(1);
  }

  const header = rows[0].map(clean);
  const expectedCols = [
    "item_id",
    "title",
    "price_cny",
    "min_order",
    "unit",
    "images",
    "category",
    "category_id",
    "supplier_id",
    "supplier_name",
  ];

  // verify header
  for (const col of expectedCols) {
    if (!header.includes(col)) {
      console.error(`Missing required column: ${col}`);
      console.error(`Found columns: ${header.join(", ")}`);
      process.exit(1);
    }
  }

  const idx = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>;

  const dataRows: ProductRow[] = [];
  const parseErrors: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < header.length) continue; // skip incomplete rows

    const item_id = clean(row[idx["item_id"]]);
    if (!item_id) {
      parseErrors.push(`Row ${r + 1}: empty item_id — skipped`);
      continue;
    }

    const priceRaw = clean(row[idx["price_cny"]]);
    const price_cny = priceRaw ? parseFloat(priceRaw) : null;
    if (price_cny !== null && (isNaN(price_cny) || price_cny < 0)) {
      parseErrors.push(`Row ${r + 1} (${item_id}): invalid price "${priceRaw}"`);
      continue;
    }

    const minOrderRaw = clean(row[idx["min_order"]]);
    const min_order = minOrderRaw ? parseInt(minOrderRaw, 10) : null;

    dataRows.push({
      item_id,
      title: clean(row[idx["title"]]) || null,
      price_cny,
      min_order: (min_order !== null && !isNaN(min_order)) ? min_order : null,
      unit: clean(row[idx["unit"]]) || null,
      images: parseImages(row[idx["images"]] || ""),
      category: clean(row[idx["category"]]) || null,
      category_id: clean(row[idx["category_id"]]) || null,
      supplier_id: clean(row[idx["supplier_id"]]) || null,
      supplier_name: clean(row[idx["supplier_name"]]) || null,
      sync_status: "active",
      synced_at: new Date().toISOString(),
    } as unknown as ProductRow);
  }

  if (parseErrors.length > 0) {
    console.warn(`\nParse warnings:`);
    parseErrors.forEach((e) => console.warn(`  ${e}`));
  }

  console.log(`\nParsed ${dataRows.length} products from CSV.`);

  if (dataRows.length === 0) {
    console.warn("No valid rows to import.");
    process.exit(0);
  }

  // batch upsert (Supabase limit ~200 rows per request)
  const BATCH_SIZE = 200;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
    const batch = dataRows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from("products_1688")
      .upsert(batch, { onConflict: "item_id", count: "exact" });

    if (error) {
      errors += batch.length;
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
    } else {
      inserted += count ?? batch.length;
      console.log(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted ${count ?? batch.length} rows`
      );
    }
  }

  console.log(`\nDone. Upserted: ${inserted}, Errors: ${errors}`);
  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
