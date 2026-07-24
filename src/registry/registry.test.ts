import * as ResponseUI from "@batthewz/response-ui-react-components";
import { describe, expect, it } from "vitest";

import { defaultRegistry, listComponentNames } from "./registry";
import {
  createRegistryFromModule,
  extendRegistry,
  isExportedComponent,
  lookupComponent,
} from "./types";

/**
 * The registry is derived from the library's barrel rather than hand-listed, so
 * these tests are the enforcement of that claim. They read the LIVE barrel — a
 * snapshot fixture would pass forever while the real surface drifted away.
 */
/**
 * Enumerated WITHOUT `isExportedComponent`, deliberately.
 *
 * Filtering the barrel with the same predicate the registry is built from would
 * make the coverage assertion `f(x) ⊆ f(x)` — true no matter how wrong the
 * predicate got. This rule is broader (anything renderable, whatever its name),
 * so a component the predicate wrongly rejected still shows up here and fails.
 */
const renderableExports = Object.entries(ResponseUI)
  .filter(([, value]) => {
    if (typeof value === "function") return true;
    if (typeof value === "object" && value !== null && "$$typeof" in value) {
      const tag = (value as { $$typeof: unknown }).$$typeof;
      return tag === Symbol.for("react.forward_ref") || tag === Symbol.for("react.memo");
    }
    return false;
  })
  .map(([name]) => name);

describe("defaultRegistry coverage", () => {
  it("registers every component the library exports", () => {
    const missing = renderableExports.filter(
      (name) => /^[A-Z]/.test(name) && !(name in defaultRegistry),
    );
    expect(missing).toEqual([]);
    expect(Object.keys(defaultRegistry).length).toBeGreaterThan(90);
  });

  it("excludes only camelCase hooks and utilities, nothing PascalCase", () => {
    // The one thing that separates a component from a hook here is the name, so
    // assert exactly that — anything PascalCase left out is a coverage bug.
    const excluded = renderableExports.filter((name) => !(name in defaultRegistry));
    expect(excluded.filter((name) => /^[A-Z]/.test(name))).toEqual([]);
    expect(excluded.length).toBeGreaterThan(40);
  });

  it("keeps the predicate and the broad rule in agreement", () => {
    const byPredicate = Object.entries(ResponseUI)
      .filter(([name, value]) => isExportedComponent(name, value))
      .map(([name]) => name)
      .sort();
    const byName = renderableExports.filter((name) => /^[A-Z]/.test(name)).sort();
    expect(byPredicate).toEqual(byName);
  });

  it("registers nothing that is not a component", () => {
    // Hooks, utilities and constants must not become addressable from JSON.
    for (const name of ["useTheme", "cn", "addDays", "THEMES", "STORAGE_KEY", "useForm"]) {
      expect(name in defaultRegistry).toBe(false);
    }
  });

  it("resolves every declared sub-component to a real value", () => {
    const broken: string[] = [];
    for (const [name, entry] of Object.entries(defaultRegistry)) {
      for (const sub of Object.keys(entry.subComponents ?? {})) {
        if (lookupComponent(defaultRegistry, `${name}.${sub}`) == null) {
          broken.push(`${name}.${sub}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("discovers compound parts that a hand-written registry would miss", () => {
    // StatCard.Sparkline exists upstream and was absent from the hand-maintained
    // registry this package replaces; derivation picks it up for free.
    expect(lookupComponent(defaultRegistry, "StatCard.Sparkline")).toBeTruthy();
    expect(lookupComponent(defaultRegistry, "Table.Row")).toBeTruthy();
    expect(lookupComponent(defaultRegistry, "Tabs.Panel")).toBeTruthy();
  });

  it("does not invent compound parts that upstream removed", () => {
    // Table.Caption is not part of the library; the old registry claimed it.
    expect(lookupComponent(defaultRegistry, "Table.Caption")).toBeNull();
  });

  it("adds Icon, which the library does not export", () => {
    expect("Icon" in ResponseUI).toBe(false);
    expect(lookupComponent(defaultRegistry, "Icon")).toBeTruthy();
  });

  it("lists names including compound parts", () => {
    const names = listComponentNames(defaultRegistry);
    expect(names).toContain("Card");
    expect(names).toContain("Table.HeaderCell");
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe("lookupComponent hardening", () => {
  it("refuses prototype members", () => {
    for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
      expect(lookupComponent(defaultRegistry, name)).toBeNull();
    }
  });

  it("refuses prototype members in the compound position", () => {
    expect(lookupComponent(defaultRegistry, "Table.__proto__")).toBeNull();
    expect(lookupComponent(defaultRegistry, "Table.toString")).toBeNull();
  });

  it("returns null for unknown names rather than throwing", () => {
    expect(lookupComponent(defaultRegistry, "NotAThing")).toBeNull();
    expect(lookupComponent(defaultRegistry, "NotAThing.Child")).toBeNull();
    expect(lookupComponent(defaultRegistry, "")).toBeNull();
  });
});

describe("isExportedComponent", () => {
  it("accepts function components and forwardRef objects", () => {
    expect(isExportedComponent("Thing", () => null)).toBe(true);
    expect(
      isExportedComponent("Thing", { $$typeof: Symbol.for("react.forward_ref"), render: () => null }),
    ).toBe(true);
    expect(isExportedComponent("Thing", { $$typeof: Symbol.for("react.memo") })).toBe(true);
  });

  it("rejects lowercase names, non-callables and unrelated objects", () => {
    expect(isExportedComponent("useThing", () => null)).toBe(false);
    expect(isExportedComponent("Thing", "nope")).toBe(false);
    expect(isExportedComponent("Thing", { $$typeof: Symbol.for("react.context") })).toBe(false);
    expect(isExportedComponent("Thing", null)).toBe(false);
  });
});

describe("extendRegistry", () => {
  const Custom = () => null;

  it("adds without mutating the base", () => {
    const extended = extendRegistry(defaultRegistry, { Custom });
    expect(lookupComponent(extended, "Custom")).toBe(Custom);
    expect(lookupComponent(defaultRegistry, "Custom")).toBeNull();
  });

  it("overrides an existing entry", () => {
    const extended = extendRegistry(defaultRegistry, { Button: Custom });
    expect(lookupComponent(extended, "Button")).toBe(Custom);
  });

  it("accepts a full entry with explicit sub-components", () => {
    const Child = () => null;
    const extended = extendRegistry(defaultRegistry, {
      Widget: { component: Custom, subComponents: { Child } },
    });
    expect(lookupComponent(extended, "Widget.Child")).toBe(Child);
  });
});

describe("createRegistryFromModule", () => {
  it("collects compound parts attached with Object.assign", () => {
    const Root = Object.assign(() => null, { Item: () => null, displayName: "Root" });
    const registry = createRegistryFromModule({ Root, helper: () => null, COUNT: 3 });
    expect(Object.keys(registry)).toEqual(["Root"]);
    expect(lookupComponent(registry, "Root.Item")).toBeTruthy();
    // `displayName` is a string, not a component — it must not become addressable.
    expect(lookupComponent(registry, "Root.displayName")).toBeNull();
  });
});
