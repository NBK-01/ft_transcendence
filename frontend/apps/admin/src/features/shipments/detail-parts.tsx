import { ExternalLink, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { cn } from "@trans/ui/lib/utils";

/** One titled card of the shipment page. `action` sits at the end of the title row. */
export function DetailSection({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("gap-4 p-5", className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-heading-16">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** A label and its value, inside a <dl>. */
export function DetailItem({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-label-12 text-gray-900">{label}</dt>
      <dd className="text-copy-14 text-gray-1000">{children}</dd>
    </div>
  );
}

/**
 * Opens in a new tab, says so to screen readers, and gets no handle on this
 * page (noopener). Long text is cut with an ellipsis.
 */
export function NewTabLink({
  href,
  dir,
  className,
  children,
}: {
  href: string;
  dir?: "ltr" | "auto";
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation("app");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir={dir}
      className={cn(
        "focus-ring inline-flex max-w-full items-center gap-1.5 rounded-sm text-gray-1000 hover:underline",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 text-gray-900" />
      <span className="sr-only">{t("shipment.newTab")}</span>
    </a>
  );
}

/** A section's own request failed: it says so, with a retry, and the rest of the page stays usable. */
export function SectionError({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="flex items-center gap-2 text-copy-14 text-gray-900">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-red-900" />
        {message}
      </p>
      <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>
        {t("table.retry")}
      </Button>
    </div>
  );
}
