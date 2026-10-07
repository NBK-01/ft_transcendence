import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

/** Border-led surface (no shadow). Footer is a tinted strip, Geist-style. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("flex flex-col rounded-xl border border-gray-alpha-400 bg-background-100", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1.5 px-6 pt-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 data-slot="card-title" className={cn("text-heading-20 text-balance", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p data-slot="card-description" className={cn("text-copy-14 text-pretty text-gray-900", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-6 py-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-3 rounded-b-xl border-t border-gray-alpha-400 bg-background-200 px-6 py-3 text-copy-13 text-gray-900",
        className,
      )}
      {...props}
    />
  );
}
