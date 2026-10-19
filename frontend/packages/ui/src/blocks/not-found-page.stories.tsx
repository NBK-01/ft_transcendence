import type { Meta, StoryObj } from "@storybook/react-vite";

import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

const meta = {
  title: "Blocks/Not Found Page",
  component: NotFoundPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "The router's catch-all route, outside the app shell. `homeHref` is where its button goes.",
      },
    },
  },
} satisfies Meta<typeof NotFoundPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
