import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { FieldError } from "@trans/ui/components/field";
import { cn } from "@trans/ui/lib/utils";

export type Choice = { value: string; label: string; hint?: string };

/**
 * One choice from a short list, as native radios in bordered rows (each with
 * an optional hint): arrow keys move between them, like any radio group.
 * Takes react-hook-form's `register(...)`; `error` is an i18n key, like Field's.
 */
export function ChoiceList({
  legend,
  choices,
  error,
  autoFocus = false,
  ...field
}: {
  legend: string;
  choices: Choice[];
  error?: string;
  /** Focus the first choice when the form opens. */
  autoFocus?: boolean;
} & UseFormRegisterReturn) {
  const errorId = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-2 text-label-13 font-medium text-gray-900">{legend}</legend>
      {choices.map((choice, index) => (
        <label
          key={choice.value}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border border-gray-alpha-400 px-4 py-3",
            "transition-colors duration-150 hover:bg-gray-alpha-100",
            "has-checked:border-gray-alpha-600 has-checked:bg-gray-alpha-100",
            // The same ring as `focus-ring`, on the row rather than the small radio.
            "has-[:focus-visible]:shadow-[0_0_0_2px_var(--background-100),0_0_0_4px_var(--orange-800)]",
          )}
        >
          <input
            type="radio"
            value={choice.value}
            autoFocus={autoFocus && index === 0}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-gray-1000 outline-none"
            {...field}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-label-14 text-gray-1000">{choice.label}</span>
            {choice.hint && <span className="text-copy-13 text-gray-900">{choice.hint}</span>}
          </span>
        </label>
      ))}
      {error && <FieldError id={errorId} message={error} />}
    </fieldset>
  );
}
