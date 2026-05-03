import { supabase, isSupabaseConfigured } from "./client";
import type { Product, Locale } from "@/lib/types";

// Fallback seed products when Supabase isn't configured
export const SEED_PRODUCTS: Product[] = [
  {
    id: "1",
    title: { en: "Crossbody Bag", id: "Tas Selempang", th: "กระเป๋าสะพายข้าง", vi: "Túi đeo chéo" },
    description: {
      en: "Lightweight crossbody bag, perfect for daily use. Water-resistant nylon.",
      id: "Tas selempang ringan, cocok untuk penggunaan sehari-hari. Tahan air.",
      th: "กระเป๋าสะพายข้างเบา เหมาะกับการใช้งานทุกวัน กันน้ำ",
      vi: "Túi đeo chéo nhẹ, hoàn hảo cho sử dụng hàng ngày. Chống nước.",
    },
    price_cents: 1990,
    currency: "SGD",
    image_url: "https://picsum.photos/seed/bag/400/400",
    category: "bags",
    stock: 50,
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "2",
    title: { en: "Wireless Earbuds", id: "Earbud Nirkabel", th: "หูฟังไร้สาย", vi: "Tai nghe không dây" },
    description: {
      en: "Bluetooth 5.3 earbuds with active noise cancellation. 30hr battery.",
      id: "Earbud Bluetooth 5.3 dengan peredam baterai aktif. 30 jam.",
      th: "หูฟัง Bluetooth 5.3 พร้อมตัดเสียงรบกวน แบต 30 ชม.",
      vi: "Tai nghe Bluetooth 5.3 với chống ồn chủ động. Pin 30 giờ.",
    },
    price_cents: 3990,
    currency: "SGD",
    image_url: "https://picsum.photos/seed/earbuds/400/400",
    category: "electronics",
    stock: 120,
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "3",
    title: { en: "Silk Scarf", id: "Sutera Syal", th: "ผ้าพันคอไหม", vi: "Khăn lụa" },
    description: {
      en: "Hand-printed silk scarf. 90x90cm. Vibrant colors that don't fade.",
      id: "Syal sutera cetak tangan. 90x90cm. Warna cerah tidak pudar.",
      th: "ผ้าพันคอไหมพิมพ์ลายมือ 90x90 ซม. สีสดไม่ซีด",
      vi: "Khăn lụa in tay. 90x90cm. Màu sắc tươi sáng, không phai.",
    },
    price_cents: 4500,
    currency: "SGD",
    image_url: "https://picsum.photos/seed/scarf/400/400",
    category: "accessories",
    stock: 30,
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "4",
    title: { en: "LED Desk Lamp", id: "Lampu Meja LED", th: "โคมไฟ LED", vi: "Đèn LED bàn" },
    description: {
      en: "Adjustable LED desk lamp with 3 color temperatures and USB-C charging port.",
      id: "Lampu meja LED dengan 3 suhu warna dan port pengisian USB-C.",
      th: "โคมไฟ LED ปรับได้ 3 อุณหภูมิสี พร้อมพอร์ตชาร์จ USB-C",
      vi: "Đèn LED bàn điều chỉnh được 3 nhiệt độ màu với cổng sạc USB-C.",
    },
    price_cents: 2900,
    currency: "SGD",
    image_url: "https://picsum.photos/seed/lamp/400/400",
    category: "home",
    stock: 75,
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "5",
    title: { en: "Phone Ring Holder", id: "Ring Holder HP", th: "ตัวจับแหวนโทรศัพท์", vi: "Giá đỡ nhẫn điện thoại" },
    description: {
      en: "360° rotating phone ring holder. Strong adhesive. Works with any phone.",
      id: "Ring holder HP putar 360°. Perekat kuat. Cocok untuk semua HP.",
      th: "ตัวจับแหวนหมุน 360° กาวแน่น ใช้ได้ทุกรุ่น",
      vi: "Giá đỡ nhẫn xoay 360°. Keo dán chắc. Phù hợp mọi điện thoại.",
    },
    price_cents: 590,
    currency: "SGD",
    image_url: "https://picsum.photos/seed/ring/400/400",
    category: "accessories",
    stock: 200,
    created_at: "2026-05-01T00:00:00Z",
  },
  {
    id: "6",
    title: { en: "Bamboo Cutting Board", id: "Talenan Bambu", th: "เขียงไม้ไผ่", vi: "Thớt tre" },
    description: {
      en: "Sustainable bamboo cutting board with juice groove. 35x25cm.",
      id: "Talenan bambu berkelanjutan dengan alur jus. 35x25cm.",
      th: "เขียงไม้ไผ่ยั่งยืนพร้อมร่องน้ำผลไม้ 35x25 ซม.",
      vi: "Thớt tre bền vững với rãnh nước trái cây. 35x25cm.",
    },
    price_cents: 1800,
    currency: "SGD",
    image_url: "https://picsum.photos/seed/board/400/400",
    category: "home",
    stock: 60,
    created_at: "2026-05-01T00:00:00Z",
  },
];

export async function getProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return SEED_PRODUCTS;
  }
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data?.length) return SEED_PRODUCTS;
  return data as Product[];
}

export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return SEED_PRODUCTS.find((p) => p.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return SEED_PRODUCTS.find((p) => p.id === id) ?? null;
  return data as Product;
}
