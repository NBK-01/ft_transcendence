import type { Meta, StoryObj } from "@storybook/react-vite";

import { Logo, LogoMark } from "@trans/ui/blocks/logo";

const meta = {
  title: "Blocks/Logo",
  component: Logo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Forward chevrons (movement) with one orange dot at the tip — a shipment's live position.",
      },
    },
  },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Admin: Story = { args: { label: "Admin" } };
export const MarkOnly: Story = { render: () => <LogoMark className="size-12" /> };
