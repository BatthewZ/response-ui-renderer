import {
  type ComponentNode,
  type EachNode,
  isComponentNode,
  isCondNode,
  isEachNode,
  type ViewNode,
  type ViewSpec,
} from "../spec";

/**
 * Where a node sits in a document, as the steps taken to reach it.
 *
 * A number indexes a component's `children`; a string names the one slot a
 * structural node holds — `$each.node`, `$cond.then`, `$cond.else`. The two
 * never collide because the parent's own shape decides which kind of step is
 * legal, and no slot is spelled as a number.
 *
 * The builder edits component nodes, but a document it opens may hold any of the
 * five node types. Walking all of them — rather than the two the palette can
 * produce — is what lets an existing document be opened, rearranged around its
 * bindings and written back with those bindings intact.
 */
export type NodePath = readonly (number | string)[];

export const ROOT_PATH: NodePath = [];

/** `[0, "then", 2]` ⇄ `"0.then.2"`, for a DOM attribute the canvas hit-tests. */
export function pathToKey(path: NodePath): string {
  return path.join(".");
}

export function keyToPath(key: string): NodePath {
  if (key === "") return ROOT_PATH;
  return key.split(".").map((step) => (/^\d+$/.test(step) ? Number(step) : step));
}

export const samePath = (a: NodePath, b: NodePath): boolean =>
  a.length === b.length && a.every((step, i) => step === b[i]);

/** Whether `path` is `ancestor` itself or sits underneath it. */
export const isWithin = (path: NodePath, ancestor: NodePath): boolean =>
  path.length >= ancestor.length && ancestor.every((step, i) => step === path[i]);

export const parentPath = (path: NodePath): NodePath | null =>
  path.length === 0 ? null : path.slice(0, -1);

export const lastStep = (path: NodePath): number | string | undefined => path[path.length - 1];

/** A node's children, paired with the step that reaches each. */
export function childEntries(node: ViewNode): { step: number | string; node: ViewNode }[] {
  if (isComponentNode(node)) {
    return (node.children ?? []).map((child, index) => ({ step: index, node: child }));
  }
  if (isEachNode(node)) return [{ step: "node", node: node.node }];
  if (isCondNode(node)) {
    const entries = [{ step: "then", node: node.then }];
    if (node.else !== undefined) entries.push({ step: "else", node: node.else });
    return entries;
  }
  return [];
}

export function nodeAt(root: ViewNode, path: NodePath): ViewNode | null {
  let current: ViewNode = root;
  for (const step of path) {
    const found = childEntries(current).find((entry) => entry.step === step);
    if (!found) return null;
    current = found.node;
  }
  return current;
}

/**
 * `node` with one child replaced, or removed when `next` is `null`.
 *
 * Removal is only meaningful for a `children` array and for `$cond.else`; a
 * `$each` with no node, or a `$cond` with no `then`, is not a document. Those
 * return the node untouched rather than producing one the validator rejects.
 */
function withChild(node: ViewNode, step: number | string, next: ViewNode | null): ViewNode {
  if (isComponentNode(node) && typeof step === "number") {
    const children = [...(node.children ?? [])];
    if (step < 0 || step >= children.length) return node;
    // Replacing a child with itself is not an edit. Rebuilding an identical
    // tree to record it would put a step in the undo history that undoes
    // nothing visible, which reads as undo being broken.
    if (next !== null && next === children[step]) return node;
    if (next === null) children.splice(step, 1);
    else children[step] = next;
    return children.length > 0 ? { ...node, children } : omitChildren(node);
  }
  if (isEachNode(node) && step === "node" && next !== null) {
    return next === node.node ? node : { ...node, node: next };
  }
  if (isCondNode(node) && step === "then" && next !== null) {
    return next === node.then ? node : { ...node, then: next };
  }
  if (isCondNode(node) && step === "else") {
    if (next === null) {
      const without = { ...node };
      delete without.else;
      return without;
    }
    return next === node.else ? node : { ...node, else: next };
  }
  return node;
}

function omitChildren(node: ComponentNode): ComponentNode {
  const without = { ...node };
  delete without.children;
  return without;
}

