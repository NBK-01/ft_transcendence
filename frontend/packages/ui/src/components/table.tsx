import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

/**
 * Styled table markup, no logic. DataTable builds on these; use them directly
 * for small static tables. Cells align with `text-start`, so RTL mirrors.
 */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-xl border border-gray-alpha-400 bg-background-100"
    >
      <table data-slot="table" className={cn("w-full caption-bottom text-copy-14", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-background-200 [&_tr]:border-b [&_tr]:border-gray-alpha-400", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-gray-alpha-400 bg-background-200 text-label-14", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-gray-alpha-300 transition-colors duration-150 ease-out",
        "hover:bg-gray-alpha-100 data-[state=selected]:bg-gray-alpha-200",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3 text-start align-middle text-label-13 whitespace-nowrap text-gray-900",
        "has-[[role=checkbox]]:w-10 has-[[role=checkbox]]:pe-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2.5 text-start align-middle whitespace-nowrap",
        "has-[[role=checkbox]]:w-10 has-[[role=checkbox]]:pe-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return (
    <caption data-slot="table-caption" className={cn("mt-3 text-copy-13 text-gray-900", className)} {...props} />
  );
}
