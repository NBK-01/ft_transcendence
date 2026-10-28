import { Check } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

/** Floating menu surface — shared by DropdownMenu and Select. */
export const menuSurfaceClasses = cn(
  // Same tier as dialog/sheet/toast (z-50) — a menu opened from inside one mounts
  // later in the DOM, so equal z-index still paints it on top; see globals.css.
  "z-50 min-w-44 overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100 p-1 shadow-lg",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=closed]:duration-100",
);

export const menuItemClasses = cn(
  "relative flex h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-label-14 text-gray-1000 outline-none select-none",
  "data-[highlighted]:bg-gray-alpha-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-gray-900",
);

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(menuSurfaceClasses, "origin-(--radix-dropdown-menu-content-transform-origin)", className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        menuItemClasses,
        variant === "destructive" && "text-red-900 data-[highlighted]:bg-red-100 [&_svg]:text-red-900",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(menuItemClasses, "pe-8", className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute end-2 grid place-items-center">
        <Check aria-hidden="true" />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

/** Multi-select item (e.g. table filters). The check box sits at the start, the count at the end. */
export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(menuItemClasses, "group/check", className)} {...props}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-sm border border-gray-alpha-600 bg-background-100",
          "group-data-[state=checked]/check:border-gray-1000 group-data-[state=checked]/check:bg-gray-1000",
        )}
      >
        <MenuPrimitive.ItemIndicator>
          <Check className="size-3! text-background-100!" strokeWidth={3} />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-2 pt-2 pb-1 text-label-12 text-gray-900", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-gray-alpha-400", className)} {...props} />;
}

export function DropdownMenuShortcut({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("ms-auto text-label-mono-12 text-gray-700", className)} {...props} />;
}
