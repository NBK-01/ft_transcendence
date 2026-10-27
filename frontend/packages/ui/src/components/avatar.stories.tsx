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

/** An uploaded photo; the initials show while it loads, or if it can't. */
export const Photo: Story = {
  args: {
    src:
      "data:image/svg+xml," +
      encodeURIComponent(
        [
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
          '<rect width="64" height="64" fill="#0a72ef"/><circle cx="32" cy="26" r="11" fill="#fff"/>',
          '<rect x="14" y="42" width="36" height="22" rx="11" fill="#fff"/></svg>',
        ].join(""),
      ),
  },
};

/** Screen readers hear "Online" (or `statusLabel`) in place of the dot. */
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
