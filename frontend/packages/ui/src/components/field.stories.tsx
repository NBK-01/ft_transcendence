import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "@trans/ui/components/field";
import { Input } from "@trans/ui/components/input";
import { PasswordInput } from "@trans/ui/components/password-input";
import { Textarea } from "@trans/ui/components/textarea";

const meta = {
  title: "Components/Forms/Field",
  component: Field,
  tags: ["autodocs"],
  args: { label: "Email", children: <Input type="email" placeholder="you@example.com" /> },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
  parameters: {
    docs: {
      description: {
        component:
          "Wires label, hint and error to the control (`id`, `aria-invalid`, `aria-describedby`). `error` takes an i18n key.",
      },
    },
  },
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  args: { label: "Password", hint: "8+ characters, with a number and a letter.", children: <PasswordInput /> },
};

export const WithError: Story = {
  args: { error: "validation.email", children: <Input type="email" defaultValue="amina@" /> },
};

export const WithLabelAction: Story = {
  args: {
    label: "Password",
    labelAction: (
      <a href="#forgot" className="text-label-13 text-gray-900 underline-offset-4 hover:underline">
        Forgot password?
      </a>
    ),
    children: <PasswordInput />,
  },
};

export const Multiline: Story = {
  args: { label: "Delivery note", hint: "Shown to the driver.", children: <Textarea placeholder="Leave at the front desk" /> },
};
