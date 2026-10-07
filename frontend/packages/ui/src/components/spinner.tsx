import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

/** Fast-spinning arc: a quicker spin reads as a faster load. */
export function Spinner({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("size-4 animate-spin [animation-duration:600ms]", className)}
      {...props}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
