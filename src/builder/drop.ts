import type { ViewNode } from "../spec";
import {
  childEntries,
  isWithin,
  lastStep,
  nodeAt,
  type NodePath,
  parentPath,
  referencedRoots,
  samePath,
  scopeAt,
} from "./tree";

/**
 * Where a pointer over a node means the thing it is carrying should go.
 *
 * Three zones rather than two, because a builder that only ever inserts between
 * siblings cannot nest anything, and one that only ever nests cannot put two
 * cards side by side. Which zones a node offers is decided by the node: a
 * container gives up its middle to `inside`, and a leaf splits cleanly in half
 * so that aiming at an `Input` can never mean "inside the input".
 */
export type DropZone = "before" | "after" | "inside";

export type DropTarget = { path: NodePath; zone: DropZone };

/** Where an insert actually lands: a child list, and a position in it. */
export type DropPosition = { parent: NodePath; index: number };

/** The share of a container's height each edge band takes. */
const EDGE = 0.28;

export type ZoneOptions = {
  /** The pointer's offset from the top of the node's box. */
  offset: number;
  height: number;
  /** Whether this node takes children at all. */
  container: boolean;
  /** A container with nothing in it has no edges worth aiming between. */
  empty?: boolean;
};

/**
 * The zone a pointer is in.
 *
 * An empty container is all `inside` — its box is only a few pixels tall, so
 * edge bands would make the one thing you can do with it the hardest to hit.
 */
export function zoneFor({ offset, height, container, empty = false }: ZoneOptions): DropZone {
  if (height <= 0) return container ? "inside" : "after";
  if (container && empty) return "inside";
  const ratio = Math.min(Math.max(offset / height, 0), 1);
  if (!container) return ratio < 0.5 ? "before" : "after";
  if (ratio < EDGE) return "before";
  if (ratio > 1 - EDGE) return "after";
  return "inside";
}

/**
 * The child list and index a target resolves to, or `null` when the format has
 * nowhere to put it.
 *
 * Two things have no answer rather than a fallback. The root has no siblings —
 * a document has exactly one root — and a node held in a structural slot
 * (`$each.node`, `$cond.then`) has no siblings either: those slots hold one node
 * each, and inserting beside one would silently drop what was there.
 */
export function resolveDrop(root: ViewNode, target: DropTarget): DropPosition | null {
  const node = nodeAt(root, target.path);
  if (node === null) return null;

  if (target.zone === "inside") {
    return { parent: target.path, index: childEntries(node).length };
  }

  const parent = parentPath(target.path);
  if (parent === null) return null;

  const step = lastStep(target.path);
  if (typeof step !== "number") return null;

  return { parent, index: target.zone === "before" ? step : step + 1 };
}

/**
 * The target a pointer over a node's box really means.
 *
 * `zoneFor` answers geometrically; this answers within the document. Two of its
 * three answers may be impossible where the pointer is — the root has no
 * siblings, and a node in a `$each` or `$cond` slot has none either — and the
 * honest thing to do with a pointer that is plainly over *something* is to nest
 * inside it, or inside the nearest thing above it that holds a list, rather than
 * to show no indicator and swallow the drop.
 */
export function dropTargetAt(
  root: ViewNode,
  path: NodePath,
  geometry: { offset: number; height: number },
  accepts: (node: ViewNode) => boolean,
): DropTarget | null {
  const node = nodeAt(root, path);
  if (node === null) return null;

  const container = accepts(node);
  const zone = zoneFor({
    offset: geometry.offset,
    height: geometry.height,
    container,
    empty: childEntries(node).length === 0,
  });

  const wanted: DropTarget = { path, zone };
  if (resolveDrop(root, wanted) !== null) return wanted;

  if (container) {
    const inside: DropTarget = { path, zone: "inside" };
    if (resolveDrop(root, inside) !== null) return inside;
  }

  for (let up = parentPath(path); up !== null; up = parentPath(up)) {
    const ancestor = nodeAt(root, up);
    if (ancestor === null || !accepts(ancestor)) continue;
    const inside: DropTarget = { path: up, zone: "inside" };
    if (resolveDrop(root, inside) !== null) return inside;
  }

  return null;
}

/**
 * Whether dragging the node at `from` onto `target` is a move that can happen.
 *
 * A node cannot be dropped into itself or into its own descendants — the
 * subtree would be cut out of the document along with the thing being moved,
 * which reads to whoever did it as the drag having deleted their work. Dropping
 * a node exactly where it already is is refused too, so a click that drifts a
 * few pixels does not enter the undo history as an edit.
 */
export function canMove(root: ViewNode, from: NodePath, target: DropTarget): boolean {
  if (from.length === 0) return false;
  if (isWithin(target.path, from)) return false;

  const position = resolveDrop(root, target);
  if (position === null) return false;
  if (!keepsItsScope(root, from, position.parent)) return false;

  const origin = parentPath(from);
  const step = lastStep(from);
  if (origin === null || typeof step !== "number") return true;
  if (!samePath(origin, position.parent)) return true;
  return position.index !== step && position.index !== step + 1;
}

/**
 * Whether a node would still be able to see the loop rows it reads.
 *
 * A node inside an `$each` is written against the alias that `$each` declares.
 * Dragged out of it, every `$ref` in it resolves to nothing — the component
 * renders empty, the document still conforms, and the count of `$ref`s in the
 * JSON is unchanged. There is nothing to notice afterwards, so the move is
 * refused before it happens.
 *
 * Only the aliases actually referenced matter: moving a node that reads nothing
 * out of a loop is ordinary rearranging.
 */
export function keepsItsScope(root: ViewNode, from: NodePath, destination: NodePath): boolean {
  const here = scopeAt(root, from);
  if (here.size === 0) return true;

  const node = nodeAt(root, from);
  if (node === null) return true;

  const there = scopeAt(root, destination);
  for (const name of referencedRoots(node)) {
    if (here.has(name) && !there.has(name)) return false;
  }
  return true;
}
