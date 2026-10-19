import type { Meta, StoryObj } from "@storybook/react-vite";

import { Timeline, TimelineSkeleton, type TimelineEvent } from "@trans/ui/blocks/timeline";

/** Fixed dates so the stories look the same every time. Newest first, as the API sends them. */
const IN_TRANSIT: TimelineEvent[] = [
  { status: "in_transit", location: "Lyon", occurredAt: "2026-10-16T09:42:00.000Z" },
  { status: "in_transit", location: "Casablanca", occurredAt: "2026-10-15T22:18:00.000Z" },
  { status: "confirmed", location: "Payment confirmed", occurredAt: "2026-10-15T16:05:00.000Z" },
  { status: "pending_payment_confirmation", location: "Payment submitted", occurredAt: "2026-10-15T11:05:00.000Z" },
  { status: "pending_payment", location: "Offer approved", occurredAt: "2026-10-15T06:05:00.000Z" },
  { status: "pending_client_decision", location: "Offer from Maârif Leather", occurredAt: "2026-10-15T01:05:00.000Z" },
  { status: "pending_sourcing", location: "Request received", occurredAt: "2026-10-14T20:05:00.000Z" },
];

const DELIVERED: TimelineEvent[] = [
  { status: "delivered", location: "Brussels", occurredAt: "2026-10-13T14:30:00.000Z" },
  { status: "out_for_delivery", location: "Brussels", occurredAt: "2026-10-13T08:10:00.000Z" },
  ...IN_TRANSIT.slice(1),
];

const CANCELLED: TimelineEvent[] = [
  { status: "cancelled", location: "Order cancelled", occurredAt: "2026-10-07T10:00:00.000Z" },
  { status: "confirmed", location: "Payment confirmed", occurredAt: "2026-10-07T05:00:00.000Z" },
];

const AWAITING_DECISION: TimelineEvent[] = [
  { status: "pending_client_decision", location: "Offer from Shenzhen Gadget Co.", occurredAt: "2026-10-16T12:00:00.000Z" },
  { status: "pending_sourcing", location: "Offer rejected, finding another supplier", occurredAt: "2026-10-16T07:00:00.000Z" },
  { status: "pending_client_decision", location: "Offer from Istanbul Textiles", occurredAt: "2026-10-16T02:00:00.000Z" },
  { status: "pending_sourcing", location: "Request received", occurredAt: "2026-10-15T21:00:00.000Z" },
];

const meta = {
  title: "Blocks/Timeline",
  component: Timeline,
  tags: ["autodocs"],
  args: { events: IN_TRANSIT },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "A shipment's history, newest first. The latest event shows its state dot; earlier ones are grey. It only draws: load the events (e.g. GET /shipments/:trackingId/events) and handle loading, error and empty around it.",
      },
    },
  },
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InTransit: Story = {};

export const Delivered: Story = { args: { events: DELIVERED } };

export const Cancelled: Story = { args: { events: CANCELLED } };

export const AwaitingDecision: Story = {
  args: { events: AWAITING_DECISION },
  parameters: { docs: { description: { story: "A rejected offer sends the order back to sourcing; both rounds stay in the history." } } },
};

export const TimeOnly: Story = {
  args: { format: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } },
  parameters: {
    docs: {
      description: {
        story:
          "`format` takes Intl.DateTimeFormat options. Digits are always Western, Arabic included. AuthLayout's preview uses this with `TimelineList`, the same list without its card.",
      },
    },
  },
};

export const Loading: Story = {
  render: () => <TimelineSkeleton />,
};
