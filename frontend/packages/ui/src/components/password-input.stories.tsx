import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "@trans/ui/components/field";
import { PasswordInput } from "@trans/ui/components/password-input";

const meta = {
  title: "Components/Forms/Password Input",
  component: PasswordInput,
  tags: ["autodocs"],
  args: { defaultValue: "correct horse", "aria-label": "Password", autoComplete: "current-password" },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
  parameters: {
    docs: {
      description: {
        component:
          "The eye button sits on the end side (left in Arabic) and says whether the password is shown (`aria-pressed`). Paste is never blocked.",
      },
    },
  },
} satisfies Meta<typeof PasswordInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InField: Story = {
  render: (args) => (
    <Field label="New password" hint="At least 8 characters.">
      <PasswordInput {...args} defaultValue="" autoComplete="new-password" />
    </Field>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <Field label="New password" error="validation.passwordMin">
      <PasswordInput {...args} defaultValue="short" autoComplete="new-password" />
    </Field>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
