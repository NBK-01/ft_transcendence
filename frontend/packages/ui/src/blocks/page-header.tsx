import type { ReactNode } from "react";

import { cn } from "@trans/ui/lib/utils";

/** Top of every app page: optional mono eyebrow, title, description, actions on the end side. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b border-gray-alpha-400 pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        {eyebrow && <p className="text-label-mono-12 text-gray-900 uppercase">{eyebrow}</p>}
        <h1 className="text-heading-32 text-balance">{title}</h1>
        {description && <p className="max-w-2xl text-copy-16 text-pretty text-gray-900">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
