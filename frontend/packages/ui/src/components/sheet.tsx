import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { overlayClasses } from "@trans/ui/components/dialog";
import { cn } from "@trans/ui/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

/** Sides are logical: `start` is left in LTR and right in RTL. */
const sheetVariants = cva(
  [
    "fixed z-50 flex flex-col bg-background-100 shadow-xl outline-none",
    "data-[state=open]:animate-in data-[state=open]:duration-250 data-[state=open]:ease-out",
    "data-[state=closed]:animate-out data-[state=closed]:duration-150",
  ],
  {
    variants: {
      side: {
        start:
          "inset-y-0 start-0 h-dvh w-[min(20rem,85vw)] border-e border-gray-alpha-400 data-[state=open]:slide-in-from-start data-[state=closed]:slide-out-to-start",
        end: "inset-y-0 end-0 h-dvh w-[min(24rem,90vw)] border-s border-gray-alpha-400 data-[state=open]:slide-in-from-end data-[state=closed]:slide-out-to-end",
        bottom:
          "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t border-gray-alpha-400 pb-[env(safe-area-inset-bottom)] data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
      },
    },
    defaultVariants: { side: "end" },
  },
);

export function SheetContent({
  className,
  children,
  side,
  showClose = true,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & VariantProps<typeof sheetVariants> & { showClose?: boolean }) {
  const { t } = useTranslation("common");
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className={overlayClasses} />
      <SheetPrimitive.Content data-slot="sheet-content" className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        {showClose && (
          <SheetPrimitive.Close
            className={cn(
              "focus-ring absolute end-3 top-3 grid size-8 cursor-pointer place-items-center rounded-md text-gray-900",
              "transition-colors duration-150 hover:bg-gray-alpha-100 hover:text-gray-1000",
            )}
            aria-label={t("actions.close")}
          >
            <X className="size-4" aria-hidden="true" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-4 pe-12", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("text-heading-16", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-copy-13 text-gray-900", className)} {...props} />;
}
