import { describe, expect, it } from "vitest";

import { ARIA_IDREF_LIST_PROPS } from "../render/id-scope";
import { composeProp } from "./child-introspection";

/**
 * `composeProp` had no test of its own. Its ARIA merge was exercised only
 * indirectly, through one `aria-describedby` assertion in the parity suite, so
 * the *set* it merges on was asserted by nothing at all: dropping three members
 * and adding a bogus one left the whole package green.
 *
 * That matters most for the member this package added. `aria-flowto` is an id
 * reference list in ARIA 1.2 and was missing; no parent in the library injects
 * it, so no render test can reach it, and without this its membership is a claim
 * in a changelog rather than behaviour.
 */
describe("composeProp", () => {
  it("merges on exactly the ARIA id-reference lists", () => {
    expect([...ARIA_IDREF_LIST_PROPS].sort()).toEqual([
      "aria-controls",
      "aria-describedby",
      "aria-flowto",
      "aria-labelledby",
      "aria-owns",
    ]);
  });

  it.each([...ARIA_IDREF_LIST_PROPS])("appends an injected id to the document's own %s", (key) => {
    expect(composeProp(key, "authored", "injected")).toBe("authored injected");
  });

  it("does not append an id the document already listed", () => {
    expect(composeProp("aria-describedby", "a b", "b")).toBe("a b");
  });

  it("overwrites a prop that is not an id list", () => {
    // A parent injecting one of these owns it outright — merging would produce
    // a value neither side asked for.
    expect(composeProp("aria-expanded", "false", "true")).toBe("true");
    expect(composeProp("id", "authored", "injected")).toBe("injected");
  });

  it("treats an injected undefined as 'nothing to set', not 'clear it'", () => {
    // The parent computes what to inject from the renderer's props, never the
    // document's, so it cannot know what it would be erasing.
    expect(composeProp("aria-describedby", "authored", undefined)).toBe("authored");
  });

  it("runs both handlers when each side has one", () => {
    const calls: string[] = [];
    const composed = composeProp(
      "onClick",
      () => calls.push("document"),
      () => calls.push("parent"),
    ) as () => void;
    composed();
    expect(calls).toEqual(["document", "parent"]);
  });
});
