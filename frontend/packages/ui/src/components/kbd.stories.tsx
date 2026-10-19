import type { Meta, StoryObj } from "@storybook/react-vite";

import { Kbd } from "@trans/ui/components/kbd";

const meta = {
  title: "Components/Kbd",
  component: Kbd,
  tags: ["autodocs"],
  args: { children: "Esc" },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** One `Kbd` per key. Shortcuts stay left-to-right in Arabic, like on the keyboard. */
export const Shortcut: Story = {
  render: () => (
    <p className="flex items-center gap-2 text-copy-14 text-gray-900">
      <span dir="ltr" className="flex items-center gap-1">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
      Search
    </p>
  ),
};
