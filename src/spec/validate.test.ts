import { describe, expect, it } from "vitest";

import { exampleSpecs } from "../examples";
import {
  enumeratedValues,
  errorsOf,
  isDangerousUrl,
  isViewSpec,
  MAX_NODE_DEPTH,
  PROP_ENUMS,
  validateViewSpec,
  warningsOf,
} from "./validate";

const minimal = { version: 1, title: "T", root: "hello" };

describe("validateViewSpec — required shape", () => {
  it("accepts a minimal document", () => {
    const result = validateViewSpec(minimal);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it.each([
    ["not an object", "nope"],
    ["null", null],
    ["an array", []],
    ["missing version", { title: "T", root: "x" }],
    ["wrong version", { version: 2, title: "T", root: "x" }],
    ["string version", { version: "1", title: "T", root: "x" }],
    ["missing title", { version: 1, root: "x" }],
    ["empty title", { version: 1, title: "", root: "x" }],
    ["missing root", { version: 1, title: "T" }],
  ])("rejects %s", (_label, input) => {
    expect(validateViewSpec(input).ok).toBe(false);
  });

  it("reports a path for every issue", () => {
    const result = validateViewSpec({ version: 9, title: "", root: undefined });
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.path).sort()).toEqual(["root", "title", "version"]);
    expect(result.issues.every((i) => i.severity === "error")).toBe(true);
  });

  it("rejects a title over 200 characters", () => {
    expect(validateViewSpec({ version: 1, title: "x".repeat(201), root: "x" }).ok).toBe(false);
  });
});

describe("validateViewSpec — nodes", () => {
  it("accepts every node type", () => {
    const spec = {
      version: 1,
      title: "T",
      root: {
        component: "Stack",
        children: [
          "text",
          { $ref: "data.x" },
          { $cond: "data.flag", then: "yes", else: "no" },
          { $each: "data.rows", as: "row", node: { $ref: "row.name" } },
        ],
      },
    };
    expect(validateViewSpec(spec).issues).toEqual([]);
  });

  it("rejects a node with no recognised discriminator", () => {
    const result = validateViewSpec({ version: 1, title: "T", root: { nope: true } });
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("must have one of");
  });

  it.each([
    ["$each missing as", { $each: "data.x", node: "y" }],
    ["$each empty as", { $each: "data.x", as: "", node: "y" }],
    ["$each missing node", { $each: "data.x", as: "i" }],
    ["$cond missing then", { $cond: "data.x" }],
    ["non-string $ref", { $ref: 42 }],
    ["empty component name", { component: "" }],
    ["non-array children", { component: "Card", children: "oops" }],
    ["non-object props", { component: "Card", props: "oops" }],
  ])("rejects %s", (_label, root) => {
    expect(validateViewSpec({ version: 1, title: "T", root }).ok).toBe(false);
  });

  it("bounds recursion instead of overflowing the stack", () => {
    let root: unknown = "leaf";
    for (let i = 0; i < MAX_NODE_DEPTH + 10; i += 1) {
      root = { component: "Stack", children: [root] };
    }
    const result = validateViewSpec({ version: 1, title: "T", root });
    // A warning, not an error: the renderer draws a diagnostic at the cap
    // rather than refusing the document.
    expect(warningsOf(result.issues).some((i) => i.message.includes("nesting"))).toBe(true);
    expect(result.ok).toBe(true);
  });
});