/**
 * The document with the node at `path` replaced by `map`'s result, or removed
 * when it returns `null`. Every other node is carried over by reference.
 */
export function updateAt(
  root: ViewNode,
  path: NodePath,
  map: (node: ViewNode) => ViewNode | null,
): ViewNode | null {
  const target = nodeAt(root, path);
  if (target === null) return root;
  if (path.length === 0) return map(target);

  const recurse = (node: ViewNode, depth: number): ViewNode | null => {
    const step = path[depth];
    const child = childEntries(node).find((entry) => entry.step === step);
    if (!child) return node;
    const next =
      depth === path.length - 1 ? map(child.node) : recurse(child.node, depth + 1);
    return withChild(node, step, next);
  };

  return recurse(root, 0);
}

export const replaceAt = (root: ViewNode, path: NodePath, node: ViewNode): ViewNode =>
  (updateAt(root, path, () => node) ?? node);

export const removeAt = (root: ViewNode, path: NodePath): ViewNode | null =>
  updateAt(root, path, () => null);

/**
 * `node` inserted as the `index`th child of the component node at `parent`.
 *
 * Only a component node holds a child list. Structural nodes hold one slot each
 * and are filled with `replaceAt`; a caller that lands here with one has asked
 * for something the format cannot express, and gets the document back unchanged.
 */
export function insertAt(
  root: ViewNode,
  parent: NodePath,
  index: number,
  node: ViewNode,
): ViewNode {
  return (
    updateAt(root, parent, (target) => {
      if (!isComponentNode(target)) return target;
      const children = [...(target.children ?? [])];
      children.splice(Math.max(0, Math.min(index, children.length)), 0, node);
      return { ...target, children };
    }) ?? root
  );
}

/**
 * Moves the node at `from` to `index` within the component node at `parent`.
 *
 * Two things make this more than remove-then-insert. A node cannot be moved
 * inside itself — the subtree would be detached from the document and the drag
 * would delete it — and a move *within one parent* shifts every later index down
 * by one when the node leaves, so the index the pointer chose is not the index
 * the insert wants.
 */
export function moveNode(
  root: ViewNode,
  from: NodePath,
  parent: NodePath,
  index: number,
): ViewNode {
  if (from.length === 0) return root;
  if (isWithin(parent, from)) return root;

  // A node in a `$each` or `$cond` slot cannot be *removed*, so removing it and
  // inserting it elsewhere leaves it in both places — the same object, twice.
  if (typeof lastStep(from) !== "number") return root;

  const moving = nodeAt(root, from);
  if (moving === null) return root;

  const without = removeAt(root, from);
  if (without === null) return root;
  return insertAt(without, pathAfterRemoval(parent, from), landingIndex(from, parent, index), moving);
}

/**
 * Where a path points once the node at `removed` is gone.
 *
 * The destination is chosen against the document as it looks *now*, and the
 * move takes the node out first — so any path that reaches the destination by
 * passing a later sibling of the removed node is off by one from that moment on.
 * The ordinary drag makes it: pick something up and drop it into the box below
 * it. Uncorrected, the insert lands in whatever slid up into the destination's
 * place, or — when nothing did — nowhere at all, and the node is simply gone.
 */
export function pathAfterRemoval(path: NodePath, removed: NodePath): NodePath {
  const parent = parentPath(removed);
  const step = lastStep(removed);
  if (parent === null || typeof step !== "number") return path;

  // Only a path that descends *through* the removed node's own parent is
  // affected, and only past the point where the list closed up.
  if (path.length <= parent.length) return path;
  if (!parent.every((each, index) => each === path[index])) return path;

  const branch = path[parent.length];
  if (typeof branch !== "number" || branch <= step) return path;

  const next = [...path];
  next[parent.length] = branch - 1;
  return next;
}

/**
 * The index a move actually lands at, once the node has been taken out.
 *
 * Removing it first shifts every later sibling down one, so the index the
 * pointer chose is one too far — but only when it is moving *within* its own
 * parent and *downwards*. Exported because two callers need the same answer:
 * `moveNode`, to place the node, and the command layer, to follow it with the
 * selection. Two spellings of one rule is how they come to disagree.
 */
