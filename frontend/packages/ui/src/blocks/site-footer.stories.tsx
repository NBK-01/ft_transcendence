import type { Meta, StoryObj } from "@storybook/react-vite";

import { SiteFooter } from "@trans/ui/blocks/site-footer";

const meta = {
  title: "Blocks/Site Footer",
  component: SiteFooter,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "On every page: the Privacy Policy and Terms of Service links (required by the subject), plus the theme and language switchers. The links are relative to the app's router basename.",
      },
    },
  },
} satisfies Meta<typeof SiteFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** For pages that already show the switchers elsewhere, like the auth layout. */
export const WithoutSwitchers: Story = { args: { showSwitchers: false } };
