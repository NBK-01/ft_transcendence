import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, Copy, Download } from "lucide-react";

import { Button } from "@trans/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@trans/ui/components/tooltip";

const ACTIONS = [
  { label: "Copy tracking link", Icon: Copy },
  { label: "Download label", Icon: Download },
  { label: "Notify customer", Icon: Bell },
];

const meta = {
  title: "Components/Overlays/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "After the first tooltip opens, moving to a neighbour opens it instantly (skipDelayDuration).",
      },
    },
  },
  render: (args) => (
    <div className="flex items-center gap-1">
      {ACTIONS.map(({ label, Icon }) => (
        <Tooltip key={label} {...args}>
          <TooltipTrigger asChild>
            <Button variant="tertiary" shape="square" aria-label={label}>
              <Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Toolbar: Story = {};
