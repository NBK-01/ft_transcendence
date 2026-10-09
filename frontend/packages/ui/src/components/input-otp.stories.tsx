import type { Meta, StoryObj } from "@storybook/react-vite";

import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@trans/ui/components/input-otp";

/** `input-otp` props are a union (render | children), so stories go through a small wrapper. */
function SixDigitCode({ defaultValue, disabled }: { defaultValue?: string; disabled?: boolean }) {
  return (
    <InputOTP maxLength={6} defaultValue={defaultValue} disabled={disabled} aria-label="Verification code">
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  );
}

const meta = {
  title: "Components/Forms/Input OTP",
  component: SixDigitCode,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "Digits always read left-to-right, also in Arabic. Pasting a full code works." } },
  },
} satisfies Meta<typeof SixDigitCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Partial: Story = { args: { defaultValue: "482" } };
export const Complete: Story = { args: { defaultValue: "482913" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "482913" } };
