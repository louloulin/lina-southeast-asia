import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/types";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="min-h-screen bg-gray-50">
        <Header locale={locale as Locale} />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-sm text-gray-400 py-6">
          {(() => {
            const t = (messages as Record<string, Record<string, unknown>>)["footer"];
            return (t as Record<string, string>)?.poweredBy;
          })()}
        </footer>
        <CartDrawer locale={locale as Locale} />
      </div>
    </NextIntlClientProvider>
  );
}
