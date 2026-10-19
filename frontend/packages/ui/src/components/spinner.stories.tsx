import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@trans/ui/components/button";
import { Spinner } from "@trans/ui/components/spinner";

const meta = {
  title: "Components/Feedback/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Decorative (`aria-hidden`): pair it with text, or use `Button`'s `loading`, which also sets `aria-busy`.",
      },
    },
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Sized with `size-*`; the colour follows the text. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-gray-1000">
      <Spinner className="size-3" />
      <Spinner />
      <Spinner className="size-6" />
      <Spinner className="size-8 text-orange-700" />
    </div>
  ),
};

export const InButton: Story = {
  render: () => <Button loading>Save</Button>,
};
