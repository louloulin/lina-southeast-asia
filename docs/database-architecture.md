# LINA 跨境电商 MVP — 数据库架构设计文档

> **版本**: v1.0
> **日期**: 2026-05-03
> **作者**: CTO Agent
> **状态**: ✅ 完成

---

## 1. 架构概览

### 1.1 设计目标

| 目标 | 说明 |
|------|------|
| 多币种结算 | 支持 USD, SGD, MYR, THB, IDR, VND 等6种货币实时结算 |
| 东南亚多语言 | 支持英/中/马来/泰/印尼/越南/菲律宾7种语言 |
| 多国家扩展 | Country 模型独立配置，未来新增国家零代码改动 |
| 财务合规 | 所有订单同时记录当地货币和 USD 等值 |

### 1.2 实体关系（简化）

```
User ─────< Order ─────< OrderItem ─────> Product
  │                            │
  └──── Address                └──── ProductVariant
          │
Payment ──┘
```

---

## 2. 核心表设计

### 2.1 核心6表（按需求）

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户/买家 | email, preferred_currency, preferred_language, country_code |
| `products` | 商品（来源1688） | source_id, price_cny, slug, stock_status |
| `orders` | 订单 | total_amount, subtotal_usd, status, country_code |
| `payments` | 支付记录 | amount, method, status |
| `currencies` | 货币配置 | code, rate_to_usd, decimal_places |
| `translations` | 多语言翻译 | entity_type, entity_id, language_code, value |

### 2.2 扩展支持表

| 表名 | 说明 |
|------|------|
| `countries` | 国家配置（货币、语言、税率） |
| `languages` | 语言配置 |
| `addresses` | 收货地址 |
| `product_translations` | 商品多语言（结构化） |
| `product_variants` | SKU变体（颜色、尺寸） |
| `product_images` | 商品图片 |
| `categories` / `category_translations` | 分类 |
| `currency_rates` | 汇率历史 |
| `carts` / `cart_items` | 购物车 |

---

## 3. 多币种结算方案

### 3.1 双轨价格记录

```
所有订单同时记录：
├── 当地货币金额（subtotal, total_amount）
└── USD 等值（subtotal_usd, total_amount_usd）
```

### 3.2 货币初始化数据

```sql
INSERT INTO currencies VALUES
    ('USD', 'US Dollar', '$',  2, 1.00000000),
    ('SGD', 'Singapore Dollar', 'S$', 2, 1.34000000),
    ('MYR', 'Malaysian Ringgit', 'RM', 2, 4.72000000),
    ('THB', 'Thai Baht', '฿', 2, 35.50000000),
    ('IDR', 'Indonesian Rupiah', 'Rp', 0, 15400.00000000),
    ('VND', 'Vietnamese Dong', '₫', 0, 24300.00000000);
```

---

## 4. 东南亚多语言方案

### 4.1 支持语言

| 代码 | 语言 | 母语名称 |
|------|------|----------|
| en | English | English |
| zh | Chinese | 中文 |
| ms | Malay | Bahasa Melayu |
| th | Thai | ภาษาไทย |
| id | Indonesian | Bahasa Indonesia |
| vi | Vietnamese | Tiếng Việt |
| tl | Filipino | Filipino |

### 4.2 翻译回退逻辑（应用层）

```
1. 用户语言 → 翻译存在？
   → 是：返回翻译
   → 否：fallback 到英文
2. 英文存在？
   → 是：返回英文
   → 否：返回中文（原始1688语言）
```

### 4.3 Country 配置

```sql
INSERT INTO countries VALUES
    ('SG', 'Singapore', '新加坡', 'SGD', ARRAY['en','ms','zh'], 9.00),
    ('MY', 'Malaysia', '马来西亚', 'MYR', ARRAY['en','ms','zh'], 10.00),
    ('TH', 'Thailand', '泰国', 'THB', ARRAY['en','th'], 7.00),
    ('ID', 'Indonesia', '印尼', 'IDR', ARRAY['en','id'], 11.00),
    ('PH', 'Philippines', '菲律宾', 'USD', ARRAY['en','tl'], 12.00),
    ('VN', 'Vietnam', '越南', 'VND', ARRAY['en','vi'], 10.00);
```

---

## 5. 扩展性设计

### 5.1 新增国家

只需在 `Country` 表添加记录，无需代码改动：

```sql
INSERT INTO countries (code, name, name_zh, currency_code, language_codes, tax_rate)
VALUES ('KH', 'Cambodia', '柬埔寨', 'USD', ARRAY['en','km'], 10.00);
```

### 5.2 新增支付渠道

扩展 `PaymentMethod` 枚举：

```prisma
enum PaymentMethod {
  CARD
  GRABPAY
  // 新增：BOOST (马来西亚)
  // 新增：LINE_PAY (泰国)
  // ...
}
```

### 5.3 未来扩展预留

| 需求 | 预留方式 |
|------|----------|
| 优惠券 | `Order.discount_amount` 已预留，可扩展 Coupon 表 |
| 卖家系统 | `User.role` 支持 seller 角色 |
| 商品属性 | `Product.raw_attributes` (JSONB) 灵活存储 |
| 物流追踪 | `Order.tracking_number`, `shipping_carrier` 已支持 |

---

## 6. 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 数据库 | PostgreSQL | Supabase 原生支持，JSONB/数组类型 |
| ORM | Prisma | 类型安全，迁移管理，TS 一等公民 |
| 认证 | Supabase Auth | 内置 RLS + OAuth |
| 存储 | Supabase Storage | 商品图片 CDN |
| 边缘函数 | Supabase Edge Functions | 汇率更新、库存检查 |

---

## 7. 下一步行动

- [ ] **LINA-4** — 创建 Supabase 项目并执行 `001_init_sea_ecommerce.sql`
- [ ] **LINA-5** — 安装 Prisma Client 并验证连接
- [ ] **LINA-6** — 实现 1688 商品数据导入管道

---

**文档历史：**
- v1.0 (2026-05-03) — 初始架构设计，覆盖6大核心实体
