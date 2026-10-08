import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** Used by Storybook only — the library itself ships as source to the apps. */
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
