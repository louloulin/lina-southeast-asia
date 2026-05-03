-- 1688商品主表（MVP）
CREATE TABLE IF NOT EXISTS public.products_1688 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 1688原生字段
  item_id      TEXT    UNIQUE NOT NULL,
  title       TEXT,
  price_cny   NUMERIC(12,2),
  min_order   INTEGER,
  unit        TEXT,

  -- 图片
  images      TEXT[],

  -- 类目
  category    TEXT,
  category_id TEXT,

  -- 供应商
  supplier_id   TEXT,
  supplier_name TEXT,

  -- 原始数据
  raw_data    JSONB,

  -- 同步状态
  sync_status TEXT  DEFAULT 'active' CHECK (sync_status IN ('active','deleted','syncing')),
  synced_at   TIMESTAMPTZ DEFAULT now(),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.products_1688 IS '1688商品采集表（MVP版）';

CREATE INDEX IF NOT EXISTS idx_products_1688_item_id   ON public.products_1688(item_id);
CREATE INDEX IF NOT EXISTS idx_products_1688_category   ON public.products_1688(category);
CREATE INDEX IF NOT EXISTS idx_products_1688_supplier   ON public.products_1688(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_1688_synced_at ON public.products_1688(synced_at DESC);

ALTER TABLE public.products_1688 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_products_1688"
  ON public.products_1688 FOR SELECT
  TO authenticated
  USING (sync_status = 'active');

CREATE POLICY "service_insert_update_products_1688"
  ON public.products_1688 FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "service_update_products_1688"
  ON public.products_1688 FOR UPDATE
  TO authenticated
  USING (true);
