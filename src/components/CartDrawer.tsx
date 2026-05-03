"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/lib/i18n/routing";
import { useCartStore } from "@/stores/cart";
import { useLocaleStore } from "@/stores/locale";
import { formatPrice } from "@/lib/types";
import type { Locale } from "@/lib/types";

export default function CartDrawer({ locale }: { locale: Locale }) {
  const t = useTranslations("cart");
  const items = useCartStore((s) => s.items);
  const totalPriceCents = useCartStore((s) => s.totalPriceCents);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const currency = useLocaleStore((s) => s.currency);
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating cart toggle */}
      {items.length > 0 && (
        <button
          onClick={() => setOpen(!open)}
          className="fixed bottom-6 right-6 bg-rose-600 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 hover:bg-rose-700 transition z-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          <span className="font-medium">{items.reduce((s, i) => s + i.quantity, 0)}</span>
          <span>·</span>
          <span>{formatPrice(totalPriceCents(), currency)}</span>
        </button>
      )}

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">{t("title")}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="w-16 h-16 relative bg-gray-200 rounded overflow-hidden flex-shrink-0">
                    <Image src={product.image_url} alt={product.title[locale]} fill className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.title[locale]}</p>
                    <p className="text-rose-600 font-semibold text-sm mt-1">
                      {formatPrice(product.price_cents * quantity, currency)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="w-6 h-6 text-xs border rounded hover:bg-gray-100"
                      >
                        −
                      </button>
                      <span className="text-sm w-4 text-center">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="w-6 h-6 text-xs border rounded hover:bg-gray-100"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="ml-auto text-xs text-red-400 hover:text-red-600"
                      >
                        {t("remove")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t space-y-3">
              <div className="flex justify-between text-lg font-semibold">
                <span>{t("subtotal")}</span>
                <span className="text-rose-600">{formatPrice(totalPriceCents(), currency)}</span>
              </div>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="block w-full bg-rose-600 text-white text-center py-3 rounded-lg font-medium hover:bg-rose-700"
              >
                {t("proceedToCheckout")}
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="block w-full text-center text-sm text-gray-500 hover:text-gray-700"
              >
                {t("continueShopping")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
