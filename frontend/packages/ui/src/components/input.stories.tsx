import type { Meta, StoryObj } from "@storybook/react-vite";

import { Input } from "@trans/ui/components/input";

const meta = {
  title: "Components/Forms/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "ST-7K2Q-94A1", "aria-label": "Tracking code" },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: "amina@example.com", type: "email", "aria-label": "Email" } };

export const Invalid: Story = { args: { defaultValue: "amina@", "aria-invalid": true, "aria-label": "Email" } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "Casablanca hub" } };

export const File: Story = { args: { type: "file", "aria-label": "Package photo" } };
