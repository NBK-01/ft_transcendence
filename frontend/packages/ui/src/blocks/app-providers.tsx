import type { ReactNode } from "react";

import { DirectionProvider } from "@trans/ui/components/direction-provider";
import { Toaster } from "@trans/ui/components/toaster";
import { TooltipProvider } from "@trans/ui/components/tooltip";
import { ThemeProvider } from "@trans/ui/theme";

/** Everything an app needs around its router: theme, RTL direction, tooltips, toasts. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <DirectionProvider>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
