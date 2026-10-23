import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  ORDER_STAGES,
  SHIPMENT_STATES,
  ShipmentStateBadge,
  ShipmentStateDot,
  type ShipmentState,
} from "@trans/ui/blocks/shipment-state";
import { SHIPMENT_STATUSES } from "@trans/ui/blocks/status";

const meta = {
  title: "Blocks/Shipment State",
  component: ShipmentStateBadge,
  tags: ["autodocs"],
  args: { status: "pending_client_decision", size: "md" },
  argTypes: {
    status: { control: "select", options: SHIPMENT_STATES },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Any shipment state: the 4 order stages (before tracking) plus the 6 tracking statuses. Tracking statuses render the existing StatusBadge unchanged. Order stages are a quiet outline while waiting on the admin, and blue with a pulse when it's the client's turn.",
      },
    },
  },
} satisfies Meta<typeof ShipmentStateBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Badge: Story = {};

function Column({ title, states, size }: { title: string; states: readonly ShipmentState[]; size?: "sm" | "md" | "lg" }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-label-12 text-gray-900">{title}</p>
      {states.map((status) => (
        <ShipmentStateBadge key={status} status={status} size={size} />
      ))}
    </div>
  );
}

export const AllStates: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-10">
      <Column title="Order stages" states={ORDER_STAGES} size={args.size} />
      <Column title="Tracking statuses" states={SHIPMENT_STATUSES} size={args.size} />
    </div>
  ),
  parameters: { docs: { description: { story: "Order stages come first in a shipment's life, then tracking." } } },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <ShipmentStateBadge status={args.status} size="sm" />
      <ShipmentStateBadge status={args.status} size="md" />
      <ShipmentStateBadge status={args.status} size="lg" />
    </div>
  ),
};

export const DotsOnly: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {SHIPMENT_STATES.map((status) => (
        <ShipmentStateDot key={status} status={status} />
      ))}
    </div>
  ),
};
