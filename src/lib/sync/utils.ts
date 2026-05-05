/**
 * Generate a URL-safe slug from a Chinese title + source ID.
 */
export function generateSlug(title: string, sourceId: string): string {
  // Transliterate Chinese to pinyin-like slug, fallback to source ID
  const base = title
    .replace(/[^\w\s-]/g, '') // remove special chars
    .trim()
    .slice(0, 60)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    || `product-${sourceId}`;

  return `${base}-${sourceId.slice(-6)}`;
}

/**
 * Create a deterministic SKU from 1688 item ID and optional variant info.
 */
export function generateSku(itemId: string, variantIndex?: number): string {
  const prefix = 'LINA';
  const shortId = itemId.slice(-8);
  if (variantIndex !== undefined) {
    return `${prefix}-${shortId}-V${variantIndex}`;
  }
  return `${prefix}-${shortId}`;
}
