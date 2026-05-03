"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/lib/i18n/routing";
import { useCartStore } from "@/stores/cart";
import { useLocaleStore } from "@/stores/locale";
import type { Locale } from "@/lib/types";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  id: "ID",
  th: "TH",
  vi: "VI",
};

export default function Header({ locale }: { locale: Locale }) {
  const t = useTranslations("nav");
  const totalItems = useCartStore((s) => s.totalItems());
  const { currency, setLocale, setCurrency } = useLocaleStore();
  const [cartOpen, setCartOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleChange(newLocale: Locale) {
    setLocale(newLocale);
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-rose-600">
          LINA
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-gray-700 hover:text-rose-600">
            {t("products")}
          </Link>
          <Link href="/cart" className="text-sm font-medium text-gray-700 hover:text-rose-600">
            {t("cart")}
          </Link>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Currency */}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof currency)}
            className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
          >
            <option value="SGD">SGD</option>
            <option value="IDR">IDR</option>
            <option value="THB">THB</option>
            <option value="VND">VND</option>
            <option value="PHP">PHP</option>
          </select>

          {/* Language */}
          <div className="flex gap-1">
            {(["en", "id", "th", "vi"] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLocaleChange(l)}
                className={`text-xs px-2 py-1 rounded border ${
                  locale === l
                    ? "bg-rose-600 text-white border-rose-600"
                    : "border-gray-200 text-gray-600 hover:border-rose-300"
                }`}
              >
                {LOCALE_LABELS[l]}
              </button>
            ))}
          </div>

          {/* Cart button */}
          <Link
            href="/cart"
            className="relative flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-rose-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
