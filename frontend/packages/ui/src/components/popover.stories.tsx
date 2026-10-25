import type { Meta, StoryObj } from "@storybook/react-vite";
import { Share2 } from "lucide-react";

import { Button } from "@trans/ui/components/button";
import { CopyButton } from "@trans/ui/components/copy-button";
import { Input } from "@trans/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@trans/ui/components/popover";

const LINK = "https://shiptrack.example/t/ST-7K2Q-94A1";

const meta = {
  title: "Components/Overlays/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "For more than a menu: a short form, or a list with its own actions. Escape or a click outside closes it, and focus goes back to the trigger. `align` is logical: `end` is the right edge in LTR and the left in RTL.",
      },
    },
  },
  render: (args) => (
    <Popover {...args}>
      <PopoverTrigger asChild>
        <Button variant="secondary" prefix={<Share2 />}>
          Share tracking
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-labelledby="share-tracking-title" className="flex w-80 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="share-tracking-title" className="text-heading-14">
            Share tracking
          </h2>
          <p className="text-copy-13 text-gray-900">Anyone with the link can follow ST-7K2Q-94A1.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input aria-label="Tracking link" readOnly value={LINK} dir="ltr" className="h-8" />
          <CopyButton value={LINK} label="Copy tracking link" />
        </div>
      </PopoverContent>
    </Popover>
  ),
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
