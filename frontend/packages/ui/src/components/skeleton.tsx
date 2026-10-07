import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

/** Structural placeholder: match the shape of the content that will load. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-gray-alpha-200", className)}
      {...props}
    />
  );
}