export function landingIndex(from: NodePath, parent: NodePath, index: number): number {
  const origin = parentPath(from);
  const step = lastStep(from);
  const sameParent = origin !== null && samePath(origin, parent);
  return sameParent && typeof step === "number" && step < index ? index - 1 : index;
}

/**
 * The `$each` aliases a node at `path` can see.
 *
 * Everything under an `$each` is written against the row it names, so these are
 * the names a `$ref` inside that subtree may legally use. Walking down from the
 * root is the only way to know them: an alias is declared by an ancestor and
 * mentioned by a descendant, and nothing in between records it.
 */
export function scopeAt(root: ViewNode, path: NodePath): ReadonlySet<string> {
  const aliases = new Set<string>();
  let current: ViewNode = root;
  for (const step of path) {
    if (isEachNode(current) && step === "node") {
      aliases.add(current.as);
      aliases.add(`${current.as}Index`);
    }
    const found = childEntries(current).find((entry) => entry.step === step);
    if (!found) break;
    current = found.node;
  }
  return aliases;
}

/** Every root name a `$ref`, `$each` or `$cond` inside `node` resolves against. */
export function referencedRoots(node: ViewNode): ReadonlySet<string> {
  const roots = new Set<string>();
  const rootOf = (path: unknown) => {
    if (typeof path !== "string" || path === "") return;
    const dot = path.indexOf(".");
    roots.add(dot === -1 ? path : path.slice(0, dot));
  };

  const walk = (value: unknown, bound: ReadonlySet<string>): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, bound);
      return;
    }
    if (typeof value !== "object" || value === null) return;

    const record = value as Record<string, unknown>;
    if (typeof record.$ref === "string" && !bound.has(rootName(record.$ref))) rootOf(record.$ref);
    if (typeof record.$cond === "string" && !bound.has(rootName(record.$cond))) rootOf(record.$cond);

    if (isEachNode(value as ViewNode)) {
      const each = value as EachNode;
      if (!bound.has(rootName(each.$each))) rootOf(each.$each);
      // Its own alias is declared here, so references to it below are not free.
      walk(each.node, new Set([...bound, each.as, `${each.as}Index`]));
      return;
    }

    for (const [key, item] of Object.entries(record)) {
      if (key === "$ref" || key === "$cond") continue;
      walk(item, bound);
    }
  };

  walk(node, new Set());
  return roots;
}

const rootName = (path: string): string => {
  const dot = path.indexOf(".");
  return dot === -1 ? path : path.slice(0, dot);
};

/**
 * A document's node count, for the one place a size is worth stating.
 *
 * Counts every node type, not only components: a `$each` is one node in the
 * JSON however many rows it renders, and a count that quietly meant "components"
 * would disagree with the document it sits beside.
 */
export function countNodes(node: ViewNode | null): number {
  if (node === null) return 0;
  return 1 + childEntries(node).reduce((total, entry) => total + countNodes(entry.node), 0);
}

/** How deep the document goes, in the same steps `MAX_NODE_DEPTH` counts. */
export function depthOf(node: ViewNode | null): number {
  if (node === null) return 0;
  return 1 + childEntries(node).reduce((deepest, entry) => Math.max(deepest, depthOf(entry.node)), 0);
}

/**
 * The document under edit.
 *
 * `root` is nullable and `ViewSpec.root` is not: an empty canvas is a real state
 * the builder starts in, and inventing a placeholder root to avoid the null
 * would put a component in the JSON that nobody dropped. Everything else is the
 * spec's own shape, carried verbatim — including `data`, `forms` and `state`,
 * which the builder does not edit and must not drop from a document it opened.
 */
export type BuilderDocument = Omit<ViewSpec, "root"> & { root: ViewNode | null };

export const emptyDocument = (title = "Untitled view"): BuilderDocument => ({
  version: 1,
  title,
  root: null,
});

export const fromSpec = (spec: ViewSpec): BuilderDocument => ({ ...spec });

/** The document as a spec, or `null` while nothing has been dropped on it. */
export function toSpec(doc: BuilderDocument): ViewSpec | null {
  if (doc.root === null) return null;
  return { ...doc, root: doc.root };
}
