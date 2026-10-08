import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@trans/ui/components/input";
import { cn } from "@trans/ui/lib/utils";

/** Password field with a show/hide toggle on the end side. Paste is never blocked. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const { t } = useTranslation("common");
  const [visible, setVisible] = useState(false);
  const label = visible ? t("auth.hidePassword") : t("auth.showPassword");

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pe-10", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className={cn(
          "focus-ring absolute inset-y-1 end-1 grid w-8 cursor-pointer place-items-center rounded-sm text-gray-900",
          "transition-colors duration-150 hover:bg-gray-alpha-100 hover:text-gray-1000",
        )}
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
