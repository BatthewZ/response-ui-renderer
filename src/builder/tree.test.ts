import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import contactForm from "../examples/contact-form.viewspec.json";
import productLanding from "../examples/product-landing.viewspec.json";
import { ViewRenderer } from "../render/ViewRenderer";
import { type ComponentNode, isComponentNode, type ViewNode, type ViewSpec } from "../spec";
import { duplicateNode, insertNode, moveNodeTo, nudgeNode, removeNode, setProp } from "./commands";
import { instrumentSpec } from "./instrument";
import { defaultBuilderTemplates } from "./templates";
import {
  childEntries,
  countNodes,
  depthOf,
  emptyDocument,
  fromSpec,
  insertAt,
  isWithin,
  keyToPath,
  moveNode,
  nodeAt,
  type NodePath,
  pathToKey,
  removeAt,
  toSpec,
  updateAt,
} from "./tree";

/**
 * The tree operations are the only part of the builder a drag can lose work in,
 * so they are tested as functions rather than through the UI: a pointer moving
 * over a canvas cannot express "into your own descendant", and that is the case
 * that silently deletes a subtree.
 */

const text = (value: string): ViewNode => value;

const stack = (...children: ViewNode[]): ComponentNode => ({
  component: "Stack",
  children,
});

const doc = (root: ViewNode): ViewSpec => ({ version: 1, title: "t", root });

describe("paths", () => {
  it("round-trips through the spelling a DOM attribute can hold", () => {
    const path: NodePath = [0, "then", 2, "node"];
    expect(pathToKey(path)).toBe("0.then.2.node");
    expect(keyToPath("0.then.2.node")).toEqual(path);
    expect(keyToPath("")).toEqual([]);
    expect(pathToKey([])).toBe("");
  });

  it("tells a numeric step from a slot name, which decide different edits", () => {
    // `2` indexes a child list and `then` names a slot. Reading one as the
    // other would insert into a `$cond` and drop the branch that was there.
    expect(keyToPath("2")).toEqual([2]);
    expect(keyToPath("then")).toEqual(["then"]);
    expect(typeof keyToPath("2")[0]).toBe("number");
    expect(typeof keyToPath("then")[0]).toBe("string");
  });
});

describe("walking every node type", () => {
  const root: ViewNode = {
    component: "Stack",
    children: [
      "hello",
      { $ref: "data.name" },
      { $each: "data.rows", as: "row", node: { component: "Text", children: ["x"] } },
      { $cond: "data.flag", then: { component: "Badge" }, else: { component: "Alert" } },
    ],
  };

  it("reaches the child of an `$each` and both branches of a `$cond`", () => {
    expect(nodeAt(root, [0])).toBe("hello");
    expect(nodeAt(root, [2, "node"])).toEqual({ component: "Text", children: ["x"] });
    expect(nodeAt(root, [3, "then"])).toEqual({ component: "Badge" });
    expect(nodeAt(root, [3, "else"])).toEqual({ component: "Alert" });
  });

  it("answers nothing for a path the document does not have", () => {
    expect(nodeAt(root, [9])).toBeNull();
    expect(nodeAt(root, [3, "node"])).toBeNull();
    expect(nodeAt(root, [0, 0])).toBeNull();
  });

  it("counts an `$each` as the one node it is in the JSON, not as its rows", () => {
    // 1 root + 4 children + the `$each`'s node + the `$cond`'s two branches,
    // plus the text inside the `$each` node.
    expect(countNodes(root)).toBe(9);
    expect(depthOf(root)).toBe(4);
    expect(childEntries("just text")).toEqual([]);
  });
});

describe("editing", () => {
  it("inserts at an index, and clamps one outside the list", () => {
    const root = stack(text("a"), text("b"));
    expect(insertAt(root, [], 1, text("x"))).toEqual(stack(text("a"), text("x"), text("b")));
    expect(insertAt(root, [], 99, text("x"))).toEqual(stack(text("a"), text("b"), text("x")));
    expect(insertAt(root, [], -5, text("x"))).toEqual(stack(text("x"), text("a"), text("b")));
  });

  it("drops the `children` key with the last child rather than leaving an empty array", () => {
    // `"children": []` is legal and meaningless, and it is what a reader of the
    // JSON would have to explain to themselves.
    expect(removeAt(stack(text("only")), [0])).toEqual({ component: "Stack" });
  });

  it("removes the root by removing the whole document", () => {
    expect(removeAt(stack(text("a")), [])).toBeNull();
  });

  it("shares every node it did not touch", () => {
    const kept = stack(text("deep"));
    const root = stack(kept, text("b"));
    const next = updateAt(root, [1], () => text("B"));
    expect(next).not.toBe(root);
    expect((next as ComponentNode).children?.[0]).toBe(kept);
  });
});

