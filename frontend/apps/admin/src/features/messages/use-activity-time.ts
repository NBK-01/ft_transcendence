import { useTranslation } from "react-i18next";

/** Today's messages show a time, yesterday's "Yesterday", older ones a date. Western digits throughout. */
export function useActivityTime() {
  const { t, i18n } = useTranslation("app");
  const locale = `${i18n.language}-u-nu-latn`;
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  return (iso: string) => {
    const at = new Date(iso);
    const days = Math.round((startOfDay(new Date()) - startOfDay(at)) / 86_400_000);
    return days === 0 ? time.format(at) : days === 1 ? t("messages.yesterday") : date.format(at);
  };
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
