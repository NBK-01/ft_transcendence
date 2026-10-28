import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

/**
 * A floating panel tied to its trigger, for more than a menu: a short form, or
 * a list with its own actions. Same surface and motion as the menus. Name it
 * with `aria-labelledby` (it's a dialog to screen readers).
 */
export function PopoverContent({
  className,
  align = "center",
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          // Same tier as dialog/sheet/toast (z-50) — a popover opened from inside one mounts
          // later in the DOM, so equal z-index still paints it on top; see globals.css.
          "z-50 w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-gray-alpha-400 bg-background-100 p-4 shadow-lg outline-none",
          "origin-(--radix-popover-content-transform-origin)",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=closed]:duration-100",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
