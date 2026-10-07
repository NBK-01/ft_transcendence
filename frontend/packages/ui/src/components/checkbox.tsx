import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "focus-ring peer grid size-4 shrink-0 cursor-pointer place-items-center rounded-sm border border-gray-alpha-600 bg-background-100",
        "transition-[background-color,border-color] duration-150 ease-out hover:border-gray-1000",
        "data-[state=checked]:border-gray-1000 data-[state=checked]:bg-gray-1000 data-[state=checked]:text-background-100",
        "aria-invalid:border-red-700 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center">
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
