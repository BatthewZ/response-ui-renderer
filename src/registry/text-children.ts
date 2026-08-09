import table from "./text-children.json";

/**
 * Components whose `children` the library types as a **string it parses**,
 * rather than as nodes it places.
 *
 * A document supplies nodes, and the renderer turns each one into an element.
 * Handed to a root like this they arrive where a string was expected and the
 * parser dies on the first `.replace` — the component is not degraded, it is
 * gone, and the whole subtree with it. The renderer resolves them to text
 * instead, which is the only reading that leaves the root's own contract intact:
 * it stays the only parser, the document stays the only author.
 *
 * The value is the wire contract for how those children combine, so it belongs
 * in the reference an author writes against. Hand-maintained and therefore
 * drift-prone, so `contracts.test.ts` reads the installed library's own
 * declarations and fails when a component gains or loses string `children`.
 *
 * Held as JSON so `scripts/gen-viewspec-doc.mjs` renders the same bytes into
 * VIEWSPEC.md that the renderer binds at runtime.
 */
export const TEXT_CHILDREN: Readonly<Record<string, string>> = table;
