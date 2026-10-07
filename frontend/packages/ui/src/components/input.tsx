import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

/**
 * Shared field surface for Input / Textarea / Select trigger.
 * Fields focus to a neutral ring; orange stays reserved for buttons & links.
 */
export const fieldClasses = cn(
  "w-full min-w-0 rounded-md border border-gray-alpha-400 bg-background-100 text-copy-14 text-gray-1000",
  "transition-[border-color,box-shadow] duration-150 ease-out outline-none",
  "placeholder:text-gray-700 hover:border-gray-alpha-500",
  "focus-visible:border-gray-alpha-600 focus-visible:ring-3 focus-visible:ring-gray-alpha-200",
  "aria-invalid:border-red-700 aria-invalid:focus-visible:ring-red-200",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-700",
);

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        fieldClasses,
        "h-10 px-3",
        "file:me-3 file:border-0 file:bg-transparent file:text-button-14 file:text-gray-1000",
        className,
      )}
      {...props}
    />
  );
}
