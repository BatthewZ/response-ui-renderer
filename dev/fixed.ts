import { exampleSpecs } from "../src/examples";
import type { ViewSpec } from "../src/spec";

/**
 * Grid-corrected copies of the real fixtures, derived from the SAME data — only
 * the layout container changes. The verbatim fixtures stay untouched (they are
 * the "real generator output renders" test corpus); these show what those same
 * documents look like laid out with the primitives the base library now offers.
 *
 * Two swaps:
 *  - `MasonryGrid` (masonry, unequal heights + clipping) → `Grid` (uniform).
 *  - a wrapping `Row {wrap}` over a repeated card → an equal-column `Grid`.
 *
 * This gives equal-width columns, equal-height card boxes, and no clipping. It
 * does NOT pin the pricing cards' footer buttons to the exact bottom: `Card` is
 * a plain block, so its content stays content-height inside the stretched cell.
 * Pinning a footer needs a Card/Stack "fill" affordance the library doesn't
 * expose yet — a deliberate non-goal here.
 *
 * Nodes are treated as loose records — the transform is structural and this file
 * is a dev tool, not part of the typed public surface.
 */

type Node = Record<string, unknown>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const isNode = (n: unknown): n is Node => !!n && typeof n === "object";
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** MasonryGrid.Item only wraps one child for masonry animation; a Grid cell needs none. */
function unwrap(node: unknown): unknown {
  if (isNode(node) && node.component === "MasonryGrid.Item") {
    const kids = asArray(node.children);
    if (kids.length === 1) return kids[0];
  }
  return node;
}

const hasEach = (children: unknown): boolean =>
  asArray(children).some((c) => isNode(c) && "$each" in c);

const gapOf = (props: unknown): string =>
  isNode(props) && typeof props.gap === "string" ? props.gap : "r4";

function transform(node: unknown): unknown {
  if (!isNode(node)) return node;

  if ("$each" in node) {
    node.node = transform(unwrap(node.node));
    return node;
  }
  if ("$cond" in node) {
    node.then = transform(node.then);
    if (node.else) node.else = transform(node.else);
    return node;
  }
  if (!("component" in node)) return node;

  if (node.component === "MasonryGrid") {
    node.component = "Grid";
    node.props = { columns: (node.props as Node)?.columns ?? { base: 1, md: 3 }, gap: "r4" };
  } else if (node.component === "Row" && hasEach(node.children)) {
    node.component = "Grid";
    node.props = { columns: { base: 1, sm: 2, lg: 3 }, gap: gapOf(node.props) };
  } else if (
    node.component === "Row" &&
    asArray(node.children).length > 1 &&
    asArray(node.children).every((c) => isNode(c) && c.component === "StatCard")
  ) {
    node.component = "Grid";
    node.props = { columns: { base: 2 }, gap: gapOf(node.props) };
  }

  if (Array.isArray(node.children)) {
    node.children = node.children.map((c) => transform(unwrap(c)));
  }
  return node;
}

function toGrid(spec: ViewSpec): ViewSpec {
  const copy = clone(spec) as unknown as { title: string; root: unknown };
  copy.root = transform(copy.root);
  copy.title = `${copy.title} (Grid)`;
  return copy as unknown as ViewSpec;
}

export const gridExamples: [string, ViewSpec][] = [
  ["product-landing · Grid", toGrid(exampleSpecs.productLanding as ViewSpec)],
  ["pricing-table · Grid", toGrid(exampleSpecs.pricingTable as ViewSpec)],
  ["team-directory · Grid", toGrid(exampleSpecs.teamDirectory as ViewSpec)],
];
