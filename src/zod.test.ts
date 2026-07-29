import { describe, expect, it } from "vitest";

import { exampleSpecs } from "./examples";
import { EVENT_ACTION_NAMES } from "./spec/types";
import { errorsOf, EVENT_ACTIONS, MAX_NODE_DEPTH, validateViewSpec } from "./spec/validate";
import { viewSpecJsonSchema, viewSpecSchema } from "./zod";

/**
 * The two validators share a CONFORMANCE contract, not a whole one.
 *
 * `validateViewSpec` is two-tier: `ok` answers "does this document conform to
 * the format", and `issues` additionally carries advisory policy the renderer
 * enforces at render time (forbidden props, dangerous URLs, unknown actions,
 * non-token theme overrides). Zod is single-tier, so it can only mirror the
 * first tier.
 *
 * What is enforced here: **the two agree on `ok` for every document.** What is
 * deliberately NOT claimed: that Zod reproduces the advisory tier — the last
 * describe block pins that divergence so it stays a decision rather than rot.
 *
 * ETHOS.md names the equivalent duplication between response-ui-css and
 * response-ui-tw-merge as the system's main fragility, with "no runtime
 * enforcement to catch drift". Here there is.
 */

/** Documents that must be accepted by BOTH validators. */
const VALID: [string, unknown][] = [
  ["minimal", { version: 1, title: "T", root: "hi" }],
  ["component root", { version: 1, title: "T", root: { component: "Card" } }],
  [
    "every node kind",
    {
      version: 1,
      title: "T",
      root: {
        component: "Stack",
        props: { gap: "r3" },
        children: [
          "text",
          { $ref: "data.x" },
          { $cond: "data.flag", then: "a", else: "b" },
          { $each: "data.rows", as: "row", node: { $ref: "row" } },
        ],
      },
    },
  ],
  [
    "all three bindings",
    {
      version: 1,
      title: "T",
      root: "x",
      data: {
        a: { type: "static", value: { nested: [1, 2] } },
        b: { type: "api", endpoint: "/api/x", method: "POST", headers: { A: "b" } },
        c: { type: "source", source: "crm", params: { id: 1 } },
      },
    },
  ],
  [
    "forms with validation",
    {
      version: 1,
      title: "T",
      root: "x",
      forms: {
        f: {
          fields: {
            email: { initialValue: "", validation: { required: true, minLength: 3 } },
          },
          onSubmit: { action: "showToast", payload: { message: "ok" } },
        },
      },
    },
  ],
  [
    "theme and overrides",
    {
      version: 1,
      title: "T",
      root: "x",
      theme: "aurora",
      themeOverrides: { "--C-PRIMARY": "oklch(0.6 0.15 220)" },
    },
  ],
  ["description", { version: 1, title: "T", description: "d", root: "x" }],
];

/** Documents that must be REJECTED by both validators. */
const INVALID: [string, unknown][] = [
  ["a string", "nope"],
  ["null", null],
  ["an array", []],
  ["no version", { title: "T", root: "x" }],
  ["version 2", { version: 2, title: "T", root: "x" }],
  ["string version", { version: "1", title: "T", root: "x" }],
  ["no title", { version: 1, root: "x" }],
  ["empty title", { version: 1, title: "", root: "x" }],
  ["title over 200 chars", { version: 1, title: "x".repeat(201), root: "x" }],
  ["no root", { version: 1, title: "T" }],
  ["numeric root", { version: 1, title: "T", root: 42 }],
  ["root with no discriminator", { version: 1, title: "T", root: { nope: true } }],
  ["empty component name", { version: 1, title: "T", root: { component: "" } }],
  ["non-string $ref", { version: 1, title: "T", root: { $ref: 42 } }],
  ["$each without as", { version: 1, title: "T", root: { $each: "d", node: "x" } }],
  ["$each with empty as", { version: 1, title: "T", root: { $each: "d", as: "", node: "x" } }],
  ["$each without node", { version: 1, title: "T", root: { $each: "d", as: "i" } }],
  ["$cond without then", { version: 1, title: "T", root: { $cond: "d" } }],
  ["children not an array", { version: 1, title: "T", root: { component: "C", children: "x" } }],
  ["props not an object", { version: 1, title: "T", root: { component: "C", props: "x" } }],
  [
    "unknown binding type",
    { version: 1, title: "T", root: "x", data: { k: { type: "connection", connectionId: "c", path: "p" } } },
  ],
  ["api binding without endpoint", { version: 1, title: "T", root: "x", data: { k: { type: "api" } } }],
  ["source binding without source", { version: 1, title: "T", root: "x", data: { k: { type: "source" } } }],
  ["form field without initialValue", { version: 1, title: "T", root: "x", forms: { f: { fields: { a: {} } } } }],
  ["form without fields", { version: 1, title: "T", root: "x", forms: { f: {} } }],
  [
    "unknown event action",
    { version: 1, title: "T", root: "x", forms: { f: { fields: {}, onSubmit: { action: "nope" } } } },
  ],
  ["non-string theme", { version: 1, title: "T", root: "x", theme: 7 }],
  ["non-string themeOverride value", { version: 1, title: "T", root: "x", themeOverrides: { "--A": 7 } }],
];

