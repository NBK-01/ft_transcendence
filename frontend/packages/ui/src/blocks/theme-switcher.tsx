import { Monitor, Moon, Sun } from "lucide-react";
import { ToggleGroup } from "radix-ui";
import { useTranslation } from "react-i18next";

import { cn } from "@trans/ui/lib/utils";
import { useTheme, type Theme } from "@trans/ui/theme";

const OPTIONS = [
  { value: "system", Icon: Monitor },
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
] as const satisfies readonly { value: Theme; Icon: unknown }[];

/** Vercel-footer style segmented control: system / light / dark. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation("common");

  return (
    <ToggleGroup.Root
      type="single"
      value={theme}
      onValueChange={(value) => value && setTheme(value as Theme)}
      aria-label={t("theme.label")}
      className={cn("inline-flex h-8 items-center gap-0.5 rounded-full border border-gray-alpha-400 p-0.5", className)}
    >
      {OPTIONS.map(({ value, Icon }) => (
        <ToggleGroup.Item
          key={value}
          value={value}
          aria-label={t(`theme.${value}`)}
          title={t(`theme.${value}`)}
          className={cn(
            "focus-ring grid size-7 cursor-pointer place-items-center rounded-full text-gray-900",
            "transition-colors duration-150 hover:text-gray-1000",
            "data-[state=on]:bg-gray-alpha-200 data-[state=on]:text-gray-1000",
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
