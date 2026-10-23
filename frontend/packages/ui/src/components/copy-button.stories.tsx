import type { Meta, StoryObj } from "@storybook/react-vite";

import { CopyButton } from "@trans/ui/components/copy-button";

const meta = {
  title: "Components/Copy Button",
  component: CopyButton,
  tags: ["autodocs"],
  args: { value: "TRK-8F3A21" },
  parameters: {
    docs: {
      description: {
        component:
          "Copies `value` to the clipboard and shows a check for 2 s. If the browser blocks clipboard access, a toast asks the user to copy by hand. Icon-only, so `label` (also the tooltip) should say what is copied.",
      },
    },
  },
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: { label: "Copy tracking ID" },
};

export const NextToTrackingId: Story = {
  args: { label: "Copy tracking ID" },
  render: (args) => (
    <div className="flex items-center gap-2">
      <h1 className="font-mono text-heading-32" dir="ltr">
        {args.value}
      </h1>
      <CopyButton {...args} />
    </div>
  ),
  parameters: { docs: { description: { story: "As used in the shipment page header." } } },
};
