import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getProducts } from "@/lib/supabase/products";
import ProductCard from "@/components/ProductCard";
import type { Locale } from "@/lib/types";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ProductsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("meta");
  const products = await getProducts();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-gray-500 mt-1">{t("description")}</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "bags", "electronics", "accessories", "home"].map((cat) => (
          <span
            key={cat}
            className="text-xs px-3 py-1 rounded-full border border-gray-200 text-gray-600 capitalize"
          >
            {cat === "all" ? "All" : cat}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} locale={locale as Locale} />
        ))}
      </div>
    </div>
  );
}
