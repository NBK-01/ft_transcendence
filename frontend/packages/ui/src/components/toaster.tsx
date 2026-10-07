import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { Spinner } from "@trans/ui/components/spinner";
import { directionOf } from "@trans/ui/i18n";
import { useTheme } from "@trans/ui/theme";

export { toast } from "sonner";

/** Mount once per app. Call `toast()` from anywhere. Sits on the end edge in both LTR and RTL. */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  const { i18n } = useTranslation();
  const dir = directionOf(i18n.resolvedLanguage ?? "en");

  return (
    <Sonner
      theme={resolvedTheme}
      dir={dir}
      position={dir === "rtl" ? "bottom-left" : "bottom-right"}
      gap={8}
      icons={{
        success: <CircleCheck className="size-4 text-green-700" />,
        error: <CircleAlert className="size-4 text-red-700" />,
        warning: <TriangleAlert className="size-4 text-amber-700" />,
        info: <Info className="size-4 text-blue-700" />,
        loading: <Spinner className="text-gray-900" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl! border! border-gray-alpha-400! bg-background-100! text-gray-1000! shadow-lg! font-sans! gap-2.5!",
          title: "text-label-14! font-medium!",
          description: "text-copy-13! text-gray-900!",
          actionButton: "bg-gray-1000! text-background-100! rounded-md! text-button-12!",
          cancelButton: "bg-gray-alpha-100! text-gray-1000! rounded-md! text-button-12!",
        },
      }}
      {...props}
    />
  );
}
