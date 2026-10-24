import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShipmentStateBreakdown, type ShipmentStateCount } from "@trans/ui/blocks/shipment-state-breakdown";

/** Every state but "requested" (nothing sets it), in lifecycle order, like the admin Overview. */
const counts: ShipmentStateCount[] = [
  { state: "pending_sourcing", count: 5, href: "/shipments?status=pending_sourcing" },
  { state: "pending_client_decision", count: 4, href: "/shipments?status=pending_client_decision" },
  { state: "pending_payment", count: 3, href: "/shipments?status=pending_payment" },
  { state: "pending_payment_confirmation", count: 4, href: "/shipments?status=pending_payment_confirmation" },
  { state: "confirmed", count: 4, href: "/shipments?status=confirmed" },
  { state: "in_transit", count: 7, href: "/shipments?status=in_transit" },
  { state: "out_for_delivery", count: 3, href: "/shipments?status=out_for_delivery" },
  { state: "delivered", count: 9, href: "/shipments?status=delivered" },
  { state: "cancelled", count: 3, href: "/shipments?status=cancelled" },
];

const meta = {
  title: "Blocks/Shipment State Breakdown",
  component: ShipmentStateBreakdown,
  tags: ["autodocs"],
  args: { items: counts, label: "Shipments by status" },
  decorators: [(Story) => <div className="w-96 max-w-[calc(100vw-2rem)]">{Story()}</div>],
  parameters: {
    docs: {
      description: {
        component:
          "How shipments split across states: a stacked bar in the state tones (hover a segment for its numbers), then a legend with each state's count and share. The legend carries every number as text and links each state, so nothing relies on colour.",
      },
    },
  },
} satisfies Meta<typeof ShipmentStateBreakdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Small counts still get a visible segment; states with none stay in the legend, muted. */
export const Uneven: Story = {
  args: {
    items: counts.map((item) => ({
      ...item,
      count: ({ delivered: 240, in_transit: 31, pending_sourcing: 1 } as Record<string, number>)[item.state] ?? 0,
    })),
  },
};

/** No shipments yet: an empty track and zeros. */
export const Empty: Story = { args: { items: counts.map((item) => ({ ...item, count: 0 })) } };

/** Without `href`, the rows are plain text. */
export const WithoutLinks: Story = { args: { items: counts.map(({ state, count }) => ({ state, count })) } };
