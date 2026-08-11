import type { NodePath } from "./tree";

/**
 * What a drag is carrying.
 *
 * Two kinds, one gesture: a component being brought in from the palette, and a
 * node already in the document being moved. They are separated here rather than
 * at the drop, because only one of them can be refused for being dropped inside
 * itself.
 */
export type DragPayload =
  | { kind: "new"; name: string }
  | { kind: "move"; path: NodePath; label: string };

/** How far the pointer must travel before a press becomes a drag, in pixels. */
export const DRAG_THRESHOLD = 4;

/** How close to the edge of the canvas a drag scrolls it, and by how much. */
export const AUTOSCROLL_MARGIN = 48;
export const AUTOSCROLL_STEP = 14;

/** The distance from a press to the pointer now. */
export const movedFar = (
  origin: { x: number; y: number },
  point: { x: number; y: number },
): boolean =>
  Math.abs(point.x - origin.x) > DRAG_THRESHOLD || Math.abs(point.y - origin.y) > DRAG_THRESHOLD;

/**
 * How far a scroller should move for a pointer this close to its edge.
 *
 * Zero everywhere but the two bands, so a drag across the middle of a long
 * document does not creep. Returned rather than applied so it can be reasoned
 * about without a DOM.
 */
export function autoScrollBy(
  pointerY: number,
  bounds: { top: number; bottom: number },
): number {
  if (pointerY < bounds.top + AUTOSCROLL_MARGIN) return -AUTOSCROLL_STEP;
  if (pointerY > bounds.bottom - AUTOSCROLL_MARGIN) return AUTOSCROLL_STEP;
  return 0;
}
