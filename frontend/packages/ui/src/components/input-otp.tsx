import { OTPInput, OTPInputContext } from "input-otp";
import { useContext, type ComponentProps } from "react";

import { cn } from "@trans/ui/lib/utils";

/**
 * One-time code input. Digits always read left-to-right, even in Arabic,
 * so the container forces `dir="ltr"`. Paste of a full code is supported.
 */
export function InputOTP({ className, containerClassName, ...props }: ComponentProps<typeof OTPInput>) {
  return (
    <OTPInput
      data-slot="input-otp"
      dir="ltr"
      containerClassName={cn("flex items-center gap-3 has-disabled:opacity-50", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

export function InputOTPGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="input-otp-group" className={cn("flex items-center", className)} {...props} />;
}

export function InputOTPSlot({ index, className, ...props }: ComponentProps<"div"> & { index: number }) {
  const context = useContext(OTPInputContext);
  const slot = context.slots[index];

  return (
    <div
      data-slot="input-otp-slot"
      data-active={slot?.isActive || undefined}
      className={cn(
        "relative grid size-12 place-items-center border-y border-e border-gray-alpha-400 bg-background-100 text-heading-20 font-mono tabular-nums",
        "transition-[border-color,box-shadow] duration-150 ease-out",
        "first:rounded-s-md first:border-s last:rounded-e-md",
        "data-[active]:z-10 data-[active]:border-gray-alpha-600 data-[active]:ring-3 data-[active]:ring-gray-alpha-200",
        "aria-invalid:border-red-700",
        className,
      )}
      {...props}
    >
      {slot?.char}
      {slot?.hasFakeCaret && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="h-5 w-px animate-caret-blink bg-gray-1000" />
        </span>
      )}
    </div>
  );
}

export function InputOTPSeparator(props: ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" aria-hidden="true" {...props}>
      <span className="block h-px w-3 bg-gray-alpha-600" />
    </div>
  );
}
