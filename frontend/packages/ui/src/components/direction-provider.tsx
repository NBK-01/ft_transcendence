import { Direction } from "radix-ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { directionOf } from "@trans/ui/i18n";

/**
 * Feeds the current reading direction to Radix, so menus, selects, sliders
 * and keyboard arrows behave correctly in RTL (Arabic).
 */
export function DirectionProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  return <Direction.Provider dir={directionOf(i18n.resolvedLanguage ?? "en")}>{children}</Direction.Provider>;
}
