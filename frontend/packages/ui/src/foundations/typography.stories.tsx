import type { Meta, StoryObj } from "@storybook/react-vite";
import { useTranslation } from "react-i18next";

/**
 * The type presets (src/styles/globals.css). Each bundles size, line height,
 * weight and tracking, so views never hand-tune text. Geist for Latin, IBM
 * Plex Sans Arabic for Arabic (switch the Language toolbar to see it, and
 * headings losing their negative tracking, which breaks joined letters).
 */
const meta = {
  title: "Foundations/Typography",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** [class, size / line height in px, where it's used]. Class names stay literal so Tailwind generates them. */
type Preset = [string, string, string];

const GROUPS: { title: string; note: string; presets: Preset[] }[] = [
  {
    title: "Heading",
    note: "Semibold, tightened. Page titles are 32, card titles 20.",
    presets: [
      ["text-heading-72", "72 / 72", "Marketing hero"],
      ["text-heading-64", "64 / 64", "Marketing hero"],
      ["text-heading-56", "56 / 56", "Marketing hero"],
      ["text-heading-48", "48 / 56", "Landing sections"],
      ["text-heading-40", "40 / 48", "Landing sections"],
      ["text-heading-32", "32 / 40", "Page titles"],
      ["text-heading-24", "24 / 32", "Section titles, big numbers"],
      ["text-heading-20", "20 / 26", "Card and dialog titles"],
      ["text-heading-16", "16 / 24", "Small section titles"],
      ["text-heading-14", "14 / 20", "Group labels"],
    ],
  },
  {
    title: "Label",
    note: "One line: names, menu items, table cells, form labels. Mono for IDs and codes.",
    presets: [
      ["text-label-20", "20 / 32", "Large labels"],
      ["text-label-18", "18 / 20", "Large labels"],
      ["text-label-16", "16 / 20", "Thread titles"],
      ["text-label-14", "14 / 20", "Default label, table cells"],
      ["text-label-13", "13 / 16", "Secondary labels"],
      ["text-label-12", "12 / 16", "Captions, badges"],
      ["text-label-mono-14", "14 / 20", "Tracking IDs"],
      ["text-label-mono-13", "13 / 20", "Codes in tables"],
      ["text-label-mono-12", "12 / 16", "Eyebrows, small codes"],
    ],
  },
  {
    title: "Copy",
    note: "Running text, several lines: descriptions, messages, legal pages.",
    presets: [
      ["text-copy-24", "24 / 36", "Lead paragraphs"],
      ["text-copy-20", "20 / 36", "Lead paragraphs"],
      ["text-copy-18", "18 / 28", "Landing copy"],
      ["text-copy-16", "16 / 24", "Page descriptions"],
      ["text-copy-14", "14 / 22", "Default body text"],
      ["text-copy-13", "13 / 20", "Secondary text, emails under names"],
      ["text-copy-mono-13", "13 / 20", "Code blocks, API keys"],
    ],
  },
  {
    title: "Button",
    note: "Medium weight, set by the Button sizes.",
    presets: [
      ["text-button-16", "16 / 20", "Large buttons"],
      ["text-button-14", "14 / 20", "Default buttons"],
      ["text-button-12", "12 / 16", "Small buttons"],
    ],
  },
];

const SAMPLES: Record<string, string> = {
  en: "Your parcel left the Lyon hub",
  fr: "Votre colis a quitté le hub de Lyon",
  ar: "غادر طردك مركز ليون",
};

/** Every preset with its size and where it's used, in the toolbar's language. */
export const Scale: Story = {
  render: function Render() {
    const { i18n } = useTranslation();
    const sample = SAMPLES[i18n.language] ?? SAMPLES.en;
    return (
      <div className="flex max-w-5xl flex-col gap-12">
        {GROUPS.map((group) => (
          <section key={group.title} className="flex flex-col gap-4" aria-labelledby={`type-${group.title}`}>
            <div className="flex flex-col gap-1 border-b border-gray-alpha-400 pb-3">
              <h2 id={`type-${group.title}`} className="text-heading-20">
                {group.title}
              </h2>
              <p className="text-copy-14 text-gray-900">{group.note}</p>
            </div>
            {group.presets.map(([className, size, use]) => (
              <div key={className} className="grid gap-2 sm:grid-cols-[14rem_1fr] sm:items-baseline">
                <div className="flex flex-col">
                  <code className="text-label-mono-13 text-gray-1000" dir="ltr">
                    {className}
                  </code>
                  <span className="text-label-12 text-gray-900">
                    {size} · {use}
                  </span>
                </div>
                <p className={`${className} min-w-0 truncate text-gray-1000`}>{sample}</p>
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  },
};

/** The two families: sans (Geist, then IBM Plex Sans Arabic) and mono (Geist Mono). */
export const Families: Story = {
  render: () => (
    <dl className="grid max-w-3xl gap-6">
      {[
        ["font-sans", "Geist, IBM Plex Sans Arabic", "Everything", "ShipTrack · شحن"],
        ["font-mono", "Geist Mono", "Tracking IDs, keys, code", "TRK-4A6F90 · stk_9f2c…"],
      ].map(([className, family, use, sample]) => (
        <div key={className} className="flex flex-col gap-1">
          <dt className="text-label-13 text-gray-900">
            <code dir="ltr">{className}</code> · {family} · {use}
          </dt>
          <dd className={`${className} text-heading-32`}>{sample}</dd>
        </div>
      ))}
    </dl>
  ),
};
