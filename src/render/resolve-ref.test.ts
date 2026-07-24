import { describe, expect, it } from "vitest";

import { type RefContext, refToText, resolveDeep, resolveRef } from "./resolve-ref";

const context: RefContext = {
  data: {
    user: { name: "Ada", tags: ["a", "b"], nested: { deep: { value: 42 } } },
    count: 3,
    row: "DATA_ROW",
  },
  forms: {
    contact: { values: { email: "a@b.c", age: 30 }, errors: { email: "Required" } },
  },
  vars: { row: { label: "VAR_ROW" }, rowIndex: 1, state: { open: true } },
};

describe("resolveRef — namespaces", () => {
  it.each([
    ["data.user.name", "Ada"],
    ["data.count", 3],
    ["data.user.nested.deep.value", 42],
    ["data.user.tags.1", "b"],
  ])("resolves %s", (path, expected) => {
    expect(resolveRef(path, context)).toBe(expected);
  });

  it("resolves the canonical forms path", () => {
    expect(resolveRef("forms.contact.values.email", context)).toBe("a@b.c");
    expect(resolveRef("forms.contact.errors.email", context)).toBe("Required");
  });

  it("resolves the forms shorthand", () => {
    expect(resolveRef("forms.contact.email", context)).toBe("a@b.c");
    expect(resolveRef("forms.contact.age", context)).toBe(30);
  });

  it("returns the whole form and the whole namespace", () => {
    expect(resolveRef("forms.contact", context)).toEqual({
      values: { email: "a@b.c", age: 30 },
      errors: { email: "Required" },
    });
    expect(resolveRef("forms", context)).toBe(context.forms);
  });

  it("resolves view state through vars", () => {
    expect(resolveRef("state.open", context)).toBe(true);
  });

  it("supports the bare data-key shorthand", () => {
    expect(resolveRef("user.name", context)).toBe("Ada");
    expect(resolveRef("count", context)).toBe(3);
  });
});

describe("resolveRef — precedence", () => {
  it("prefers an iterator variable over a data key of the same name", () => {
    expect(resolveRef("row.label", context)).toBe("VAR_ROW");
  });

  it("still reaches the shadowed data key through the explicit namespace", () => {
    expect(resolveRef("data.row", context)).toBe("DATA_ROW");
  });
});

describe("resolveRef — missing and hostile paths", () => {
  it.each([
    "",
    "nope",
    "data.nope",
    "data.user.nope.deeper",
    "forms.nope.email",
    "forms.contact.nope",
    "data.count.nope",
  ])("returns undefined for %j", (path) => {
    expect(resolveRef(path, context)).toBeUndefined();
  });

  it("refuses to walk the prototype chain", () => {
    for (const path of [
      "data.user.constructor",
      "data.user.__proto__",
      "data.user.toString",
      "data.user.hasOwnProperty",
      "data.__proto__.polluted",
    ]) {
      expect(resolveRef(path, context)).toBeUndefined();
    }
  });

  it("does not treat a non-string path as a path", () => {
    expect(resolveRef(null as unknown as string, context)).toBeUndefined();
    expect(resolveRef(42 as unknown as string, context)).toBeUndefined();
  });

  it("exposes string length but nothing else on a string", () => {
    expect(resolveRef("data.row.length", context)).toBe(8);
    expect(resolveRef("data.row.toUpperCase", context)).toBeUndefined();
  });
});

describe("resolveDeep", () => {
  it("replaces refs nested in objects and arrays", () => {
    expect(
      resolveDeep(
        { a: { $ref: "data.user.name" }, b: [{ $ref: "data.count" }, "literal"] },
        context,
      ),
    ).toEqual({ a: "Ada", b: [3, "literal"] });
  });

  it("leaves primitives untouched", () => {
    expect(resolveDeep("plain", context)).toBe("plain");
    expect(resolveDeep(7, context)).toBe(7);
    expect(resolveDeep(null, context)).toBeNull();
  });

  it("resolves an unknown ref to undefined rather than throwing", () => {
    expect(resolveDeep({ a: { $ref: "nope" } }, context)).toEqual({ a: undefined });
  });

  it("stops at the depth limit rather than recursing forever", () => {
    // A self-referential payload would otherwise recurse until the stack blows.
    const cyclic: Record<string, unknown> = { name: "root" };
    cyclic.self = cyclic;
    expect(() => resolveDeep(cyclic, context)).not.toThrow();
  });
});

describe("refToText", () => {
  it.each([
    ["str", "str"],
    [7, "7"],
    [true, "true"],
    [false, "false"],
  ])("renders %j", (value, expected) => {
    expect(refToText(value)).toBe(expected);
  });

  it("renders null and undefined as nothing", () => {
    expect(refToText(null)).toBeNull();
    expect(refToText(undefined)).toBeNull();
  });

  it("renders objects as JSON", () => {
    expect(refToText({ a: 1 })).toBe('{"a":1}');
    expect(refToText([1, 2])).toBe("[1,2]");
  });

  it("survives a value JSON cannot serialise", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(refToText(cyclic)).toBeNull();
  });
});
