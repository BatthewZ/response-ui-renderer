import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // `dev/` is a demo, but the published site is built from it and the outline
    // it derives is the only thing standing between a regenerated reference and
    // a page split mid-code-fence. Gates that stop at `src/` do not see that.
    include: ["src/**/*.test.{ts,tsx}", "dev/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./test-setup.ts"],
  },
});
