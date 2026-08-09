/**
 * `import doc from "./x.md?raw"` — the file's text, inlined at build time.
 *
 * Declared narrowly rather than by referencing `vite/client`, which would put
 * ambient globals for CSS, images, workers and `import.meta.env` into every
 * consumer that compiles this package's shipped `src/`. One import shape is
 * used here; only that one is declared.
 */
declare module "*.md?raw" {
  const content: string;
  export default content;
}