/**
 * Conformance only — `ok`, not `issues`. Folding `issues.length === 0` in here
 * would hide the fatal/advisory asymmetry rather than test it.
 */
const handAccepts = (input: unknown): boolean => validateViewSpec(input).ok;

const zodAccepts = (input: unknown): boolean => viewSpecSchema.safeParse(input).success;

describe("zod schema accepts what the hand-written validator accepts", () => {
  it.each(VALID)("%s", (_label, input) => {
    expect(handAccepts(input)).toBe(true);
    expect(zodAccepts(input)).toBe(true);
  });

  it.each(Object.entries(exampleSpecs))("real document: %s", (_name, doc) => {
    expect(handAccepts(doc)).toBe(true);
    expect(zodAccepts(doc)).toBe(true);
  });
});

describe("zod schema rejects what the hand-written validator rejects", () => {
  it.each(INVALID)("%s", (_label, input) => {
    expect(handAccepts(input)).toBe(false);
    expect(zodAccepts(input)).toBe(false);
  });
});

/**
 * Documents that conform structurally but carry advisory policy issues. Both
 * validators must ACCEPT them — the renderer enforces the policy at render
 * time by dropping the offending prop, not by refusing the document.
 */
const ADVISORY: [string, unknown][] = [
  ["forbidden prop", { version: 1, title: "T", root: { component: "Card", props: { ref: "x" } } }],
  [
    "dangerous URL",
    { version: 1, title: "T", root: { component: "Text", props: { href: "javascript:alert(1)" } } },
  ],
  [
    "unknown event action",
    { version: 1, title: "T", root: { component: "Button", props: { onClick: { action: "nope" } } } },
  ],
  [
    "non-object event payload",
    {
      version: 1,
      title: "T",
      root: { component: "Button", props: { onClick: { action: "navigate", payload: 5 } } },
    },
  ],
  ["non-token theme override", { version: 1, title: "T", root: "x", themeOverrides: { color: "red" } }],
  [
    "nesting past the depth cap",
    {
      version: 1,
      title: "T",
      root: Array.from({ length: MAX_NODE_DEPTH + 5 }).reduce<unknown>(
        (inner) => ({ component: "Stack", children: [inner] }),
        "leaf",
      ),
    },
  ],
];

describe("advisory policy is reported, not rejected", () => {
  it.each(ADVISORY)("%s: both validators accept, hand validator reports", (_label, input) => {
    expect(handAccepts(input)).toBe(true);
    expect(zodAccepts(input)).toBe(true);
    expect(validateViewSpec(input).issues.length).toBeGreaterThan(0);
  });
});

describe("the api-binding surfaces match", () => {
  // Zod types `method` and `headers`; the hand validator did not, so a document
  // with `method: 5` was clean to one and rejected by the other.
  it.each([
    ["numeric method", { type: "api", endpoint: "/a", method: 5 }],
    ["non-object headers", { type: "api", endpoint: "/a", headers: "x" }],
    ["numeric header value", { type: "api", endpoint: "/a", headers: { a: 5 } }],
  ])("%s is flagged by the hand validator and rejected by zod", (_label, binding) => {
    const doc = { version: 1, title: "T", root: "x", data: { k: binding } };
    expect(validateViewSpec(doc).issues.length).toBeGreaterThan(0);
    expect(zodAccepts(doc)).toBe(false);
  });
});

describe("every event action is known to both validators", () => {
  // The two lists were kept by hand, and Zod's could fall behind silently: a
  // schema whose action union is a strict SUBSET of EventAction is still
  // assignable to ZodType<ViewSpec>, and a subset is exactly what you get by
  // adding an action and forgetting this file. Both now derive from one tuple;
  // this asserts the derivation actually reaches both.
  it.each([...EVENT_ACTION_NAMES])("%s conforms to both", (action) => {
    const doc = { version: 1, title: "T", root: "x", forms: { f: { fields: {}, onSubmit: { action } } } };
    expect(errorsOf(validateViewSpec(doc).issues)).toEqual([]);
    expect(zodAccepts(doc)).toBe(true);
  });

  it("covers every action the renderer dispatches", () => {
    expect([...EVENT_ACTION_NAMES].sort()).toEqual([...EVENT_ACTIONS].sort());
  });
});

describe("viewSpecJsonSchema", () => {
  it("produces an object schema describing the wire format", () => {
    const schema = viewSpecJsonSchema();
    expect(schema).toMatchObject({ type: "object" });
    expect(JSON.stringify(schema)).toContain("version");
    expect(JSON.stringify(schema)).toContain("root");
  });

  it("is JSON-serialisable, so it can be handed to a model as-is", () => {
    expect(() => JSON.stringify(viewSpecJsonSchema())).not.toThrow();
  });
});
