import type { Meta, StoryObj } from "@storybook/react-vite";

import { LanguageSwitcher } from "@trans/ui/blocks/language-switcher";
import { ThemeSwitcher } from "@trans/ui/blocks/theme-switcher";

const meta = {
  title: "Blocks/Switchers",
  component: ThemeSwitcher,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Theme: system / light / dark (stored per browser). Language: EN / FR / AR — Arabic flips `<html dir>` to RTL. In Storybook the toolbar overrides the theme.",
      },
    },
  },
} satisfies Meta<typeof ThemeSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Theme: Story = {};

export const Language: Story = { render: () => <LanguageSwitcher /> };

export const Together: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <ThemeSwitcher />
      <LanguageSwitcher />
    </div>
  ),
};
