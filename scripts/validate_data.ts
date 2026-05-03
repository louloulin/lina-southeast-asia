#!/usr/bin/env npx tsx
/**
 * 1688 商品数据校验脚本
 *
 * 用法:
 *   npx tsx scripts/validate_data.ts
 *
 * 读取 Supabase 中 products_1688 表，执行数据质量检查。
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface ValidationIssue {
  id: string;
  item_id: string;
  field: string;
  message: string;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

  const { data: products, error } = await supabase
    .from("products_1688")
    .select("*");

  if (error) {
    console.error("Failed to query products:", error.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log("No products found in products_1688 table.");
    process.exit(0);
  }

  console.log(`Checking ${products.length} products...\n`);

  const issues: ValidationIssue[] = [];

  for (const p of products) {
    const id = p.id as string;
    const item_id = p.item_id as string;

    // 1. price > 0
    if (p.price_cny == null || p.price_cny <= 0) {
      issues.push({
        id,
        item_id,
        field: "price_cny",
        message: `Invalid price: ${p.price_cny}`,
      });
    }

    // 2. title not empty
    if (!p.title || p.title.trim().length === 0) {
      issues.push({
        id,
        item_id,
        field: "title",
        message: "Empty title",
      });
    }

    // 3. images array not empty
    if (!Array.isArray(p.images) || p.images.length === 0) {
      issues.push({
        id,
        item_id,
        field: "images",
        message: "No images",
      });
    }

    // 4. category not empty
    if (!p.category || p.category.trim().length === 0) {
      issues.push({
        id,
        item_id,
        field: "category",
        message: "Missing category",
      });
    }
  }

  if (issues.length === 0) {
    console.log("All products pass validation.");
  } else {
    console.warn(`Found ${issues.length} data quality issues:\n`);
    for (const issue of issues) {
      console.warn(
        `  [${issue.item_id}] ${issue.field}: ${issue.message}`
      );
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
