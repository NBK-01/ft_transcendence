import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@trans/ui/lib/utils";

/** One icon, one message, one clear next action. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-gray-alpha-500 px-6 py-16 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-xl border border-gray-alpha-400 bg-background-200 shadow-xs">
        <Icon className="size-5 text-gray-900" aria-hidden="true" />
      </span>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h2 className="text-heading-16 text-balance">{title}</h2>
        {description && <p className="text-copy-14 text-pretty text-gray-900">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
