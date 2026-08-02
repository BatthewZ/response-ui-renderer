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

/** The names a document can reach inside this component's children, if any. */
export function functionChildrenArgs(component: string): readonly string[] | undefined {
  return Object.hasOwn(FUNCTION_CHILDREN, component)
    ? FUNCTION_CHILDREN[component].args
    : undefined;
}

/**
 * The argument object as reference names.
 *
 * Spread whole rather than picked by the table above: a name the library adds
 * arrives working and the gate reports the doc is behind, where picking would
 * drop it silently — the failure this package fears most.
 */
export function argsToVars(args: unknown): Record<string, unknown> {
  if (typeof args !== "object" || args === null || Array.isArray(args)) return {};
  return { ...(args as Record<string, unknown>) };
}
