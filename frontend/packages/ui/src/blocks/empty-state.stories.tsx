import type { Meta, StoryObj } from "@storybook/react-vite";
import { KeyRound, Package, Plus } from "lucide-react";

import { EmptyState } from "@trans/ui/blocks/empty-state";
import { Button } from "@trans/ui/components/button";

const meta = {
  title: "Blocks/Empty State",
  component: EmptyState,
  tags: ["autodocs"],
  args: {
    icon: Package,
    title: "No shipments yet",
    description: "Create your first shipment and track it here in real time.",
    action: <Button prefix={<Plus />}>New shipment</Button>,
  },
  decorators: [(Story) => <div className="w-[36rem] max-w-[calc(100vw-2rem)]">{Story()}</div>],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ApiKeys: Story = {
  args: {
    icon: KeyRound,
    title: "No API keys",
    description: "Partner systems use API keys to read shipment status. Keys are scoped to one branch.",
    action: <Button variant="secondary">Create key</Button>,
  },
};

export const WithoutAction: Story = { args: { action: undefined } };