describe("moving", () => {
  const nested = stack(stack(text("inner")), text("b"));

  it("refuses to move a node inside itself", () => {
    // The subtree would go with it, so the drag would read as a delete.
    expect(isWithin([0, 0], [0])).toBe(true);
    expect(moveNode(nested, [0], [0, 0], 0)).toBe(nested);
    expect(moveNode(nested, [0], [0], 0)).toBe(nested);
  });

  it("moves between parents", () => {
    expect(moveNode(nested, [1], [0], 0)).toEqual(stack(stack(text("b"), text("inner"))));
  });

  it("corrects the index when a node moves down within one parent", () => {
    // Removing it first shifts every later sibling down one, so the index the
    // pointer chose is one too far. Without the correction `a` lands before `b`
    // and the drag appears to do nothing.
    const row = stack(text("a"), text("b"), text("c"));
    expect(moveNode(row, [0], [], 2)).toEqual(stack(text("b"), text("a"), text("c")));
    expect(moveNode(row, [2], [], 0)).toEqual(stack(text("c"), text("a"), text("b")));
  });
});

describe("commands keep the selection pointing at the right node", () => {
  it("selects what was dropped", () => {
    const before = fromSpec(doc(stack(text("a"), text("b"))));
    const after = insertNode(before, text("x"), { path: [1], zone: "before" });
    expect(after.selection).toEqual([1]);
    expect(nodeAt(after.document.root as ViewNode, [1])).toBe("x");
  });

  it("makes the first drop onto an empty canvas the root", () => {
    const empty = fromSpec({ version: 1, title: "t", root: stack() });
    const cleared = removeNode(empty, []);
    expect(cleared.document.root).toBeNull();
    expect(toSpec(cleared.document)).toBeNull();

    const seeded = insertNode(cleared.document, stack(text("a")), null);
    expect(seeded.selection).toEqual([]);
    expect(toSpec(seeded.document)?.root).toEqual(stack(text("a")));
  });

  it("selects the container after a delete, not the node that slid into its place", () => {
    const before = fromSpec(doc(stack(text("a"), text("b"))));
    const after = removeNode(before, [1]);
    expect(after.selection).toEqual([]);
    expect(after.document.root).toEqual(stack(text("a")));
  });

  it("selects the copy after a duplicate", () => {
    const before = fromSpec(doc(stack(text("a"), text("b"))));
    const after = duplicateNode(before, [0]);
    expect(after.selection).toEqual([1]);
    expect(after.document.root).toEqual(stack(text("a"), text("a"), text("b")));
  });

  it("follows the node it nudged", () => {
    const before = fromSpec(doc(stack(text("a"), text("b"), text("c"))));
    const down = nudgeNode(before, [0], 1);
    expect(down.selection).toEqual([1]);
    expect(down.document.root).toEqual(stack(text("b"), text("a"), text("c")));

    const up = nudgeNode(down.document, [1], -1);
    expect(up.selection).toEqual([0]);
    expect(up.document.root).toEqual(stack(text("a"), text("b"), text("c")));
  });

  it("leaves a nudge past either end alone", () => {
    const before = fromSpec(doc(stack(text("a"), text("b"))));
    expect(nudgeNode(before, [0], -1).document).toBe(before);
    expect(nudgeNode(before, [1], 1).document).toBe(before);
  });

  it("does not put the same id on the page twice", () => {
    // Templates carry real ids, because they were lifted from documents that
    // used them. Two clicks reach the collision — and two identical ids mean two
    // `<label for>` pointing at one field, and two siblings whose React key the
    // renderer derives from that id.
    const withId = (id: string): ViewNode => ({ component: "Input", props: { id } });
    const before = fromSpec(doc(stack(withId("email"))));

    const second = insertNode(before, withId("email"), { path: [0], zone: "after" });
    expect(nodeAt(second.document.root as ViewNode, [1])).toEqual({
      component: "Input",
      props: { id: "email-2" },
    });

    const third = insertNode(second.document, withId("email"), { path: [1], zone: "after" });
    const ids = childEntries(third.document.root as ViewNode)
      .map((entry) => (isComponentNode(entry.node) ? entry.node.props?.id : null));
    expect(ids).toEqual(["email", "email-2", "email-3"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not make two of one template collide in the renderer's keys", () => {
    // The pair the palette reaches in two clicks: the `Stack` template already
    // contains a `Rating`, and a second `Rating` dropped into it derives the
    // same key from the score both are showing. Nothing about that document is
    // wrong — it means two ratings of 4 — so unlike a repeated id there is
    // nothing here for the builder to rename, and the check is on what the
    // renderer makes of what the builder produced.
    const dropped = insertNode(emptyDocument(), defaultBuilderTemplates.Stack, null);
    const both = insertNode(dropped.document, defaultBuilderTemplates.Rating, {
      path: [1],
      zone: "after",
    });
    expect(countNodes(both.document.root)).toBe(countNodes(dropped.document.root) + 1);

    const spec = toSpec(both.document);
    if (spec === null) throw new Error("the two drops produced no document");

    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(createElement(ViewRenderer, { spec }));
    const messages = error.mock.calls.map((call) => call.map(String).join(" "));
    error.mockRestore();
    expect(messages).toEqual([]);
  });

  it("renames the copy's id when a node is duplicated", () => {
    const before = fromSpec(doc(stack({ component: "Dialog", props: { id: "confirm" } })));
    const after = duplicateNode(before, [0]);
    expect(nodeAt(after.document.root as ViewNode, [1])).toEqual({
      component: "Dialog",
      props: { id: "confirm-2" },
    });
  });

  it("carries a reference inside the same drop across with it", () => {
    // A rename that leaves the thing pointing at it behind is worse than the
    // collision: the dialog exists and nothing can open it.
    const dialog: ViewNode = {
      component: "Stack",
      children: [
        { component: "Dialog", props: { id: "confirm" } },
        { component: "Button", props: { onClick: { action: "openDialog", payload: { dialogId: "confirm" } } } },
      ],
    };
    const before = fromSpec(doc(stack({ component: "Dialog", props: { id: "confirm" } })));
    const after = insertNode(before, dialog, { path: [0], zone: "after" });

    const moved = nodeAt(after.document.root as ViewNode, [1]) as ViewNode;
    expect(JSON.stringify(moved)).toContain("confirm-2");
    expect(JSON.stringify(moved)).not.toMatch(/"confirm"/);
  });

  it("leaves `name` alone, which a radio group shares on purpose", () => {
    const radio = (): ViewNode => ({ component: "Radio", props: { name: "plan" } });
    const before = fromSpec(doc(stack(radio())));
    const after = insertNode(before, radio(), { path: [0], zone: "after" });
    expect(nodeAt(after.document.root as ViewNode, [1])).toEqual({
      component: "Radio",
      props: { name: "plan" },
    });
  });

  it("removes a prop rather than writing `undefined` into the JSON", () => {
    const before = fromSpec(doc({ component: "Text", props: { variant: "h1" }, children: ["x"] }));
    const cleared = setProp(before, [], "variant", undefined);
    expect(cleared.document.root).toEqual({ component: "Text", children: ["x"] });
    expect(JSON.stringify(cleared.document.root)).not.toContain("variant");
  });

  it("refuses a move the drop rules refuse, and says so by changing nothing", () => {
    const before = fromSpec(doc(stack(stack(text("inner")))));
    const after = moveNodeTo(before, [0], { path: [0, 0], zone: "inside" });
    expect(after.document).toBe(before);
    // Not merely "no edit": no *selection* change either, so an aborted drag
    // does not empty the properties panel, and `undefined` is what the reducer
    // reads as "leave it alone".
    expect(after.selection).toBeUndefined();
  });

  it("performs the move it accepts, and follows it with the selection", () => {
    // The half a refusal test cannot see. `moveNodeTo` is what every drag calls,
    // and a version of it that returned the document untouched would satisfy the
    // refusal above for ever.
    const before = fromSpec(doc(stack(text("a"), text("b"), text("c"))));

    const down = moveNodeTo(before, [0], { path: [2], zone: "after" });
    expect(down.document.root).toEqual(stack(text("b"), text("c"), text("a")));
    expect(down.selection).toEqual([2]);
    expect(nodeAt(down.document.root as ViewNode, down.selection as NodePath)).toBe("a");

    const up = moveNodeTo(down.document, [2], { path: [0], zone: "before" });
    expect(up.document.root).toEqual(stack(text("a"), text("b"), text("c")));
    expect(up.selection).toEqual([0]);
    expect(nodeAt(up.document.root as ViewNode, up.selection as NodePath)).toBe("a");

    const into = moveNodeTo(before, [2], { path: [0], zone: "inside" });
    expect(into.document.root).toEqual(stack(text("a"), text("b")));
  });

  it("refuses to delete a node a structural slot has to hold", () => {
    // `$each.node` holds exactly one node, so there is no document without it.
    // Rebuilding an identical tree to say so would land in the history as an
    // edit, and Undo would then step over something that never happened.
    const looped = doc({
      component: "Stack",
      children: [{ $each: "data.rows", as: "row", node: { component: "Text" } }],
    });
    const before = fromSpec(looped);
    const after = removeNode(before, [0, "node"]);
    expect(after.document).toBe(before);
    expect(after.selection).toBeUndefined();
  });
});

/**
 * A real document, opened and edited.
 *
 * This is the specimen that matters: `product-landing` is one of the package's
 * own exemplars, with `data`, `themeOverrides`, `$each`, `$cond` and `$ref` in
 * it — every part of the format the builder does not author. Editing a document
 * must not quietly cost it any of them.
 */
describe.each([
  ["product-landing", productLanding as unknown as ViewSpec],
  // The second is not decoration: `product-landing` has no `forms` and no
  // `$field`, so those two assertions below compare `undefined` to `undefined`
  // and pass on a builder that drops both. `contact-form` has four of each.
  ["contact-form", contactForm as unknown as ViewSpec],
])("%s survives being edited", (_name, source) => {

  /** Counted from the text, not by walking — a different method to the code's. */
  const occurrences = (value: unknown, key: string): number =>
    JSON.stringify(value).split(`"${key}"`).length - 1;

  it("opens and closes unchanged", () => {
    expect(toSpec(fromSpec(source))).toEqual(source);
  });

  it("has the features this claims to protect, or the claim is empty", () => {
    // Between the two exemplars: data, forms, themeOverrides, and every binding
    // kind. Asserted so that a fixture losing a feature turns into a failure
    // here rather than into an assertion that quietly compares nothing.
    const present = ["data", "forms", "themeOverrides"].filter((key) => key in source);
    expect(present.length).toBeGreaterThan(1);
    expect(occurrences(source, "$ref")).toBeGreaterThan(0);
  });

  it("keeps its data, forms, state and theme through an edit elsewhere", () => {
    const opened = fromSpec(source);
    const edited = insertNode(opened, { component: "Divider" }, { path: [], zone: "inside" });
    const saved = toSpec(edited.document);

    expect(saved).not.toBeNull();
    expect(saved?.data).toEqual(source.data);
    expect(saved?.forms).toEqual(source.forms);
    expect(saved?.state).toEqual(source.state);
    expect(saved?.themeOverrides).toEqual(source.themeOverrides);
    expect(countNodes(saved?.root ?? null)).toBe(countNodes(source.root) + 1);
  });

  it("keeps every binding it never touched", () => {
    const opened = fromSpec(source);
    const edited = setProp(opened, [], "className", "demo");
    const saved = toSpec(edited.document);

    for (const key of ["$ref", "$each", "$cond", "$field"]) {
      expect(occurrences(saved, key), key).toBe(occurrences(source, key));
    }
  });

  it("is not what the canvas renders — the instrumentation reaches no saved document", () => {
    const opened = fromSpec(source);
    const instrumented = instrumentSpec(source);

    expect(JSON.stringify(instrumented)).toContain("data-rui-builder-path");
    expect(JSON.stringify(toSpec(opened))).not.toContain("data-rui-builder-path");
    // And the source it was derived from is untouched, so rendering twice does
    // not accumulate attributes.
    expect(JSON.stringify(source)).not.toContain("data-rui-builder-path");
  });
});
