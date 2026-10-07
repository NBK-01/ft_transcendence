import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "focus-ring peer inline-flex h-5 w-8 shrink-0 cursor-pointer items-center rounded-full p-0.5",
        "bg-gray-alpha-500 transition-[background-color] duration-150 ease-out",
        "data-[state=checked]:bg-gray-1000 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-4 rounded-full bg-background-100 shadow-sm transition-transform duration-150 ease-out",
          "data-[state=checked]:translate-x-3 rtl:data-[state=checked]:-translate-x-3",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
