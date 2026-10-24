import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const KB = 1024;
const MB = KB * 1024;

/**
 * Dates, weights, file sizes and countries on the shipment page, with Western
 * digits in every language like the rest of the UI. The formatters are made
 * once per language, not once per value.
 */
export function useDetailFormat() {
  const { i18n } = useTranslation();
  const language = i18n.language;

  return useMemo(() => {
    const locale = `${language}-u-nu-latn`;
    const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    const weight = new Intl.NumberFormat(locale, { style: "unit", unit: "kilogram", maximumFractionDigits: 2 });
    const size = {
      byte: new Intl.NumberFormat(locale, { style: "unit", unit: "byte" }),
      kilobyte: new Intl.NumberFormat(locale, { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 }),
      megabyte: new Intl.NumberFormat(locale, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 }),
    };
    const regions = new Intl.DisplayNames([locale], { type: "region" });

    return {
      /** "Oct 24, 2026, 3:45 PM" */
      dateTime: (iso: string) => dateTime.format(new Date(iso)),
      /** "2.5 kg" */
      weight: (kg: number) => weight.format(kg),
      /** "1.8 MB". Counted in 1024s, like the 10 MB upload limit, so a file at the limit shows "10 MB". */
      fileSize: (bytes: number) =>
        bytes >= MB
          ? size.megabyte.format(bytes / MB)
          : bytes >= KB
            ? size.kilobyte.format(bytes / KB)
            : size.byte.format(bytes),
      /** "FR" → "France" / "France" / "فرنسا". A code it doesn't know shows as it is. */
      country: (code: string) => {
        try {
          return regions.of(code) ?? code;
        } catch {
          return code;
        }
      },
    };
  }, [language]);
}
