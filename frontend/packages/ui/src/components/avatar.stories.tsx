import type { Meta, StoryObj } from "@storybook/react-vite";

import { Avatar } from "@trans/ui/components/avatar";

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  args: { name: "Amina El Idrissi", size: "lg" },
  argTypes: {
    size: { control: "inline-radio", options: ["xs", "sm", "md", "lg", "xl"] },
    online: { control: "boolean" },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No photo uploaded → initials. This is the default avatar. */
export const Initials: Story = {};

export const Online: Story = { args: { online: true } };

export const Offline: Story = { args: { online: false } };

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-3">
      {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
        <Avatar key={size} {...args} size={size} />
      ))}
    </div>
  ),
};
