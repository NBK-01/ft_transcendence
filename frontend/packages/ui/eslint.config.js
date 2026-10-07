import config from "@trans/config/eslint";

export default [
  ...config,
  {
    // Library files co-locate variants/hooks with components (shadcn convention).
    rules: { "react-refresh/only-export-components": "off" },
  },
];
