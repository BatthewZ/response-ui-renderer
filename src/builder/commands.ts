import { type ComponentNode, isComponentNode, type ViewNode } from "../spec";
import { canMove, type DropTarget, resolveDrop } from "./drop";
import {
  type BuilderDocument,
  childEntries,
  insertAt,
  lastStep,
  moveNode,
  nodeAt,
  type NodePath,
  parentPath,
  removeAt,
  replaceAt,
  ROOT_PATH,
  updateAt,
} from "./tree";

/**
 * Every edit the builder makes to a document, as a function of the document.
 *
 * Each one answers with the document *and* where the selection should be
 * afterwards, because those two are one decision: a node that has just been
 * dropped should be the node the inspector is describing, and a node that has
 * just been deleted must not leave the inspector holding a path that now points
 * at whatever slid up into its place.
 *
 * Nothing here mutates. A history of documents is then a list of the values
 * these returned, which is the whole of undo.
 */
export type EditResult = {
  document: BuilderDocument;
  /**
   * Where the selection goes. `null` clears it; **`undefined` leaves it alone**,
   * which is what a refused edit wants — an aborted drag that emptied the
   * properties panel would be reporting a change that did not happen.
   */
  selection?: NodePath | null;
};

/** Nothing happened: same document, same selection, and no history entry. */
const refused = (document: BuilderDocument): EditResult => ({ document });


/**
 * Every literal `id` the document already spends.
 *
 * Walked from the whole document, not from one parent: an id has to be unique
 * on the page, and the renderer's node keys are derived from it too.
 */
function usedIds(node: ViewNode | null, found = new Set<string>()): Set<string> {
  if (node === null) return found;
  if (isComponentNode(node)) {
    const id = node.props?.id;
    if (typeof id === "string" && id !== "") found.add(id);
  }
  for (const entry of childEntries(node)) usedIds(entry.node, found);
  return found;
}

/**
 * The subtree with any `id` the document is already using renamed.
 *
 * Insertion templates carry real ids — `profile-full-name`, `delete-draft` —
 * because they were lifted from documents that used them. Dropping the same
 * component twice, or duplicating one, then puts the same id on the page twice:
 * two `<label for>` pointing at one field. Two clicks reach it: dropping the
 * `Input` template twice puts `profile-full-name` on the page twice.
 *
 * `name` is deliberately left alone: a radio group shares one on purpose. So is
 * `value`, which is a score or a reading, not an identity — a `Rating` renamed
 * to make it unique would be showing a different number of stars. Both of those
 * still reach the renderer's node keys, which is the renderer's to resolve and
 * not a document defect to edit around.
 *
 * References to the renamed id *inside the same subtree* move with it, so a
 * dialog that an action in the same drop targets still resolves.
 */
function withFreshIds(root: ViewNode | null, node: ViewNode): ViewNode {
  const taken = usedIds(root);
  if (taken.size === 0) return node;

  const renames = new Map<string, string>();
  const claim = (id: string): string => {
    let candidate = id;
    let suffix = 2;
    while (taken.has(candidate)) candidate = `${id}-${suffix++}`;
    taken.add(candidate);
    return candidate;
  };

  const plan = (current: ViewNode): void => {
    if (isComponentNode(current)) {
      const id = current.props?.id;
      if (typeof id === "string" && id !== "" && taken.has(id) && !renames.has(id)) {
        renames.set(id, claim(id));
      }
    }
    for (const entry of childEntries(current)) plan(entry.node);
  };
  plan(node);
  if (renames.size === 0) return node;

  const rewrite = (value: unknown): unknown => {
    if (typeof value === "string") return renames.get(value) ?? value;
    if (Array.isArray(value)) return value.map(rewrite);
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, rewrite(item)]),
      );
    }
    return value;
  };

  const apply = (current: ViewNode): ViewNode => {
    if (!isComponentNode(current)) return current;
    const next: ComponentNode = { ...current };
    if (current.props) next.props = rewrite(current.props) as Record<string, unknown>;
    if (current.children) next.children = current.children.map(apply);
    return next;
  };

  return apply(node);
}

/**
 * Drops a new node onto the document.
 *
 * The first drop onto an empty canvas becomes the root, whatever it was aimed
 * at: a document has exactly one root, and refusing the first drop because
 * there is nothing to aim at would leave the canvas permanently empty.
 */
export function insertNode(
  document: BuilderDocument,
  node: ViewNode,
  target: DropTarget | null,
): EditResult {
  if (document.root === null) return { document: { ...document, root: node }, selection: ROOT_PATH };
  if (target === null) return refused(document);

  const position = resolveDrop(document.root, target);
  if (position === null) return refused(document);

  const fresh = withFreshIds(document.root, node);
  return {
    document: { ...document, root: insertAt(document.root, position.parent, position.index, fresh) },
    selection: [...position.parent, position.index],
  };
}

