import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale, Currency } from "@/lib/types";
import { DEFAULT_LOCALE, DEFAULT_CURRENCY, getLocaleCurrency } from "@/lib/types";

interface LocaleStore {
  locale: Locale;
  currency: Currency;
  setLocale: (locale: Locale) => void;
  setCurrency: (currency: Currency) => void;
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      currency: DEFAULT_CURRENCY,
      setLocale: (locale) =>
        set({ locale, currency: getLocaleCurrency(locale) }),
      setCurrency: (currency) => set({ currency }),
    }),
    { name: "lina-locale" }
  )
);
