import type { StorybookConfig } from "@storybook/react-vite";

// Vite plugins (React + Tailwind) come from ../vite.config.ts.
const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  core: { disableTelemetry: true },
};

export default config;
