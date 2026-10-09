import type { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "@trans/ui/components/checkbox";
import { Label } from "@trans/ui/components/label";

const meta = {
  title: "Components/Forms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: { id: "fragile" },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Checkbox {...args} />
      <Label htmlFor={args.id} className="text-label-14 font-normal text-gray-1000">
        Fragile — handle with care
      </Label>
    </div>
  ),
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { "aria-invalid": true } };
