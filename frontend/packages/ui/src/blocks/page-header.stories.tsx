import type { Meta, StoryObj } from "@storybook/react-vite";
import { Download, Plus } from "lucide-react";

import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";

const meta = {
  title: "Blocks/Page Header",
  component: PageHeader,
  tags: ["autodocs"],
  args: {
    eyebrow: "Casablanca — Maârif",
    title: "Shipments",
    description: "Everything moving through this branch, updated live.",
    actions: (
      <>
        <Button variant="secondary" prefix={<Download />}>
          Export
        </Button>
        <Button prefix={<Plus />}>New shipment</Button>
      </>
    ),
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const TitleOnly: Story = { args: { eyebrow: undefined, description: undefined, actions: undefined } };
