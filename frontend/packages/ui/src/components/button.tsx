import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { Spinner } from "@trans/ui/components/spinner";
import { cn } from "@trans/ui/lib/utils";

export const buttonVariants = cva(
  [
    "focus-ring relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap select-none",
    "transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:active:scale-100",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** Solid black / white. The default call to action. */
        primary: "bg-gray-1000 text-background-100 hover:bg-gray-1000/85",
        /** Bordered, on the page background. */
        secondary: "border border-gray-alpha-400 bg-background-100 text-gray-1000 hover:bg-gray-alpha-100",
        /** Text-only, for low-emphasis actions and toolbars. */
        tertiary: "bg-transparent text-gray-1000 hover:bg-gray-alpha-100",
        /** Brand orange. At most one per view. */
        accent: "bg-orange-700 text-black hover:bg-orange-800",
        error: "bg-red-700 text-white hover:bg-red-700/90",
        warning: "bg-amber-700 text-black hover:bg-amber-700/90",
      },
      size: {
        tiny: "h-6 px-1.5 text-button-12 [&_svg]:size-3.5",
        sm: "h-8 px-2.5 text-button-14 [&_svg]:size-4",
        md: "h-10 px-3 text-button-14 [&_svg]:size-4",
        lg: "h-12 px-4 text-button-16 [&_svg]:size-5",
      },
      shape: {
        default: "rounded-md",
        rounded: "rounded-full shadow-sm",
        square: "rounded-md px-0",
        circle: "rounded-full px-0",
      },
    },
    compoundVariants: [
      { shape: ["square", "circle"], size: "tiny", className: "w-6" },
      { shape: ["square", "circle"], size: "sm", className: "w-8" },
      { shape: ["square", "circle"], size: "md", className: "w-10" },
      { shape: ["square", "circle"], size: "lg", className: "w-12" },
    ],
    defaultVariants: { variant: "primary", size: "md", shape: "default" },
  },
);

// `prefix` is an (unused) RDFa attribute on HTMLAttributes; we repurpose it for icons.
export type ButtonProps = Omit<ComponentProps<"button">, "prefix"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a router <Link>) with button styles. */
    asChild?: boolean;
    /** Shows a spinner and blocks clicks while keeping the button focusable. */
    loading?: boolean;
    prefix?: ReactNode;
    suffix?: ReactNode;
  };

export function Button({
  className,
  variant,
  size,
  shape,
  asChild = false,
  loading = false,
  prefix,
  suffix,
  children,
  onClick,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, shape }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      data-slot="button"
      type={type}
      {...props}
      className={classes}
      // After the spread, so a caller's aria-disabled can't hide the loading state.
      aria-busy={loading || undefined}
      aria-disabled={loading || props["aria-disabled"] || undefined}
      onClick={handleClick}
    >
      {loading ? <Spinner /> : prefix}
      {children}
      {!loading && suffix}
    </button>
  );
}
