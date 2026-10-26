/** "2.4 kg" / "2,4 kg": Western digits in every language, like the rest of the UI. */
export function formatWeight(kg: number, language: string) {
  return new Intl.NumberFormat(`${language}-u-nu-latn`, { style: "unit", unit: "kilogram", maximumFractionDigits: 1 }).format(kg);
}

/** "$24.90" / "24,90 $US" / "24.90 US$": Western digits in every language, like the rest of the UI. */
export function formatMoney(amount: number, currency: string, language: string) {
  try {
    return new Intl.NumberFormat(`${language}-u-nu-latn`, { style: "currency", currency }).format(amount);
  } catch {
    // Unknown currency code from the API: show it as-is rather than crash.
    return `${amount} ${currency}`;
  }
}

/** "1.8 MB" / "242 kB": Western digits in every language, like the rest of the UI. */
export function formatFileSize(bytes: number, language: string) {
  const [value, unit] =
    bytes >= 1_000_000 ? [bytes / 1_000_000, "megabyte"] : bytes >= 1_000 ? [bytes / 1_000, "kilobyte"] : [bytes, "byte"];
  return new Intl.NumberFormat(`${language}-u-nu-latn`, { style: "unit", unit, maximumFractionDigits: 1 }).format(value);
}

/** "FR" → "France" / "France" / "فرنسا" */
export function countryName(code: string, language: string) {
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
