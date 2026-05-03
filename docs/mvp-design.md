# 1688 商品采集与同步系统 — MVP 设计文档

## 目标
从 1688（阿里巴巴批发平台）采集商品数据，存入 Supabase / PostgreSQL 商品库，供前端 storefront 调用。

## MVP 范围
- 手动/半自动采集商品（无需复杂爬虫）
- 商品字段：名称、价格（人民币）、图片、类目
- 数据存入 Supabase `products_1688` 表

## 数据采集方案优先级

| 优先级 | 方案 | 说明 |
|--------|------|------|
| 1 | 1688 Open API | 需申请（alibaba.cloud / 阿里巴巴开放平台） |
| 2 | 手动 CSV 导入 | 最快落地，推荐 MVP 采用 |
| 3 | 简单脚本抓取 | 使用 Puppeteer / Playwright 抓公开数据 |

**推荐路径：CSV 导入（MVP）→ 1688 Open API（规模化）**

## 数据库设计

### 表：`products_1688`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `item_id` | TEXT UNIQUE | 1688 商品 ID |
| `title` | TEXT | 商品标题 |
| `price_cny` | NUMERIC(12,2) | 人民币价格 |
| `min_order` | INTEGER | 最小起订量 |
| `unit` | TEXT | 单位（个/件/米） |
| `images` | TEXT[] | 图片 URL 数组 |
| `category` | TEXT | 商品类目 |
| `category_id` | TEXT | 1688 类目 ID |
| `supplier_id` | TEXT | 供应商 ID |
| `supplier_name` | TEXT | 供应商名称 |
| `raw_data` | JSONB | 原始页面数据（保留） |
| `sync_status` | TEXT | 同步状态（active/deleted/syncing） |
| `synced_at` | TIMESTAMPTZ | 同步时间 |
| `created_at` | TIMESTAMPTZ | 创建时间 |
| `updated_at` | TIMESTAMPTZ | 更新时间 |

### 索引
- `idx_products_1688_item_id` — item_id 查询
- `idx_products_1688_category` — 类目过滤
- `idx_products_1688_supplier` — 供应商关联
- `idx_products_1688_synced_at` — 同步时间排序

### RLS 策略
- 认证用户可读取（sync_status = 'active'）
- 导入脚本有 upsert 权限

## CSV 导入格式

```csv
item_id,title,price_cny,min_order,unit,images,category,category_id,supplier_id,supplier_name
6023456789,时尚双肩包 女士多用背包,45.50,2,个,"https://cbu01.alicdn.com/img/ibank/xxx.jpg",箱包皮具/时尚女包,200000123,sup123,深圳某某箱包厂
```

> 图片支持多张，用英文逗号分隔（逗号后接空格会被清理）

## 脚本工具链

### 1. CSV 导入脚本
- 文件：`scripts/import_csv.ts`
- 功能：读取 CSV → 清理数据 → upsert 入库
- 依赖：`@supabase/supabase-js`

### 2. 数据校验脚本
- 文件：`scripts/validate_data.ts`
- 功能：检查 price > 0、图片 URL 有效、item_id 唯一

### 3. 1688 Open API 采集（扩展）
- 申请地址：https://open.1688.com/
- API 文档：阿里巴巴开放平台 → 商品服务
- 适用场景：规模化后替代 CSV

## 交付物清单

- [x] 数据库表 `products_1688`（DDL 在 `docs/schema.sql`）
- [x] CSV 导入脚本 `scripts/import_csv.ts`
- [x] 数据校验脚本 `scripts/validate_data.ts`
- [ ] 示例数据 `data/sample_products.csv`
- [ ] Supabase 迁移执行（需项目 Token）

## 环境变量

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 后续扩展方向
- 接入 1688 Open API 实现定时同步
- 添加商品变体（SKU/规格）
- 支持多货币定价（CNY → SGD/THB）
- 商品图片自动下载到 Supabase Storage
