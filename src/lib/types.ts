export type Locale = "en" | "id" | "th" | "vi";
export type Currency = "SGD" | "IDR" | "THB" | "VND" | "PHP";

export interface Product {
  id: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  price_cents: number; // base price in SGD cents
  currency: Currency;
  image_url: string;
  category: string;
  stock: number;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export const CURRENCIES: Record<Currency, { symbol: string; rate: number; locale: string }> = {
  SGD: { symbol: "S$", rate: 1, locale: "en-SG" },
  IDR: { symbol: "Rp", rate: 11800, locale: "id-ID" },
  THB: { symbol: "฿", rate: 26, locale: "th-TH" },
  VND: { symbol: "₫", rate: 19500, locale: "vi-VN" },
  PHP: { symbol: "₱", rate: 42, locale: "en-PH" },
};

export const LOCALES: Locale[] = ["en", "id", "th", "vi"];
export const DEFAULT_LOCALE: Locale = "en";
export const DEFAULT_CURRENCY: Currency = "SGD";

export function getLocaleCurrency(locale: Locale): Currency {
  const map: Record<Locale, Currency> = {
    en: "SGD",
    id: "IDR",
    th: "THB",
    vi: "VND",
  };
  return map[locale];
}

export function formatPrice(sgdCents: number, currency: Currency): string {
  const { symbol, rate, locale } = CURRENCIES[currency];
  const amount = (sgdCents / 100) * rate;
  return `${symbol}${new Intl.NumberFormat(locale, { maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(amount)}`;
}
