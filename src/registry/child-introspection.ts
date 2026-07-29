/**
 * Components that reach into their own children, and what the renderer can do
 * about each.
 *
 * Two shapes, one cause: the renderer puts a `NodeRenderer` — and normally a
 * `NodeErrorBoundary` — between a parent and the element a document described.
 *
 * 1. **Prop injection** (`cloneElement(child, props)`). Recoverable: render the
 *    child without its own boundary and let `NodeRenderer` forward whatever was
 *    injected onto the element it creates. `Tooltip` and the `asChild` triggers
 *    work again.
 *
 * 2. **Identity checks** (`child.type === Avatar`). NOT recoverable at any
 *    depth: the child element's type is `NodeRenderer`, never the library's
 *    component, so the comparison is false however many wrappers are removed.
 *    Each of these has an explicit prop that does the same job, and the
 *    validator tells the author to pass it rather than leaving the feature
 *    silently absent.
 *
 * Both lists are hand-maintained and drift-prone, so `contracts.test.ts` reads
 * the installed library's own source and fails when a component starts doing
 * either without being named here.
 */

/** Parents whose injected props the renderer can forward. `"asChild"` = only on request. */
export const CHILD_INSPECTING_PARENTS: ReadonlyMap<string, "always" | "asChild"> = new Map([
  ["Tooltip", "always"],
  ["DropdownMenu.Trigger", "asChild"],
  ["Popover.Trigger", "asChild"],
  ["HoverCard.Trigger", "asChild"],
]);

/**
 * Parents that decide something by comparing a child's type, and the prop a
 * document must set instead. Surfaced as validation warnings — the feature is
 * not broken, it just cannot be inferred through a renderer.
 */
export const IDENTITY_CHECKED_PARENTS: Readonly<Record<string, string>> = {
  Hero: 'set "overlay": true — Hero cannot detect a Hero.Background through the renderer',
  AvatarGroup: 'set "size" on each Avatar — the group\'s size cannot reach them through the renderer',
  "Table.Body": 'set "index" on each Table.Row — automatic zebra numbering cannot see through the renderer',
  Breadcrumbs: "a Breadcrumbs.Separator child is counted as a crumb; prefer the root's own separator prop",
  "Combobox.Content": 'give every Combobox.Item an explicit "index"',
};

/**
 * Library modules that clone or identity-check their children, for the drift
 * test. `use-form.tsx` is excluded deliberately: its `target.type === "checkbox"`
 * is a DOM input type, not a child element.
 */
export const CHILD_INSPECTING_MODULES: readonly string[] = [
  "components/form/Combobox.tsx",
  "components/ui/Avatar.tsx",
  "components/ui/Breadcrumbs.tsx",
  "components/ui/DropdownMenu.tsx",
  "components/ui/Hero.tsx",
  "components/ui/HoverCard.tsx",
  "components/ui/Popover.tsx",
  "components/ui/Table.tsx",
  "components/ui/Tooltip.tsx",
];

export function inspectsChildren(
  component: string,
  props: Readonly<Record<string, unknown>> | undefined,
): boolean {
  const mode = CHILD_INSPECTING_PARENTS.get(component);
  if (mode === undefined) return false;
  return mode === "always" || props?.asChild === true;
}

/**
 * ARIA attributes whose value is a space-separated IDREF *list*. A parent
 * appends its own id to whatever the child already carried; through the renderer
 * it cannot see the document's value, so the merge has to happen here.
 */
const IDREF_LIST_PROPS: ReadonlySet<string> = new Set([
  "aria-describedby",
  "aria-labelledby",
  "aria-controls",
  "aria-owns",
]);

/**
 * Merges a prop a cloning parent injected with one the document already set.
 *
 * Two handlers on one key both need to run — the parent's is what opens the
 * tooltip, the document's is what the author asked for — so they are composed
 * rather than one silently winning. Anything else is a plain overwrite, because
 * the parent is injecting a ref or an aria attribute it owns.
 *
 * A parent computes what to inject from the child element's own props, which are
 * the renderer's, never the document's — so an injected `undefined` means "I
 * found nothing to set", not "clear what is there".
 */
export function composeProp(key: string, existing: unknown, injected: unknown): unknown {
  if (injected === undefined) return existing;

  if (typeof existing === "function" && typeof injected === "function") {
    return (...args: unknown[]) => {
      (existing as (...a: unknown[]) => unknown)(...args);
      (injected as (...a: unknown[]) => unknown)(...args);
    };
  }

  if (IDREF_LIST_PROPS.has(key) && typeof existing === "string" && typeof injected === "string") {
    return existing.split(/\s+/).includes(injected) ? existing : `${existing} ${injected}`;
  }

  return injected;
}
