import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PaginationMeta } from "@trans/api";
import { Button } from "@trans/ui/components/button";

/**
 * "21–27 of 27 · Page 2 of 2 · ‹ ›" under a server-paginated list. Same look and
 * shared strings as the admin's DataTablePagination, without its page-size picker.
 * Renders nothing when everything fits on one page.
 */
export function ListPagination({ meta, onPageChange }: { meta: PaginationMeta; onPageChange: (page: number) => void }) {
  const { t } = useTranslation("common");
  const { page, limit, totalItems, totalPages } = meta;
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalItems);

  return (
    <nav
      aria-label={t("table.page", { page, total: totalPages })}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1 text-copy-13 text-gray-900"
    >
      <p className="tabular-nums" aria-live="polite">
        {t("table.range", { from, to, total: totalItems })}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">{t("table.page", { page, total: totalPages })}</span>
        <Button
          variant="secondary"
          size="sm"
          shape="square"
          aria-label={t("table.previousPage")}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          shape="square"
          aria-label={t("table.nextPage")}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
