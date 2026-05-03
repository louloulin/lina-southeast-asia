-- ============================================================
-- LINA 跨境电商 MVP — 初始数据库迁移
-- ============================================================
-- 执行方式: Supabase Dashboard > SQL Editor > Run
-- 或: supabase db push
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE order_status AS ENUM (
    'PENDING', 'PAID', 'PROCESSING', 'SHIPPED',
    'DELIVERED', 'CANCELLED', 'REFUNDED'
);

CREATE TYPE payment_status AS ENUM (
    'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND'
);

CREATE TYPE payment_method AS ENUM (
    'CARD', 'GRABPAY', 'GOPAY', 'OVO', 'PROMPTPAY', 'BANK_TRANSFER', 'COD'
);

CREATE TYPE source_platform AS ENUM ('ALI_1688', 'ALI_EXPRESS', 'TAOBAO');

-- ============================================================
-- 2. CURRENCY
-- ============================================================

CREATE TABLE currencies (
    code            VARCHAR(3) PRIMARY KEY,
    name            VARCHAR(50) NOT NULL,
    symbol          VARCHAR(5) NOT NULL,
    decimal_places  INT DEFAULT 2,
    is_active       BOOLEAN DEFAULT true,
    rate_to_usd     DECIMAL(18,8) DEFAULT 1.00000000,
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. LANGUAGE
-- ============================================================

CREATE TABLE languages (
    code        VARCHAR(5) PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    is_active   BOOLEAN DEFAULT true,
    is_default  BOOLEAN DEFAULT false,
    sort_order  INT DEFAULT 0
);

-- ============================================================
-- 4. COUNTRY
-- ============================================================

CREATE TABLE countries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(2) UNIQUE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    name_zh         VARCHAR(50),
    is_active       BOOLEAN DEFAULT true,
    currency_code   VARCHAR(3) REFERENCES currencies(code),
    language_codes  TEXT[],
    tax_rate        DECIMAL(5,2) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. USER
-- ============================================================

CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                 VARCHAR(255) UNIQUE NOT NULL,
    phone                 VARCHAR(20),
    name                  VARCHAR(100),
    avatar                VARCHAR(500),
    auth_provider         VARCHAR(20),
    auth_provider_id      VARCHAR(100),
    preferred_currency    VARCHAR(3) DEFAULT 'USD',
    preferred_language    VARCHAR(5) DEFAULT 'en',
    country_code          VARCHAR(2) REFERENCES countries(code),
    role                  VARCHAR(20) DEFAULT 'customer',
    is_active             BOOLEAN DEFAULT true,
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now(),
    last_login_at         TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_country ON users(country_code);

-- ============================================================
-- 6. ADDRESS
-- ============================================================

CREATE TABLE addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_name  VARCHAR(100) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    address_line1   VARCHAR(255) NOT NULL,
    address_line2   VARCHAR(255),
    city            VARCHAR(100) NOT NULL,
    state           VARCHAR(100),
    postal_code     VARCHAR(20),
    country_code    VARCHAR(2) NOT NULL REFERENCES countries(code),
    is_default      BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);

-- ============================================================
-- 7. CATEGORY
-- ============================================================

CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(255) UNIQUE NOT NULL,
    parent_id   UUID REFERENCES categories(id),
    sort_order  INT DEFAULT 0,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ============================================================
-- 8. CATEGORY_TRANSLATION
-- ============================================================

CREATE TABLE category_translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id    UUID REFERENCES categories(id) ON DELETE CASCADE,
    language_code  VARCHAR(5) REFERENCES languages(code),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    UNIQUE(category_id, language_code)
);

-- ============================================================
-- 9. PRODUCT
-- ============================================================

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       VARCHAR(100),
    source_url      TEXT,
    source_platform source_platform DEFAULT 'ALI_1688',
    slug            VARCHAR(255) UNIQUE NOT NULL,
    category_id     UUID REFERENCES categories(id),
    price_cny       DECIMAL(10,2) NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    is_featured     BOOLEAN DEFAULT false,
    stock_status    VARCHAR(20) DEFAULT 'in_stock',
    view_count      INT DEFAULT 0,
    order_count     INT DEFAULT 0,
    rating          DECIMAL(3,2),
    rating_count    INT DEFAULT 0,
    raw_attributes  JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_source ON products(source_id);

