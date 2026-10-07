import type { ComponentProps } from "react";

import { fieldClasses } from "@trans/ui/components/input";
import { cn } from "@trans/ui/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClasses, "field-sizing-content min-h-20 px-3 py-2.5 text-pretty", className)}
      {...props}
    />
  );
}
