import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@trans/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";
import { LANGUAGES, isLanguage } from "@trans/ui/i18n";

/** Changing language also flips <html dir>, so Arabic mirrors the whole layout. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation("common");
  const current = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          shape="rounded"
          className={className}
          prefix={<Languages aria-hidden="true" />}
          aria-label={t("language.label")}
        >
          <span className="text-label-mono-12 uppercase">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("language.label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={current} onValueChange={(value) => void i18n.changeLanguage(value)}>
          {LANGUAGES.map((language) => (
            <DropdownMenuRadioItem key={language} value={language} lang={language}>
              {t(`language.${language}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
