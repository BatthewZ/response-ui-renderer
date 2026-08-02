import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Local playground for the renderer. Imports the package from `src` (not the
// built dist), so edits are hot-reloaded with no rebuild step.
export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 5180, open: true },
});
