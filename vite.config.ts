import { promises as fs } from "node:fs";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { glob } from "glob";
import { defineConfig, type Plugin } from "vite";
import dts from "vite-plugin-dts";

// Vite's lib mode only emits JS for the glob'd entries; styles.css has to be
// copied across so `@batthewz/response-ui-renderer/styles` resolves.
function copyCssAssets(): Plugin {
  return {
    name: "copy-css-assets",
    apply: "build",
    async closeBundle() {
      const files = await glob("src/**/*.css");
      await Promise.all(
        files.map(async (file) => {
          const dest = path.join("dist", path.relative("src", file));
          await fs.mkdir(path.dirname(dest), { recursive: true });
          await fs.copyFile(file, dest);
        }),
      );
    },
  };
}

// Library build for @batthewz/response-ui-renderer.
// ESM only, preserveModules for subpath imports, every peer externalised.
// Mirrors the build shape of @batthewz/response-ui-react-components.

const entries = Object.fromEntries(
  glob
    .sync("src/**/*.{ts,tsx}", {
      ignore: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
    })
    .map((file) => [
      path.relative("src", file.slice(0, file.length - path.extname(file).length)),
      path.resolve(file),
    ]),
);

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["src/**/*"],
      exclude: ["src/**/*.test.*"],
      rollupTypes: false,
      entryRoot: "src",
      outDir: "dist",
      compilerOptions: { declarationMap: true },
    }),
    copyCssAssets(),
  ],
  build: {
    lib: { entry: entries, formats: ["es"] },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        /^@floating-ui\/.+/,
        /^lucide-react($|\/)/,
        /^@batthewz\/response-ui-react-components($|\/)/,
        /^zod($|\/)/,
      ],
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
        entryFileNames: "[name].js",
      },
    },
    sourcemap: true,
    minify: false,
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
