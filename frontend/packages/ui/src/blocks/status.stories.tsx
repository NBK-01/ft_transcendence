import type { Meta, StoryObj } from "@storybook/react-vite";

import { SHIPMENT_STATUSES, StatusBadge, StatusDot } from "@trans/ui/blocks/status";

const meta = {
  title: "Blocks/Shipment Status",
  component: StatusBadge,
  tags: ["autodocs"],
  args: { status: "in_transit", size: "md" },
  argTypes: {
    status: { control: "select", options: SHIPMENT_STATUSES },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
  },
  parameters: {
    docs: {
      description: {
        component: "Status colours never use the brand orange. Moving states (in transit, out for delivery) pulse.",
      },
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Badge: Story = {};

export const AllStatuses: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-2">
      {SHIPMENT_STATUSES.map((status) => (
        <StatusBadge key={status} {...args} status={status} />
      ))}
    </div>
  ),
};

export const DotsOnly: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {SHIPMENT_STATUSES.map((status) => (
        <StatusDot key={status} status={status} />
      ))}
    </div>
  ),
};
