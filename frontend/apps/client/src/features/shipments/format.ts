/** "2.4 kg" / "2,4 kg" / "٢٫٤ كغ" */
export function formatWeight(kg: number, language: string) {
  return new Intl.NumberFormat(language, { style: "unit", unit: "kilogram", maximumFractionDigits: 1 }).format(kg);
}

/** "€180.00" / "180,00 €" */
export function formatMoney(amount: number, currency: string, language: string) {
  try {
    return new Intl.NumberFormat(language, { style: "currency", currency }).format(amount);
  } catch {
    // Unknown currency code from the API: show it as-is rather than crash.
    return `${amount} ${currency}`;
  }
}

/** "1.8 MB" / "242 kB" */
export function formatFileSize(bytes: number, language: string) {
  const [value, unit] =
    bytes >= 1_000_000 ? [bytes / 1_000_000, "megabyte"] : bytes >= 1_000 ? [bytes / 1_000, "kilobyte"] : [bytes, "byte"];
  return new Intl.NumberFormat(language, { style: "unit", unit, maximumFractionDigits: 1 }).format(value);
}

/** "FR" → "France" / "France" / "فرنسا" */
export function countryName(code: string, language: string) {
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
