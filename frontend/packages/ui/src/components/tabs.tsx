import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

/**
 * Vercel-style underline tabs: the active tab gets a 2px bar.
 * The bar is gray-1000; orange stays for focus only.
 */
export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex items-center gap-1 overflow-x-auto border-b border-gray-alpha-400", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "focus-ring relative -mb-px inline-flex h-10 cursor-pointer items-center gap-2 rounded-t-md px-3 text-label-14 text-gray-900 whitespace-nowrap",
        "transition-colors duration-150 hover:text-gray-1000",
        "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gray-1000 after:opacity-0",
        "data-[state=active]:text-gray-1000 data-[state=active]:after:opacity-100",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("pt-6 outline-none", className)} {...props} />;
}
