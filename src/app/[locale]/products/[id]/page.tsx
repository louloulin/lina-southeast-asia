"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { useCartStore } from "@/stores/cart";
import { useLocaleStore } from "@/stores/locale";
import { formatPrice } from "@/lib/types";
import { SEED_PRODUCTS } from "@/lib/supabase/products";
import type { Locale, Product } from "@/lib/types";
import { useParams } from "next/navigation";

export default function ProductDetailPage() {
  const t = useTranslations("product");
  const params = useParams<{ locale: string; id: string }>();
  const locale = params.locale;
  const id = params.id;
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const addToCart = useCartStore((s) => s.addToCart);
  const currency = useLocaleStore((s) => s.currency);

  const found = SEED_PRODUCTS.find((p) => p.id === id);

  if (!found) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Product not found.</p>
        <Link href="/" className="text-rose-600 mt-2 inline-block">{t("backToProducts")}</Link>
      </div>
    );
  }

  const product: Product = found;

  function handleAdd() {
    for (let i = 0; i < quantity; i++) addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/" className="text-sm text-gray-500 hover:text-rose-600 mb-6 inline-flex items-center gap-1">
        ← {t("backToProducts")}
      </Link>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="relative pt-[100%] bg-gray-100 rounded-xl overflow-hidden">
          <Image
            src={product.image_url}
            alt={product.title[locale as Locale]}
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="flex flex-col">
          <span className="text-xs text-gray-400 uppercase tracking-wide capitalize">{product.category}</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">{product.title[locale as Locale]}</h1>
          <p className="text-3xl font-bold text-rose-600 mt-4">
            {formatPrice(product.price_cents, currency)}
          </p>
          <p className="text-gray-600 mt-4 text-sm leading-relaxed">
            {product.description[locale as Locale]}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {t("inStock", { count: product.stock })}
          </p>

          {product.stock > 0 ? (
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="text-gray-400 hover:text-gray-700 text-lg">−</button>
                <span className="text-sm w-8 text-center font-medium">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="text-gray-400 hover:text-gray-700 text-lg">+</button>
              </div>
              <button
                onClick={handleAdd}
                className={`flex-1 py-3 rounded-lg font-medium transition ${added ? "bg-green-100 text-green-700" : "bg-rose-600 text-white hover:bg-rose-700"}`}
              >
                {added ? `✓ ${t("addedToCart")}` : t("addToCart")}
              </button>
            </div>
          ) : (
            <div className="mt-6 bg-gray-100 text-gray-400 py-3 text-center rounded-lg font-medium">
              {t("outOfStock")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
