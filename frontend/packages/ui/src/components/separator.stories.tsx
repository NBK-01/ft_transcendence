import type { Meta, StoryObj } from "@storybook/react-vite";

import { Separator } from "@trans/ui/components/separator";

const meta = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="flex flex-col gap-3 text-copy-14">
      <p className="text-gray-1000">Casablanca Maârif</p>
      <Separator />
      <p className="text-gray-900">Morocco operations and customs clearance</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-3 text-label-13 text-gray-900">
      <span>Privacy</span>
      <Separator orientation="vertical" />
      <span>Terms</span>
      <Separator orientation="vertical" />
      <span>Status</span>
    </div>
  ),
};
