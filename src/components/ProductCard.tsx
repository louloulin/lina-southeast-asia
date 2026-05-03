"use client";

import { useState } from "react";
import Image from "next/image";
import { Link } from "@/lib/i18n/routing";
import { useCartStore } from "@/stores/cart";
import { useLocaleStore } from "@/stores/locale";
import { formatPrice } from "@/lib/types";
import type { Product, Locale } from "@/lib/types";

export default function ProductCard({ product, locale }: { product: Product; locale: Locale }) {
  const [added, setAdded] = useState(false);
  const addToCart = useCartStore((s) => s.addToCart);
  const currency = useLocaleStore((s) => s.currency);

  function handleAdd() {
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden flex flex-col">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative w-full pt-[100%] bg-gray-100">
          <Image
            src={product.image_url}
            alt={product.title[locale]}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <Link href={`/products/${product.id}`} className="block">
          <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 hover:text-rose-600">
            {product.title[locale]}
          </h3>
        </Link>

        <p className="text-xs text-gray-400 mt-1 capitalize">{product.category}</p>

        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="text-rose-600 font-bold text-lg">
            {formatPrice(product.price_cents, currency)}
          </span>

          <button
            onClick={handleAdd}
            disabled={product.stock === 0}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${
              added
                ? "bg-green-100 text-green-700"
                : product.stock === 0
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-rose-600 text-white hover:bg-rose-700"
            }`}
          >
            {added ? "✓" : product.stock === 0 ? "—" : "+"}
          </button>
        </div>
      </div>
    </div>
  );
}
