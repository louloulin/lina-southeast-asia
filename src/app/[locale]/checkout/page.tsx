"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { useCartStore } from "@/stores/cart";
import { useLocaleStore } from "@/stores/locale";
import { formatPrice } from "@/lib/types";

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const items = useCartStore((s) => s.items);
  const totalPriceCents = useCartStore((s) => s.totalPriceCents());
  const clearCart = useCartStore((s) => s.clearCart);
  const currency = useLocaleStore((s) => s.currency);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleStripePay() {
    setLoading(true);
    // Simulate Stripe checkout session creation
    await new Promise((r) => setTimeout(r, 1500));
    // In production: call /api/create-checkout-session → Stripe redirect
    setSuccess(true);
    clearCart();
    setLoading(false);
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900">Order Placed!</h1>
        <p className="text-gray-500 mt-2">Thank you for your purchase. Your order is being processed.</p>
        <Link href="/" className="inline-block mt-6 bg-rose-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-rose-700">
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <p className="text-gray-500 text-lg">{t("subtotal")}</p>
        <Link href="/" className="inline-block mt-4 bg-rose-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-rose-700">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>

      {/* Order summary */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 mb-6">
        {items.map(({ product, quantity }) => (
          <div key={product.id} className="flex gap-3 items-center">
            <div className="w-12 h-12 relative bg-gray-100 rounded overflow-hidden flex-shrink-0">
              <Image src={product.image_url} alt={product.title["en"]} fill className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{product.title["en"]}</p>
              <p className="text-xs text-gray-400">Qty: {quantity}</p>
            </div>
            <span className="text-sm font-semibold">{formatPrice(product.price_cents * quantity, currency)}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex justify-between text-lg font-semibold">
          <span>{t("total")}</span>
          <span className="text-rose-600">{formatPrice(totalPriceCents, currency)}</span>
        </div>
      </div>

      {/* Stripe pay button */}
      <button
        onClick={handleStripePay}
        disabled={loading}
        className="w-full bg-rose-600 text-white py-3 rounded-lg font-medium hover:bg-rose-700 transition flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {t("processing")}
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
            </svg>
            {t("payWithStripe")}
          </>
        )}
      </button>

      <p className="text-center text-xs text-gray-400 mt-3">
        Secure checkout powered by Stripe. Your payment info is never stored on our servers.
      </p>

      <Link href="/cart" className="block text-center text-sm text-gray-500 mt-4 hover:text-gray-700">
        ← Back to Cart
      </Link>
    </div>
  );
}
