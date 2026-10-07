import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-sm border border-gray-alpha-400",
        "bg-background-200 px-1 text-label-mono-12 text-gray-900 select-none",
        className,
      )}
      {...props}
    />
  );
}
