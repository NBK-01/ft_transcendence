import type { Meta, StoryObj } from "@storybook/react-vite";
import { useTranslation } from "react-i18next";

import { LegalLayout, type LegalDocument } from "@trans/ui/blocks/legal-layout";

/** Reads the real translated content, so the toolbar language switch applies. */
function LegalStory({ kind }: { kind: "privacy" | "terms" }) {
  const { t } = useTranslation("common");
  const doc = t(`legal.${kind}`, { returnObjects: true }) as LegalDocument;
  return <LegalLayout document={doc} updatedAt="2026-10-07" />;
}

const meta = {
  title: "Blocks/Legal Layout",
  component: LegalStory,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { kind: "privacy" },
} satisfies Meta<typeof LegalStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PrivacyPolicy: Story = {};
export const TermsOfService: Story = { args: { kind: "terms" } };
