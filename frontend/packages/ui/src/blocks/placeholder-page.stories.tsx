import type { Meta, StoryObj } from "@storybook/react-vite";
import { KeyRound, Package } from "lucide-react";

import { PlaceholderPage } from "@trans/ui/blocks/placeholder-page";

const meta = {
  title: "Blocks/Placeholder Page",
  component: PlaceholderPage,
  tags: ["autodocs"],
  args: {
    title: "Shipments",
    description: "Every shipment across the branches you can access.",
    icon: Package,
  },
  decorators: [(Story) => <div className="w-[48rem] max-w-[calc(100vw-2rem)]">{Story()}</div>],
  parameters: {
    docs: {
      description: {
        component:
          "A route stub inside the app shell: the page's real header, then a \"coming soon\" state until the feature lands.",
      },
    },
  },
} satisfies Meta<typeof PlaceholderPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ApiKeys: Story = {
  args: { title: "API keys", description: "Keys that let partner systems use the public API.", icon: KeyRound },
};
