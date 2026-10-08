import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@trans/ui/lib/utils";

/**
 * The mark: a forward chevron (movement) with an orange dot at its tip —
 * the "live position" of a shipment. The only brand colour in the mark.
 */
export function LogoMark({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn("size-6 rtl:-scale-x-100", className)} {...props}>
      <rect width="24" height="24" rx="6" className="fill-gray-1000" />
      <path
        d="M6.5 7.5 11 12l-4.5 4.5M11.5 7.5 16 12l-4.5 4.5"
        className="stroke-background-100"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18.25" cy="12" r="1.75" className="fill-orange-700" />
    </svg>
  );
}

export function Logo({
  className,
  label,
  ...props
}: ComponentProps<"span"> & {
  /** Optional suffix, e.g. "Admin". */
  label?: string;
}) {
  const { t } = useTranslation("common");
  return (
    <span className={cn("inline-flex items-center gap-2", className)} {...props}>
      <LogoMark />
      <span className="text-heading-16">{t("brand.name")}</span>
      {label && (
        <span className="rounded-sm border border-gray-alpha-400 px-1.5 text-label-mono-12 text-gray-900">{label}</span>
      )}
    </span>
  );
}
