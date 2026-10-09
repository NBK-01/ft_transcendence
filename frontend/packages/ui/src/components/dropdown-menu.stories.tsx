import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, Ellipsis, Pencil, Trash2, Truck } from "lucide-react";

import { Button } from "@trans/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";

const meta = {
  title: "Components/Overlays/Dropdown Menu",
  component: DropdownMenu,
  tags: ["autodocs"],
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" shape="square" aria-label="Shipment actions">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>ST-7K2Q-94A1</DropdownMenuLabel>
        <DropdownMenuItem>
          <Truck />
          Assign driver
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Pencil />
          Edit details
          <DropdownMenuShortcut>E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Copy />
          Copy tracking link
          <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <Trash2 />
          Cancel shipment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
