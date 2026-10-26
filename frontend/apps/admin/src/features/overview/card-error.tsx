import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@trans/ui/components/button";

/** A card's content that couldn't load. */
export function CardError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("common");
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
      <CircleAlert className="size-5 text-red-700" aria-hidden="true" />
      <p className="text-copy-14 text-gray-900">{t("stat.error")}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t("table.retry")}
      </Button>
    </div>
  );
}
