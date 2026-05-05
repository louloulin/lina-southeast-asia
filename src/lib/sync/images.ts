import { supabase } from '../supabase';

const STORAGE_BUCKET = 'product-images';

/**
 * Process 1688 product images.
 * MVP: keep original 1688 URLs (they work).
 * Production: download to Supabase Storage for anti-hotlink protection.
 */
export async function processImages(
  productId: string,
  imageUrls: string[]
): Promise<Array<{ url: string; sortOrder: number; isPrimary: boolean }>> {
  if (!imageUrls || imageUrls.length === 0) return [];

  // MVP: store original URLs with sort order
  // TODO(LINA-9): download to Supabase Storage in production
  return imageUrls.map((url, index) => ({
    url,
    sortOrder: index,
    isPrimary: index === 0,
  }));
}

/**
 * Download an image from 1688 and upload to Supabase Storage.
 * Reserved for production use when anti-hotlinking is needed.
 */
export async function downloadAndStoreImage(
  imageUrl: string,
  productId: string,
  index: number
): Promise<string | null> {
  if (!supabase) return null;

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'Referer': 'https://www.1688.com/',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    const ext = blob.type.split('/')[1] || 'jpg';
    const path = `${productId}/${index}.${ext}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { contentType: blob.type, upsert: true });

    if (error) {
      console.error(`Failed to upload image ${path}:`, error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return publicUrl;
  } catch (err) {
    console.error(`Image download failed for ${imageUrl}:`, err);
    return null;
  }
}
