import { describe, expect, it } from "vitest";

import { isComponentNode, type ViewNode } from "../spec";
import { canMove, dropTargetAt, keepsItsScope, resolveDrop, zoneFor } from "./drop";
import { nodeAt, type NodePath, referencedRoots, scopeAt } from "./tree";

/**
 * Where a pointer means to put something.
 *
 * The geometry and the document are separate questions and are separated here:
 * `zoneFor` answers "which third of the box", `resolveDrop` answers "and is that
 * a place the format has", and `dropTargetAt` is the one that has to reconcile
 * them — which is where every impossible drop is either turned into a sensible
 * one or refused.
 */

const CONTAINERS = new Set(["Stack", "Card"]);
const accepts = (node: ViewNode) =>
  isComponentNode(node) && CONTAINERS.has(node.component);

const root: ViewNode = {
  component: "Stack",
  children: [
    { component: "Text", children: ["a"] },
    { component: "Card", children: [{ component: "Text", children: ["b"] }] },
    { component: "Input" },
  ],
};

describe("zoneFor", () => {
  it("splits a leaf in half, so aiming at an input never means inside it", () => {
    expect(zoneFor({ offset: 4, height: 40, container: false })).toBe("before");
    expect(zoneFor({ offset: 36, height: 40, container: false })).toBe("after");
    expect(zoneFor({ offset: 20, height: 40, container: false })).toBe("after");
  });

  it("gives a container its middle", () => {
    expect(zoneFor({ offset: 2, height: 100, container: true })).toBe("before");
    expect(zoneFor({ offset: 50, height: 100, container: true })).toBe("inside");
    expect(zoneFor({ offset: 98, height: 100, container: true })).toBe("after");
  });

  it("gives an empty container all of it", () => {
    // An empty container is a few pixels tall. With edge bands, the one thing
    // it is for would be the hardest thing on the canvas to hit.
    expect(zoneFor({ offset: 0, height: 6, container: true, empty: true })).toBe("inside");
    expect(zoneFor({ offset: 6, height: 6, container: true, empty: true })).toBe("inside");
  });

  it("answers something for a box with no height", () => {
    expect(zoneFor({ offset: 0, height: 0, container: true })).toBe("inside");
    expect(zoneFor({ offset: 0, height: 0, container: false })).toBe("after");
  });
});

describe("resolveDrop", () => {
  it("appends to what it is dropped inside", () => {
    expect(resolveDrop(root, { path: [1], zone: "inside" })).toEqual({ parent: [1], index: 1 });
  });

  it("puts a sibling before or after", () => {
    expect(resolveDrop(root, { path: [1], zone: "before" })).toEqual({ parent: [], index: 1 });
    expect(resolveDrop(root, { path: [1], zone: "after" })).toEqual({ parent: [], index: 2 });
  });

  it("has no answer for a sibling of the root — a document has one", () => {
    expect(resolveDrop(root, { path: [], zone: "before" })).toBeNull();
    expect(resolveDrop(root, { path: [], zone: "after" })).toBeNull();
  });

  it("has no answer for a sibling in a structural slot", () => {
    // `$each.node` and `$cond.then` hold exactly one node. Inserting beside one
    // would drop what was there without saying so.
    const bound: ViewNode = {
      $each: "data.rows",
      as: "row",
      node: { component: "Text", children: ["x"] },
    };
    expect(resolveDrop(bound, { path: ["node"], zone: "before" })).toBeNull();
    expect(resolveDrop(bound, { path: ["node"], zone: "after" })).toBeNull();
  });
});

describe("dropTargetAt", () => {
  it("turns an impossible sibling-of-the-root into nesting inside it", () => {
    expect(dropTargetAt(root, [], { offset: 1, height: 400 }, accepts)).toEqual({
      path: [],
      zone: "inside",
    });
  });

  it("walks up when neither nesting nor a sibling is available where it is", () => {
    const bound: ViewNode = {
      component: "Stack",
      children: [
        { $each: "data.rows", as: "row", node: { component: "Input" } },
      ],
    };
    // Over the `$each`'s own child: it is a leaf, and its slot takes no
    // siblings — so the answer is the nearest list above it.
    expect(dropTargetAt(bound, [0, "node"], { offset: 1, height: 20 }, accepts)).toEqual({
      path: [],
      zone: "inside",
    });
  });

  it("has no answer for a document whose root takes nothing", () => {
    const leaf: ViewNode = { component: "Input" };
    expect(dropTargetAt(leaf, [], { offset: 5, height: 20 }, accepts)).toBeNull();
  });

  it("nests into a container the pointer is over the middle of", () => {
    expect(dropTargetAt(root, [1], { offset: 30, height: 60 }, accepts)).toEqual({
      path: [1],
      zone: "inside",
    });
  });
});