describe("validateViewSpec — hostile props", () => {
  it("flags forbidden props", () => {
    const result = validateViewSpec({
      version: 1,
      title: "T",
      root: { component: "Card", props: { dangerouslySetInnerHTML: { __html: "<script>" } } },
    });
    expect(warningsOf(result.issues).some((i) => i.message.includes("not allowed"))).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("flags script-bearing URLs", () => {
    const result = validateViewSpec({
      version: 1,
      title: "T",
      root: { component: "Button", props: { href: "javascript:alert(1)" } },
    });
    expect(warningsOf(result.issues).some((i) => i.message.includes("URL scheme"))).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("flags an unknown event action", () => {
    const result = validateViewSpec({
      version: 1,
      title: "T",
      root: { component: "Button", props: { onClick: { action: "dropTables" } } },
    });
    expect(warningsOf(result.issues).some((i) => i.message.includes("unknown action"))).toBe(true);
    expect(result.ok).toBe(true);
  });
});

describe("validateViewSpec — data, forms and theme", () => {
  it.each([
    ["static without value", { type: "static" }],
    ["api without endpoint", { type: "api" }],
    ["source without source", { type: "source" }],
    ["unknown type", { type: "connection", connectionId: "x", path: "y" }],
    ["not an object", "nope"],
  ])("rejects binding %s", (_label, binding) => {
    const result = validateViewSpec({ version: 1, title: "T", root: "x", data: { k: binding } });
    expect(result.ok).toBe(false);
  });

  it("accepts the three supported bindings", () => {
    const result = validateViewSpec({
      version: 1,
      title: "T",
      root: "x",
      data: {
        a: { type: "static", value: [1, 2] },
        b: { type: "api", endpoint: "/api/x", method: "POST" },
        c: { type: "source", source: "crm", params: { id: 1 } },
      },
    });
    expect(result.issues).toEqual([]);
  });

  it("reports a field with no initialValue", () => {
    const result = validateViewSpec({
      version: 1,
      title: "T",
      root: "x",
      forms: { f: { fields: { name: {} } } },
    });
    expect(errorsOf(result.issues).some((i) => i.path.endsWith("initialValue"))).toBe(true);
  });

  it("warns that a non-custom-property theme override is ignored", () => {
    const result = validateViewSpec({
      version: 1,
      title: "T",
      root: "x",
      themeOverrides: { background: "red" },
    });
    expect(warningsOf(result.issues).some((i) => i.message.includes("--"))).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("accepts custom property overrides silently", () => {
    const result = validateViewSpec({
      version: 1,
      title: "T",
      root: "x",
      themeOverrides: { "--C-PRIMARY": "oklch(0.6 0.15 220)" },
    });
    expect(result.issues).toEqual([]);
  });
});

describe("component-contract warnings point at what they are about", () => {
  const warn = (root: unknown) => warningsOf(validateViewSpec({ version: 1, title: "T", root }).issues);

  // The hint is about the node's children, and it fires on a node that may
  // declare no props at all — so `root.props` would name nothing that exists.
  it("reports an identity-check hint at the node, not at its props", () => {
    const issues = warn({
      component: "Hero",
      children: [{ component: "Hero.Background", props: { src: "/c.jpg", alt: "" } }],
    });
    expect(issues.map((i) => i.path)).toEqual(["root"]);
  });

  it("keeps the node path when the hint fires on a nested node", () => {
    const issues = warn({
      component: "Stack",
      children: [{ component: "Table.Body", children: [{ component: "Table.Row" }] }],
    });
    expect(issues.map((i) => i.path)).toEqual(["root.children[0]"]);
  });

  // These two name a prop to set, so they stay addressed to that prop.
  it("reports the dialog id hint at the prop to add", () => {
    expect(warn({ component: "Dialog" }).map((i) => i.path)).toEqual(["root.props.id"]);
  });

  it("reports the Radio binding hint at the offending prop", () => {
    const issues = warn({
      component: "Radio",
      props: { value: { $field: "form.choice" } },
    });
    expect(issues.map((i) => i.path)).toEqual(["root.props.value"]);
  });
});

describe("isDangerousUrl", () => {
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "java\u0000script:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
  ])("rejects %j", (url) => {
    expect(isDangerousUrl(url)).toBe(true);
  });

  it.each([
    "/local/path",
    "https://example.com",
    "mailto:a@b.c",
    "data:image/png;base64,iVBOR",
    "#anchor",
    "",
  ])("allows %j", (url) => {
    expect(isDangerousUrl(url)).toBe(false);
  });

  it("ignores non-strings", () => {
    expect(isDangerousUrl(null)).toBe(false);
    expect(isDangerousUrl(42)).toBe(false);
  });
});

describe("props bounded to a set of values", () => {
  const doc = (props: Record<string, unknown>) => ({
    version: 1,
    title: "T",
    root: { component: "MasonryGrid", props },
  });

  it("names the prop, the value and the whole set", () => {
    // The failure it is standing in for is silent: the component looks the value
    // up in a class table, misses, and renders with no gutter at all.
    const issues = warningsOf(validateViewSpec(doc({ gap: "1.25rem" })).issues);
    expect(issues).toEqual([
      {
        severity: "warning",
        path: "root.props.gap",
        message:
          '"1.25rem" is not one of MasonryGrid.gap\'s values (r1, r2, r3, r4, r5, r6); the component will render as if it were unset',
      },
    ]);
  });

  it("stays quiet on a value that is in the set", () => {
    expect(warningsOf(validateViewSpec(doc({ gap: "r4" })).issues)).toEqual([]);
  });

  it("says nothing about a value it cannot see", () => {
    // A `$ref` resolves at render time, and a prop the library does not bound is
    // none of this check's business. Warning on either teaches authors to ignore
    // warnings, which costs more than the check is worth.
    expect(warningsOf(validateViewSpec(doc({ gap: { $ref: "data.gap" } })).issues)).toEqual([]);
    expect(warningsOf(validateViewSpec(doc({ animate: false })).issues)).toEqual([]);
  });

  it("covers compound parts, not just roots", () => {
    const issues = warningsOf(
      validateViewSpec({
        version: 1,
        title: "T",
        root: { component: "StatCard.Trend", props: { value: 1, direction: "upwards" } },
      }).issues,
    );
    expect(issues.map((issue) => issue.path)).toEqual(["root.props.direction"]);
  });

  it("knows about more than a handful of props", () => {
    // An emptied table would make every assertion above pass by doing nothing:
    // no key, no lookup, no warning. Assert the table has content.
    expect(Object.keys(PROP_ENUMS).length).toBeGreaterThan(20);
    expect(enumeratedValues("MasonryGrid", "gap")).toEqual(["r1", "r2", "r3", "r4", "r5", "r6"]);
    expect(enumeratedValues("MasonryGrid", "animate")).toBeUndefined();
  });
});

describe("real generated documents", () => {
  it.each(Object.entries(exampleSpecs))("%s validates with no issues", (_name, spec) => {
    const result = validateViewSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("narrows with isViewSpec", () => {
    expect(isViewSpec(exampleSpecs.contactForm)).toBe(true);
    expect(isViewSpec({ nope: true })).toBe(false);
  });
});
