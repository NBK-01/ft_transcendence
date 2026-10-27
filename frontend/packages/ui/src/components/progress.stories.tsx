import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { Progress } from "@trans/ui/components/progress";

const meta = {
  title: "Components/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: {
    value: 0.42,
    label: "Upload progress",
    caption: "42% uploaded",
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { value: 0, caption: "0% uploaded" },
};

export const Complete: Story = {
  args: { value: 1, caption: "100% uploaded" },
};

export const NoCaption: Story = {
  args: { caption: undefined },
};

/** Ticks up on its own, the way a real upload's `onProgress` callback would drive it. */
export const Animated: Story = {
  render: function Render() {
    const [value, setValue] = useState(0);

    useEffect(() => {
      const id = setInterval(() => {
        setValue((current) => (current >= 1 ? 0 : Math.min(1, current + 0.1)));
      }, 400);
      return () => clearInterval(id);
    }, []);

    return <Progress value={value} label="Upload progress" caption={`${Math.round(value * 100)}% uploaded`} />;
  },
};
