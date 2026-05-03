"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { useCartStore } from "@/stores/cart";
import { useLocaleStore } from "@/stores/locale";
import { formatPrice } from "@/lib/types";

export default function CartPage() {
  const t = useTranslations("cart");
  const items = useCartStore((s) => s.items);
  const totalPriceCents = useCartStore((s) => s.totalPriceCents());
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const currency = useLocaleStore((s) => s.currency);

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🛒</div>
        <p className="text-gray-500 text-lg">{t("empty")}</p>
        <Link
          href="/"
          className="inline-block mt-4 bg-rose-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-rose-700"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      <div className="space-y-4">
        {items.map(({ product, quantity }) => (
          <div key={product.id} className="bg-white rounded-xl shadow-sm p-4 flex gap-4">
            <div className="w-20 h-20 relative bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              <Image src={product.image_url} alt={product.title["en"]} fill className="object-cover" />
            </div>

            <div className="flex-1 min-w-0">
              <Link href={`/products/${product.id}`} className="font-medium text-gray-900 hover:text-rose-600 text-sm">
                {product.title["en"]}
              </Link>
              <p className="text-rose-600 font-semibold mt-1">
                {formatPrice(product.price_cents, currency)}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1 border border-gray-200 rounded px-2 py-0.5">
                  <button onClick={() => updateQuantity(product.id, quantity - 1)} className="text-gray-400 hover:text-gray-700 text-sm">−</button>
                  <span className="text-sm w-6 text-center">{quantity}</span>
                  <button onClick={() => updateQuantity(product.id, quantity + 1)} className="text-gray-400 hover:text-gray-700 text-sm">+</button>
                </div>
                <button onClick={() => removeFromCart(product.id)} className="text-xs text-red-400 hover:text-red-600">
                  {t("remove")}
                </button>
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="font-semibold text-gray-900">
                {formatPrice(product.price_cents * quantity, currency)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between text-lg font-semibold mb-4">
          <span>{t("subtotal")}</span>
          <span className="text-rose-600">{formatPrice(totalPriceCents, currency)}</span>
        </div>
        <Link
          href="/checkout"
          className="block w-full bg-rose-600 text-white text-center py-3 rounded-lg font-medium hover:bg-rose-700 transition"
        >
          {t("proceedToCheckout")}
        </Link>
        <Link href="/" className="block text-center text-sm text-gray-500 mt-3 hover:text-gray-700">
          {t("continueShopping")}
        </Link>
      </div>
    </div>
  );
}
