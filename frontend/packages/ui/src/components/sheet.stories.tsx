import type { Meta, StoryObj } from "@storybook/react-vite";

import { StatusBadge } from "@trans/ui/blocks/status";
import { Button } from "@trans/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@trans/ui/components/sheet";

const meta = {
  title: "Components/Overlays/Sheet",
  component: SheetContent,
  tags: ["autodocs"],
  args: { side: "end" },
  argTypes: { side: { control: "inline-radio", options: ["start", "end", "bottom"] } },
  parameters: {
    docs: { description: { component: "Sides are logical: `start` is left in LTR and right in RTL." } },
  },
  render: (args) => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">Open shipment</Button>
      </SheetTrigger>
      <SheetContent {...args}>
        <SheetHeader>
          <SheetTitle>
            <span className="text-label-mono-14">ST-7K2Q-94A1</span>
          </SheetTitle>
          <SheetDescription>Casablanca → Paris · 2.4 kg</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <StatusBadge status="out_for_delivery" />
        </div>
      </SheetContent>
    </Sheet>
  ),
} satisfies Meta<typeof SheetContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const End: Story = {};
export const Start: Story = { args: { side: "start" } };
export const Bottom: Story = { args: { side: "bottom" } };
