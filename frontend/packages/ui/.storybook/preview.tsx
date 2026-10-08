import type { Decorator, Preview } from "@storybook/react-vite";
import { useEffect, type ReactNode } from "react";
import { MemoryRouter } from "react-router";

import "../src/styles/globals.css";

import { DirectionProvider } from "../src/components/direction-provider";
import { Toaster } from "../src/components/toaster";
import { TooltipProvider } from "../src/components/tooltip";
import { initI18n, i18next, type Language } from "../src/i18n";
import { ThemeProvider, type ResolvedTheme } from "../src/theme/theme-provider";

initI18n();

function Providers({ theme, locale, children }: { theme: ResolvedTheme; locale: Language; children: ReactNode }) {
  useEffect(() => {
    if (i18next.resolvedLanguage !== locale) void i18next.changeLanguage(locale);
  }, [locale]);

  return (
    <ThemeProvider forcedTheme={theme}>
      <DirectionProvider>
        <TooltipProvider>
          <MemoryRouter>
            {children}
            <Toaster />
          </MemoryRouter>
        </TooltipProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}

/** Toolbar: theme + language (Arabic flips the layout to RTL). */
const withProviders: Decorator = (Story, context) => (
  <Providers theme={context.globals.theme as ResolvedTheme} locale={context.globals.locale as Language}>
    <Story />
  </Providers>
);

const preview: Preview = {
  decorators: [withProviders],
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: "Language (ar = RTL)",
      toolbar: {
        title: "Language",
        icon: "globe",
        items: [
          { value: "en", title: "English (LTR)" },
          { value: "fr", title: "Français (LTR)" },
          { value: "ar", title: "العربية (RTL)" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light", locale: "en" },
  parameters: {
    layout: "centered",
    backgrounds: { disable: true },
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    a11y: { test: "error" },
  },
};

export default preview;
