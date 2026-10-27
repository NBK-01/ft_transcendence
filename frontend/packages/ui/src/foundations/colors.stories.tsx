import type { Meta, StoryObj } from "@storybook/react-vite";
import { useSyncExternalStore } from "react";

import { Badge } from "@trans/ui/components/badge";

/**
 * Every colour a view may use (src/styles/globals.css). Tailwind's default
 * palette is cleared, so these are the only colours there are. Switch the
 * Theme toolbar to see the dark values.
 */
const meta = {
  title: "Foundations/Colors",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Re-renders when the theme class on <html> changes (light ↔ dark). */
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** A token's value in the current theme, e.g. "--gray-1000" → "#171717". */
function useTokenValue(name: string) {
  return useSyncExternalStore(
    subscribeToTheme,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => "",
  );
}

/** Each step of a scale has one job (Geist's system). */
const JOBS: Record<number, string> = {
  100: "Background",
  200: "Background, hover",
  300: "Background, active",
  400: "Border",
  500: "Border, hover",
  600: "Border, active",
  700: "Solid background",
  800: "Solid background, hover",
  900: "Secondary text, icons",
  1000: "Primary text, icons",
};

type Scale = { name: string; steps: number[]; note: string };

const SCALES: Scale[] = [
  { name: "background", steps: [100, 200], note: "Pages and cards (100); the sidebar and wells (200)." },
  {
    name: "gray",
    steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
    note: "Everything neutral: surfaces, borders, text. Also the inactive and draft statuses.",
  },
  {
    name: "gray-alpha",
    steps: [100, 200, 300, 400, 500, 600],
    note: "See-through grays, for hovers and borders that sit on any background.",
  },
  {
    name: "orange",
    steps: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
    note: "The brand accent, used sparingly: focus ring, active nav, links, the one accent button per view. Never a status.",
  },
  { name: "blue", steps: [100, 200, 400, 700, 900], note: "Status: in progress, information." },
  { name: "green", steps: [100, 200, 400, 700, 900], note: "Status: done, active, online." },
  { name: "amber", steps: [100, 200, 400, 700, 900], note: "Status: waiting on someone, a warning." },
  { name: "red", steps: [100, 200, 400, 700, 900], note: "Status: failed, cancelled; destructive actions and errors." },
];

function Swatch({ token, step }: { token: string; step: number }) {
  const value = useTokenValue(`--${token}`);
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div
        className="h-14 rounded-lg ring-1 ring-gray-alpha-400 ring-inset"
        style={{ background: `var(--${token})` }}
        aria-hidden="true"
      />
      <figcaption className="flex min-w-0 flex-col">
        <span className="truncate text-label-13 font-medium text-gray-1000">{token}</span>
        <span className="truncate text-label-mono-12 text-gray-900">{value}</span>
        <span className="truncate text-label-12 text-gray-900">{JOBS[step]}</span>
      </figcaption>
    </figure>
  );
}

function ScaleRow({ scale }: { scale: Scale }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`scale-${scale.name}`}>
      <div className="flex flex-col gap-1">
        <h2 id={`scale-${scale.name}`} className="text-heading-20">
          {scale.name}
        </h2>
        <p className="text-copy-14 text-gray-900">{scale.note}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {scale.steps.map((step) => (
          <Swatch key={step} token={`${scale.name}-${step}`} step={step} />
        ))}
      </div>
    </section>
  );
}

/** Every scale, with the job of each step and its value in the current theme. */
export const Palette: Story = {
  render: () => (
    <div className="flex max-w-5xl flex-col gap-10">
      {SCALES.map((scale) => (
        <ScaleRow key={scale.name} scale={scale} />
      ))}
    </div>
  ),
};

/** The colours a status takes, through Badge: a status never uses orange (that's "brand", for highlights). */
export const Statuses: Story = {
  render: () => (
    <ul className="flex flex-wrap gap-3">
      {(
        [
          ["gray", "Draft, inactive"],
          ["blue", "In progress"],
          ["amber", "Waiting on someone"],
          ["green", "Done"],
          ["red", "Failed, cancelled"],
        ] as const
      ).map(([variant, label]) => (
        <li key={variant}>
          <Badge variant={variant}>{label}</Badge>
        </li>
      ))}
    </ul>
  ),
};