-- ============================================================
-- 10. PRODUCT_TRANSLATION
-- ============================================================

CREATE TABLE product_translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
    language_code  VARCHAR(5) REFERENCES languages(code),
    name            VARCHAR(500) NOT NULL,
    description     TEXT,
    short_desc      VARCHAR(500),
    meta_title      VARCHAR(100),
    meta_desc       VARCHAR(200),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, language_code)
);

CREATE INDEX idx_product_trans_prod ON product_translations(product_id);
CREATE INDEX idx_product_trans_lang ON product_translations(language_code);

-- ============================================================
-- 11. PRODUCT_IMAGE
-- ============================================================

CREATE TABLE product_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
    url             VARCHAR(500) NOT NULL,
    alt             VARCHAR(200),
    sort_order      INT DEFAULT 0,
    is_primary      BOOLEAN DEFAULT false,
    thumbnail_url   VARCHAR(500),
    medium_url      VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_images_prod ON product_images(product_id);

-- ============================================================
-- 12. PRODUCT_VARIANT
-- ============================================================

CREATE TABLE product_variants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
    sku             VARCHAR(100) UNIQUE NOT NULL,
    name            VARCHAR(200),
    source_sku_id   VARCHAR(100),
    price_cny       DECIMAL(10,2) NOT NULL,
    attributes      JSONB,
    stock_qty       INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_product_variants_prod ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);

-- ============================================================
-- 13. ORDER
-- ============================================================

CREATE TABLE orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number          VARCHAR(30) UNIQUE NOT NULL,
    user_id               UUID REFERENCES users(id),
    shipping_address_id   UUID REFERENCES addresses(id),
    country_code          VARCHAR(2) NOT NULL REFERENCES countries(code),
    currency_code         VARCHAR(3) NOT NULL REFERENCES currencies(code),
    subtotal              DECIMAL(12,2) NOT NULL,
    shipping_cost         DECIMAL(10,2) DEFAULT 0,
    tax_amount            DECIMAL(10,2) DEFAULT 0,
    discount_amount       DECIMAL(10,2) DEFAULT 0,
    total_amount          DECIMAL(12,2) NOT NULL,
    subtotal_usd          DECIMAL(12,2),
    total_amount_usd      DECIMAL(12,2),
    status                order_status DEFAULT 'PENDING',
    customer_note         TEXT,
    tracking_number       VARCHAR(100),
    shipping_carrier      VARCHAR(100),
    shipped_at            TIMESTAMPTZ,
    delivered_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now(),
    completed_at          TIMESTAMPTZ
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_country ON orders(country_code);

-- ============================================================
-- 14. ORDER_ITEM
-- ============================================================

CREATE TABLE order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id        UUID REFERENCES products(id),
    variant_id        UUID REFERENCES product_variants(id),
    product_snapshot  JSONB NOT NULL,
    quantity          INT NOT NULL,
    unit_price        DECIMAL(10,2) NOT NULL,
    total_price       DECIMAL(12,2) NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================================
-- 15. PAYMENT
-- ============================================================

CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            UUID UNIQUE REFERENCES orders(id),
    amount              DECIMAL(12,2) NOT NULL,
    currency_code       VARCHAR(3) NOT NULL REFERENCES currencies(code),
    amount_paid         DECIMAL(12,2),
    method              payment_method NOT NULL,
    method_name         VARCHAR(50),
    payment_intent_id   VARCHAR(100),
    third_party_ref     VARCHAR(100),
    status              payment_status DEFAULT 'PENDING',
    refunded_amount     DECIMAL(12,2),
    refund_reason       TEXT,
    refunded_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================================
-- 16. TRANSLATION
-- ============================================================

CREATE TABLE translations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       VARCHAR(100) NOT NULL,
    language_code  VARCHAR(5) REFERENCES languages(code),
    field           VARCHAR(50) NOT NULL,
    value           TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(entity_type, entity_id, language_code, field)
);

