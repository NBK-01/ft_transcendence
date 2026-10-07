import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Teach tailwind-merge about the Geist type presets in globals.css.
 * Without this, `text-heading-32` is read as a text *colour* and would
 * silently cancel out `text-gray-900` (or vice versa).
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "heading-72",
            "heading-64",
            "heading-56",
            "heading-48",
            "heading-40",
            "heading-32",
            "heading-24",
            "heading-20",
            "heading-16",
            "heading-14",
            "label-20",
            "label-18",
            "label-16",
            "label-14",
            "label-13",
            "label-12",
            "label-mono-14",
            "label-mono-13",
            "label-mono-12",
            "copy-24",
            "copy-20",
            "copy-18",
            "copy-16",
            "copy-14",
            "copy-13",
            "copy-mono-13",
            "button-16",
            "button-14",
            "button-12",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
