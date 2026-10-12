import type { Meta, StoryObj } from "@storybook/react-vite";

import { LegalPage } from "@trans/ui/blocks/legal-layout";

/** Uses the real translated content, so the toolbar language switch applies. */
const meta = {
  title: "Blocks/Legal Layout",
  component: LegalPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { kind: "privacy" },
} satisfies Meta<typeof LegalPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrivacyPolicy: Story = {};
export const TermsOfService: Story = { args: { kind: "terms" } };
