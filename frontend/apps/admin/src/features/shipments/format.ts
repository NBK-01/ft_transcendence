import type { Money } from "@trans/api";

/** "$24.90" / "24,90 $US" / "24.90 US$": Western digits in every language, like the rest of the UI. */
export function formatMoney({ amount, currency }: Money, language: string) {
  try {
    return new Intl.NumberFormat(`${language}-u-nu-latn`, { style: "currency", currency }).format(amount);
  } catch {
    // A malformed currency code from the API: show it as-is rather than crash the page.
    return `${amount} ${currency}`;
  }
}