describe("canMove", () => {
  it("refuses a node into itself or its descendants", () => {
    expect(canMove(root, [1], { path: [1], zone: "inside" })).toBe(false);
    expect(canMove(root, [1], { path: [1, 0], zone: "after" })).toBe(false);
  });

  it("refuses the root, which has nowhere to go", () => {
    expect(canMove(root, [], { path: [1], zone: "inside" })).toBe(false);
  });

  it("refuses a move that lands exactly where the node already is", () => {
    // Both spellings of "stay put": before itself, and after the sibling above.
    expect(canMove(root, [1], { path: [1], zone: "before" })).toBe(false);
    expect(canMove(root, [1], { path: [0], zone: "after" })).toBe(false);
  });

  it("allows a real move", () => {
    expect(canMove(root, [2], { path: [0], zone: "before" })).toBe(true);
    expect(canMove(root, [0], { path: [1], zone: "inside" })).toBe(true);
  });
});

/**
 * The damage that leaves no trace.
 *
 * A node inside an `$each` is written against the row that `$each` names.
 * Dragged out of the loop it still conforms, still renders, and the document
 * still contains exactly as many `$ref`s as it did — the component simply draws
 * nothing, for ever. Nothing downstream can notice, so the move has to be
 * refused before it happens.
 */
describe("a node may not be dragged out of the loop it reads", () => {
  const looped: ViewNode = {
    component: "Stack",
    children: [
      {
        $each: "data.rows",
        as: "row",
        node: {
          component: "Card",
          children: [
            { component: "Text", children: [{ $ref: "row.label" }] },
            { component: "Divider" },
            { component: "Badge", children: ["static"] },
          ],
        },
      },
    ],
  };

  const bound: NodePath = [0, "node", 0];
  const free: NodePath = [0, "node", 1];

  it("knows which aliases are in scope, and which the node uses", () => {
    expect([...scopeAt(looped, bound)]).toEqual(["row", "rowIndex"]);
    expect([...scopeAt(looped, [])]).toEqual([]);
    expect([...referencedRoots(nodeAt(looped, bound) ?? "")]).toEqual(["row"]);
    expect([...referencedRoots(nodeAt(looped, free) ?? "")]).toEqual([]);
  });

  it("refuses to move the node that reads the row", () => {
    expect(keepsItsScope(looped, bound, [])).toBe(false);
    expect(canMove(looped, bound, { path: [], zone: "inside" })).toBe(false);
  });

  it("allows the one that reads nothing, and any move that stays inside", () => {
    expect(keepsItsScope(looped, free, [])).toBe(true);
    expect(canMove(looped, free, { path: [], zone: "inside" })).toBe(true);
    // Rearranging within the loop keeps the alias in scope.
    expect(canMove(looped, bound, { path: [0, "node", 2], zone: "after" })).toBe(true);
  });

  it("does not count an alias a node declares for itself", () => {
    // The inner `$each` names `cell`, so a `$ref` to it is satisfied by the
    // node being moved and travels with it.
    const inner: ViewNode = {
      component: "Stack",
      children: [
        {
          $each: "data.rows",
          as: "row",
          node: {
            component: "Card",
            children: [
              { $each: "data.cells", as: "cell", node: { component: "Text", children: [{ $ref: "cell.value" }] } },
            ],
          },
        },
      ],
    };
    expect([...referencedRoots(nodeAt(inner, [0, "node", 0]) ?? "")]).toEqual(["data"]);
    expect(canMove(inner, [0, "node", 0], { path: [], zone: "inside" })).toBe(true);
  });
});
