import { CircleAlert } from "lucide-react";
import { Slot } from "radix-ui";
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@trans/ui/components/label";
import { cn } from "@trans/ui/lib/utils";

/**
 * Label + control + hint + error, wired for screen readers.
 * The child control receives `id`, `aria-invalid` and `aria-describedby`.
 *
 * `error` is an i18n key (zod schemas return keys like "validation.email"),
 * so messages are translated at render time and follow language switches.
 */
export function Field({
  label,
  hint,
  error,
  labelAction,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Rendered on the end side of the label row, e.g. "Forgot password?". */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="field" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <Slot.Root id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy}>
        {children}
      </Slot.Root>
      {error ? (
        <FieldError id={errorId} message={error} />
      ) : (
        hint && (
          <p id={hintId} className="text-label-12 text-gray-900">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Inline error next to the field (never only in a toast). */
export function FieldError({ id, message, className }: { id?: string; message: string; className?: string }) {
  const { t } = useTranslation("common");
  return (
    <p id={id} role="alert" className={cn("flex items-start gap-1.5 text-label-13 text-red-900", className)}>
      <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {t(message)}
    </p>
  );
}
