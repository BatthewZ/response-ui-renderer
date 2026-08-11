import { isComponentNode, isCondNode, isEachNode, type ViewNode, type ViewSpec } from "../spec";
import { keyToPath, type NodePath, pathToKey, ROOT_PATH } from "./tree";

/**
 * How a rendered element says which node in the document drew it.
 *
 * The canvas is the real render — the components, themed, interactive, laid out
 * exactly as the document will look — and a builder has to be able to point at
 * it. Rather than teach the renderer to mark up its output, the *document* is
 * copied with one extra prop per node before it is handed over, and the
 * components pass it to their root element the way they pass any other
 * attribute. Nothing in the renderer knows this is happening, the document that
 * is saved never carries it, and a component that does not forward unknown props
 * simply is not clickable — its parent is, and the layer tree can always reach
 * it.
 */
export const BUILDER_PATH_ATTR = "data-rui-builder-path";

export const BUILDER_PATH_SELECTOR = `[${BUILDER_PATH_ATTR}]`;

/**
 * The document with every component node carrying its own path.
 *
 * Structural nodes are walked but not marked: a `$each` renders its child once
 * per row, so every copy carries the same path — which is right, because they
 * are all the same node in the document, and selecting any of them selects it.
 */
export function instrument(node: ViewNode, path: NodePath = ROOT_PATH): ViewNode {
  if (typeof node === "string") return node;

  if (isEachNode(node)) return { ...node, node: instrument(node.node, [...path, "node"]) };

  if (isCondNode(node)) {
    const next = { ...node, then: instrument(node.then, [...path, "then"]) };
    if (node.else !== undefined) next.else = instrument(node.else, [...path, "else"]);
    return next;
  }

  if (!isComponentNode(node)) return node;

  const marked: ViewNode = {
    ...node,
    props: { ...node.props, [BUILDER_PATH_ATTR]: pathToKey(path) },
  };
  if (node.children) {
    marked.children = node.children.map((child, index) => instrument(child, [...path, index]));
  }
  return marked;
}

export const instrumentSpec = (spec: ViewSpec): ViewSpec => ({
  ...spec,
  root: instrument(spec.root),
});

/**
 * The node an element belongs to — itself, or the nearest marked ancestor.
 *
 * A component may render several elements and forward the attribute to only
 * one, and a component that forwards nothing at all leaves its children marked
 * and itself not. Walking up rather than requiring an exact hit is what makes
 * both cases land somewhere sensible instead of nowhere.
 */
export function pathFromElement(element: Element | null | undefined): NodePath | null {
  const marked = element?.closest(BUILDER_PATH_SELECTOR);
  const key = marked?.getAttribute(BUILDER_PATH_ATTR);
  return key === null || key === undefined ? null : keyToPath(key);
}

/**
 * The first element drawn for a node, for measuring where to put an outline.
 *
 * The key needs no escaping: a path is digits, dots and the three slot names,
 * and it sits inside quotes.
 */
export function elementForPath(root: ParentNode, path: NodePath): Element | null {
  return root.querySelector(`[${BUILDER_PATH_ATTR}="${pathToKey(path)}"]`);
}
