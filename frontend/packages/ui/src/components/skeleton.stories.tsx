import type { Meta, StoryObj } from "@storybook/react-vite";

import { Kbd } from "@trans/ui/components/kbd";
import { Separator } from "@trans/ui/components/separator";
import { Skeleton } from "@trans/ui/components/skeleton";
import { Spinner } from "@trans/ui/components/spinner";

const meta = {
  title: "Components/Feedback/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Structural: matches the shape of a shipment row that's loading. */
export const ShipmentRow: Story = {
  render: () => (
    <div className="flex w-[28rem] max-w-[calc(100vw-2rem)] flex-col gap-4">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  ),
};

/** Small helpers that live next to Skeleton: Spinner, Kbd, Separator. */
export const Helpers: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-label-13 text-gray-900">
      <Spinner />
      <Separator orientation="vertical" className="h-5" />
      <span className="flex items-center gap-1.5">
        Search <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </div>
  ),
};