CREATE INDEX idx_translations_entity ON translations(entity_type, entity_id);
CREATE INDEX idx_translations_lang ON translations(language_code);

-- ============================================================
-- 17. CURRENCY_RATE
-- ============================================================

CREATE TABLE currency_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency   VARCHAR(3) NOT NULL,
    to_currency     VARCHAR(3) NOT NULL,
    rate            DECIMAL(18,8) NOT NULL,
    recorded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_currency_rates_lookup ON currency_rates(from_currency, to_currency, recorded_at DESC);

-- ============================================================
-- 18. CART
-- ============================================================

CREATE TABLE carts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID UNIQUE REFERENCES users(id),
    session_id      VARCHAR(100),
    country_code    VARCHAR(2) NOT NULL REFERENCES countries(code),
    currency_code   VARCHAR(3) NOT NULL REFERENCES currencies(code),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_carts_session ON carts(session_id);

CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id         UUID REFERENCES carts(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    variant_id      UUID REFERENCES product_variants(id),
    quantity        INT DEFAULT 1,
    unit_price_cny  DECIMAL(10,2) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(cart_id, product_id, variant_id)
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

-- ============================================================
-- 19. SEED DATA
-- ============================================================

INSERT INTO currencies (code, name, symbol, decimal_places, rate_to_usd) VALUES
    ('USD', 'US Dollar', '$', 2, 1.00000000),
    ('SGD', 'Singapore Dollar', 'S$', 2, 1.34000000),
    ('MYR', 'Malaysian Ringgit', 'RM', 2, 4.72000000),
    ('THB', 'Thai Baht', '฿', 2, 35.50000000),
    ('IDR', 'Indonesian Rupiah', 'Rp', 0, 15400.00000000),
    ('VND', 'Vietnamese Dong', '₫', 0, 24300.00000000),
    ('CNY', 'Chinese Yuan', '¥', 2, 7.20000000);

INSERT INTO languages (code, name, native_name, is_default, sort_order) VALUES
    ('en', 'English', 'English', true, 1),
    ('zh', 'Chinese', '中文', false, 2),
    ('ms', 'Malay', 'Bahasa Melayu', false, 3),
    ('th', 'Thai', 'ภาษาไทย', false, 4),
    ('id', 'Indonesian', 'Bahasa Indonesia', false, 5),
    ('vi', 'Vietnamese', 'Tiếng Việt', false, 6),
    ('tl', 'Filipino', 'Filipino', false, 7);

INSERT INTO countries (code, name, name_zh, currency_code, language_codes, tax_rate) VALUES
    ('SG', 'Singapore', '新加坡', 'SGD', ARRAY['en','ms','zh'], 9.00),
    ('MY', 'Malaysia', '马来西亚', 'MYR', ARRAY['en','ms','zh'], 10.00),
    ('TH', 'Thailand', '泰国', 'THB', ARRAY['en','th'], 7.00),
    ('ID', 'Indonesia', '印尼', 'IDR', ARRAY['en','id'], 11.00),
    ('PH', 'Philippines', '菲律宾', 'USD', ARRAY['en','tl'], 12.00),
    ('VN', 'Vietnam', '越南', 'VND', ARRAY['en','vi'], 10.00);

-- ============================================================
-- 20. RLS (Row Level Security)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的资料
CREATE POLICY "users_select_own" ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users FOR UPDATE
    USING (auth.uid() = id);

-- 用户只能管理自己的地址
CREATE POLICY "addresses_manage_own" ON addresses FOR ALL
    USING (user_id IN (SELECT id FROM users WHERE auth_provider_id = auth.uid()::text));

-- 用户只能查看自己的订单
CREATE POLICY "orders_view_own" ON orders FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE auth_provider_id = auth.uid()::text));

-- ============================================================
-- 21. 自动更新 updated_at 触发器
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为所有表添加触发器
CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON currencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_translations_updated_at BEFORE UPDATE ON product_translations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON translations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carts_updated_at BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 22. 生成订单号函数
-- ============================================================

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number = 'LINA-' || to_char(now(), 'YYYYMMDD') || '-' || substr(NEW.id::text, 1, 8);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();
