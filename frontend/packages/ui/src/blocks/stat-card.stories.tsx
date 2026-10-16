import type { Meta, StoryObj } from "@storybook/react-vite";
import { Ban, CircleCheck, Package, Truck, Users, Weight } from "lucide-react";

import { StatCard } from "@trans/ui/blocks/stat-card";

const meta = {
  title: "Blocks/Stat Card",
  component: StatCard,
  tags: ["autodocs"],
  args: {
    label: "Shipments today",
    value: 1284,
    change: 0.12,
    changeLabel: "vs last week",
    icon: Package,
    className: "w-72 max-w-[calc(100vw-2rem)]",
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Down: Story = { args: { label: "Delivered", value: 912, change: -0.048, icon: CircleCheck } };

/** For numbers where going up is bad, an increase shows red. */
export const Inverted: Story = {
  args: { label: "Cancelled", value: 37, change: 0.25, positiveIsGood: false, icon: Ban },
};

export const NoChange: Story = { args: { label: "Active staff", value: 58, change: 0, icon: Users } };

/** Any Intl.NumberFormat options, or a ready-made string. */
export const Formats: Story = {
  render: () => (
    <div className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-4">
      <StatCard label="On-time rate" value={0.964} format={{ style: "percent", maximumFractionDigits: 1 }} />
      <StatCard
        label="Weight shipped"
        value={18240.5}
        format={{ style: "unit", unit: "kilogram", maximumFractionDigits: 0 }}
        icon={Weight}
      />
      <StatCard label="Busiest branch" value="Amman Central" />
    </div>
  ),
};

export const WithoutChange: Story = { args: { change: undefined } };

export const Loading: Story = { args: { isLoading: true } };

/** The Overview page's top row: four cards that wrap on smaller screens. */
export const OverviewRow: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Shipments today" value={1284} change={0.12} changeLabel="vs yesterday" icon={Package} />
      <StatCard label="In transit" value={342} change={0.031} changeLabel="vs yesterday" icon={Truck} />
      <StatCard label="Delivered" value={912} change={-0.048} changeLabel="vs yesterday" icon={CircleCheck} />
      <StatCard label="Active staff" value={58} change={0} changeLabel="vs yesterday" icon={Users} />
    </div>
  ),
};
