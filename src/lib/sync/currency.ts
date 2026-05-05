import { supabase } from '../supabase';

export interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
}

const TARGET_CURRENCIES = ['USD', 'SGD', 'IDR', 'THB', 'VND'] as const;
export type TargetCurrency = typeof TARGET_CURRENCIES[number];

/** Hardcoded rates as last-resort fallback */
function getDefaultRates(): PriceMap {
  return {
    USD: 0.1389,
    SGD: 0.1866,
    IDR: 2138,
    THB: 4.93,
    VND: 3375,
  };
}

export type PriceMap = Record<TargetCurrency, number>;

/**
 * Fetch the latest CNY→target rates from the currency_rates table.
 * Falls back to the static rates in the currencies table if no rates exist.
 */
export async function getConversionRates(): Promise<PriceMap> {
  if (!supabase) return getDefaultRates();

  // Try currency_rates table first
  const { data: rates } = await supabase
    .from('currency_rates')
    .select('to_currency, rate')
    .eq('from_currency', 'CNY')
    .order('recorded_at', { ascending: false });

  const rateMap: Partial<Record<TargetCurrency, number>> = {};

  if (rates && rates.length > 0) {
    for (const r of rates) {
      if (TARGET_CURRENCIES.includes(r.to_currency as TargetCurrency) && !rateMap[r.to_currency as TargetCurrency]) {
        rateMap[r.to_currency as TargetCurrency] = Number(r.rate);
      }
    }
  }

  // Fill missing from currencies table (rate_to_usd)
  if (Object.keys(rateMap).length < TARGET_CURRENCIES.length) {
    const { data: currencies } = await supabase
      .from('currencies')
      .select('code, rate_to_usd')
      .in('code', ['CNY', ...TARGET_CURRENCIES]);

    if (currencies) {
      const cnyToUsd = currencies.find(c => c.code === 'CNY')?.rate_to_usd ?? 7.2;
      for (const cur of TARGET_CURRENCIES) {
        if (rateMap[cur]) continue;
        const targetToUsd = currencies.find(c => c.code === cur)?.rate_to_usd ?? 1;
        // CNY → USD → target: (1/CNY_to_USD) * target_to_USD
        rateMap[cur] = (1 / Number(cnyToUsd)) * Number(targetToUsd);
      }
    }
  }

  // Ensure all keys present
  return {
    USD: rateMap.USD ?? 0.1389,
    SGD: rateMap.SGD ?? 0.1866,
    IDR: rateMap.IDR ?? 2138,
    THB: rateMap.THB ?? 4.93,
    VND: rateMap.VND ?? 3375,
  };
}

/**
 * Convert CNY price to all target currencies.
 */
export function convertPrice(priceCny: number, rates: PriceMap): PriceMap {
  return {
    USD: roundTo(priceCny * rates.USD, 2),
    SGD: roundTo(priceCny * rates.SGD, 2),
    IDR: roundTo(priceCny * rates.IDR, 0),
    THB: roundTo(priceCny * rates.THB, 2),
    VND: roundTo(priceCny * rates.VND, 0),
  };
}

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}
