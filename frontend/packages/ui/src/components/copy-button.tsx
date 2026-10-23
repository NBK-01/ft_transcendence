import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@trans/ui/components/button";
import { toast } from "@trans/ui/components/toaster";
import { Tooltip, TooltipContent, TooltipTrigger } from "@trans/ui/components/tooltip";

const RESET_MS = 2000;

/**
 * Icon button that copies `value` to the clipboard. Shows a check for 2 s;
 * if the browser refuses (permissions, insecure context), a toast says so.
 * `label` names what is copied, e.g. "Copy tracking ID" (default: "Copy").
 */
export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), RESET_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      toast.error(t("actions.copyFailed"));
    }
  };

  const text = copied ? t("actions.copied") : (label ?? t("actions.copy"));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="tertiary"
          size="sm"
          shape="square"
          onClick={() => void copy()}
          aria-label={text}
          className={className}
        >
          {copied ? <Check aria-hidden="true" className="text-green-700" /> : <Copy aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
