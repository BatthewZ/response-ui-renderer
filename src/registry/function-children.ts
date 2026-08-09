import table from "./function-children.json";

/**
 * Components whose `children` the library types as a **function it calls** with
 * its own state, rather than as nodes it places.
 *
 * A document supplies nodes. Without this the nodes land on the prop the root
 * then invokes — `children is not a function` — and the component dies whole.
 * The renderer instead hands the root a function that renders those nodes with
 * the root's own argument bound as reference names, exactly as `$each` binds a
 * row: the data stays the component's, the presentation becomes the document's.
 *
 * `args` IS the wire contract — those are the names a document may `$ref` or
 * `$each` over inside these children. Hand-maintained and therefore drift-prone,
 * so `contracts.test.ts` reads the installed library's own declarations and
 * fails when a component gains or loses a function `children`, or when its
 * arguments are renamed. `note` is curated: how often a root calls the function
 * cannot be read off a type, and it decides what a document has to write.
 *
 * Held as JSON so `scripts/gen-viewspec-doc.mjs` renders the same bytes into
 * VIEWSPEC.md that the renderer binds at runtime.
 */
export type FunctionChildren = { args: readonly string[]; note: string };

export const FUNCTION_CHILDREN: Readonly<Record<string, FunctionChildren>> = table;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * What the root handed its `children` function, as reference names.
 *
 * The library's own roots take **one options object**, and that one is spread
 * whole rather than picked by `declared`: a name the library adds arrives
 * working and the gate reports the doc is behind, where picking would drop it
 * silently — the failure this package fears most.
 *
 * A render prop taking **positional** arguments — `children(row, index)`, the
 * conventional React shape — carries no names at all, so there `declared` is
 * the only thing that can supply them and is zipped against what arrived.
 * Without it a host could declare `args` for its own component, watch it
 * render, and get a subtree where every reference resolved silently to nothing.
 */
export function argsToVars(
  received: readonly unknown[],
  declared?: readonly string[],
): Record<string, unknown> {
  const positional =
    received.length > 1 || (received.length === 1 && !isPlainObject(received[0]));
  if (declared && declared.length > 0 && positional) {
    return Object.fromEntries(declared.map((name, index) => [name, received[index]]));
  }
  return isPlainObject(received[0]) ? { ...received[0] } : {};
}