/** Moves an existing node, or leaves the document alone if the move is refused. */
export function moveNodeTo(
  document: BuilderDocument,
  from: NodePath,
  target: DropTarget,
): EditResult {
  if (document.root === null || !canMove(document.root, from, target)) return refused(document);

  const position = resolveDrop(document.root, target);
  if (position === null) return refused(document);

  const root = moveNode(document.root, from, position.parent, position.index);
  const origin = parentPath(from);
  const step = lastStep(from);
  // Removing the node shifts everything after it down one, so the index the
  // pointer chose is not the index it ends up at.
  const landed =
    origin !== null &&
    typeof step === "number" &&
    origin.join() === position.parent.join() &&
    step < position.index
      ? position.index - 1
      : position.index;

  return { document: { ...document, root }, selection: [...position.parent, landed] };
}

/** Deletes a node and selects what contained it. */
export function removeNode(document: BuilderDocument, path: NodePath): EditResult {
  if (document.root === null) return refused(document);
  if (path.length === 0) return { document: { ...document, root: null }, selection: null };

  // A node in a `$each` or `$cond` slot cannot be removed — the slot holds
  // exactly one node and a document without it is not a document. Saying so by
  // changing nothing is right; saying so by rebuilding an identical tree is not,
  // because that lands in the history as an edit for Undo to step over.
  if (typeof lastStep(path) !== "number") return refused(document);

  return {
    document: { ...document, root: removeAt(document.root, path) },
    selection: parentPath(path),
  };
}

/** Copies a node in beside itself, and selects the copy. */
export function duplicateNode(document: BuilderDocument, path: NodePath): EditResult {
  if (document.root === null) return refused(document);

  const node = nodeAt(document.root, path);
  const parent = parentPath(path);
  const step = lastStep(path);
  if (node === null || parent === null || typeof step !== "number") return refused(document);

  return {
    document: {
      ...document,
      root: insertAt(document.root, parent, step + 1, withFreshIds(document.root, structuredClone(node))),
    },
    selection: [...parent, step + 1],
  };
}

/** Moves a node up or down among its siblings. `by` is −1 or 1. */
export function nudgeNode(document: BuilderDocument, path: NodePath, by: number): EditResult {
  if (document.root === null) return refused(document);

  const parent = parentPath(path);
  const step = lastStep(path);
  if (parent === null || typeof step !== "number") return refused(document);

  const container = nodeAt(document.root, parent);
  const count = container === null ? 0 : childEntries(container).length;
  const index = step + by;
  if (index < 0 || index >= count) return refused(document);

  return {
    document: { ...document, root: moveNode(document.root, path, parent, by < 0 ? index : index + 1) },
    selection: [...parent, index],
  };
}

/** Sets a prop, or removes it when `value` is `undefined`. */
export function setProp(
  document: BuilderDocument,
  path: NodePath,
  key: string,
  value: unknown,
): EditResult {
  if (document.root === null) return refused(document);

  const root = updateAt(document.root, path, (node) => {
    if (!isComponentNode(node)) return node;
    const props = { ...node.props };
    if (value === undefined) delete props[key];
    else props[key] = value;
    if (Object.keys(props).length === 0) {
      const without = { ...node };
      delete without.props;
      return without;
    }
    return { ...node, props };
  });

  return { document: { ...document, root }, selection: path };
}

/**
 * Replaces a node's children with one string, or clears them when it is empty.
 *
 * Refuses outright where the children are anything but text. The inspector only
 * offers the field in that case, but the guard belongs here: a comment saying
 * "only offered where…" describes a caller, and this is a function.
 */
export function setNodeText(
  document: BuilderDocument,
  path: NodePath,
  text: string,
): EditResult {
  if (document.root === null) return refused(document);

  const existing = nodeAt(document.root, path);
  if (
    existing !== null &&
    isComponentNode(existing) &&
    !(existing.children ?? []).every((child) => typeof child === "string")
  ) {
    return refused(document);
  }

  const root = updateAt(document.root, path, (node) => {
    if (!isComponentNode(node)) return typeof node === "string" ? text : node;
    if (text === "") {
      const without = { ...node };
      delete without.children;
      return without;
    }
    return { ...node, children: [text] };
  });

  return { document: { ...document, root }, selection: path };
}

/** Replaces the node at `path` wholesale — how a swapped component lands. */
export function replaceNode(
  document: BuilderDocument,
  path: NodePath,
  node: ViewNode,
): EditResult {
  if (document.root === null) return refused(document);
  return {
    document: { ...document, root: replaceAt(document.root, path, node) },
    selection: path,
  };
}

/**
 * Sets one `themeOverrides` entry, or removes it when `value` is `undefined`.
 *
 * An override removed is not the same as an override set to the token's current
 * value: the second writes a value into the document that a theme can no longer
 * move. Clearing the field has to actually delete the key.
 */
export function setThemeOverride(
  document: BuilderDocument,
  token: string,
  value: string | undefined,
): BuilderDocument {
  const overrides = { ...document.themeOverrides };
  if (value === undefined || value.trim() === "") delete overrides[token];
  else overrides[token] = value;

  if (Object.keys(overrides).length === 0) {
    const without = { ...document };
    delete without.themeOverrides;
    return without;
  }
  return { ...document, themeOverrides: overrides };
}
