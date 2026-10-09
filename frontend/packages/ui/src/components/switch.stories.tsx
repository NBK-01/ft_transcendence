import type { Meta, StoryObj } from "@storybook/react-vite";

import { Label } from "@trans/ui/components/label";
import { Switch } from "@trans/ui/components/switch";

const meta = {
  title: "Components/Forms/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { id: "notify" },
  render: (args) => (
    <div className="flex items-center gap-3">
      <Switch {...args} />
      <Label htmlFor={args.id} className="text-label-14 font-normal text-gray-1000">
        Email me on every status change
      </Label>
    </div>
  ),
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};
export const On: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };
