import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "@trans/ui/components/field";
import { Textarea } from "@trans/ui/components/textarea";

const meta = {
  title: "Components/Forms/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: { placeholder: "Fragile: keep upright.", "aria-label": "Delivery notes" },
  decorators: [(Story) => <div className="w-80">{Story()}</div>],
  parameters: {
    docs: { description: { component: "Grows with its content (`field-sizing: content`), from about three lines." } },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    defaultValue:
      "Main hub for Lebanon, including the port warehouse. Deliveries to the old town go out before 10:00 because of the market.",
  },
};

export const InField: Story = {
  render: (args) => (
    <Field label="Description" hint="Up to 200 characters.">
      <Textarea {...args} />
    </Field>
  ),
};

export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "…" } };

export const Disabled: Story = { args: { disabled: true, defaultValue: "Closed after the move to Lyon" } };
