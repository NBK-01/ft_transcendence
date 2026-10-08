import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArrowRight, Package, Plus, Trash2 } from "lucide-react";

import { Button } from "@trans/ui/components/button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Create shipment", variant: "primary", size: "md", shape: "default" },
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "tertiary", "accent", "error", "warning"] },
    size: { control: "inline-radio", options: ["tiny", "sm", "md", "lg"] },
    shape: { control: "inline-radio", options: ["default", "rounded", "square", "circle"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: "secondary", children: "Export CSV" } };

export const Tertiary: Story = { args: { variant: "tertiary", children: "Cancel" } };

export const Accent: Story = {
  args: { variant: "accent", children: "Track a parcel", suffix: <ArrowRight className="rtl:-scale-x-100" /> },
  parameters: { docs: { description: { story: "Brand orange. Use at most one per view." } } },
};

export const Error: Story = { args: { variant: "error", children: "Revoke key", prefix: <Trash2 /> } };

export const Warning: Story = { args: { variant: "warning", children: "Hold shipment" } };

export const WithPrefix: Story = { args: { prefix: <Plus />, children: "New shipment" } };

export const Loading: Story = {
  args: { loading: true, children: "Saving" },
  parameters: { docs: { description: { story: "Blocks clicks but stays focusable (aria-busy)." } } },
};

export const Disabled: Story = { args: { disabled: true } };

export const IconOnly: Story = {
  args: { shape: "square", variant: "secondary", "aria-label": "Packages", children: <Package /> },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="tiny">
        Tiny
      </Button>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-3">
      {(["primary", "secondary", "tertiary", "accent", "error", "warning"] as const).map((variant) => (
        <Button key={variant} {...args} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};
