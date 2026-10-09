import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "@trans/ui/components/button";
import { toast, Toaster } from "@trans/ui/components/toaster";

const meta = {
  title: "Components/Toast",
  component: Toaster,
  tags: ["autodocs"],
  parameters: {
    docs: { description: { component: "`<Toaster />` is mounted once per app (and in Storybook's preview)." } },
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        onClick={() => toast.success("Shipment delivered", { description: "ST-7K2Q-94A1 · Paris 11e · 09:42" })}
      >
        Success
      </Button>
      <Button variant="secondary" onClick={() => toast.error("Upload failed", { description: "Files must be under 10 MB." })}>
        Error
      </Button>
      <Button variant="secondary" onClick={() => toast.info("Driver assigned", { description: "Youssef B. · ETA 40 min" })}>
        Info
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast("Shipment cancelled", { action: { label: "Undo", onClick: () => toast.success("Restored") } })
        }
      >
        With action
      </Button>
    </div>
  ),
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
