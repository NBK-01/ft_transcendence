import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

export const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full whitespace-nowrap tabular-nums [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        gray: "bg-gray-alpha-200 text-gray-1000",
        blue: "bg-blue-200 text-blue-900",
        green: "bg-green-200 text-green-900",
        amber: "bg-amber-200 text-amber-900",
        red: "bg-red-200 text-red-900",
        /** Brand accent — for "new" / highlight, never for a status. */
        brand: "bg-orange-200 text-orange-900",
        outline: "border border-gray-alpha-400 text-gray-900",
        inverted: "bg-gray-1000 text-background-100",
      },
      size: {
        sm: "h-5 px-1.5 text-label-12 font-medium [&_svg]:size-3",
        md: "h-6 px-2.5 text-label-12 font-medium [&_svg]:size-3.5",
        lg: "h-8 px-3 text-label-14 font-medium [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "gray", size: "md" },
  },
);

export function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}
