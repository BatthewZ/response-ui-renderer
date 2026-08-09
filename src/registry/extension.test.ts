import { describe, expect, it } from "vitest";

import { DEFAULT_CATEGORIES, defaultReferenceContracts, renderComponentReference } from "../reference";
import { NAME_PROP_MEANING } from "../render/id-scope";
import {
  type ComponentContracts,
  componentNamesOf,
  contractFor,
  DIALOG_COMPONENTS,
  extendContracts,
  ownProp,
  PROP_ENUMS,
} from "../spec/contracts";
import { enumeratedValues, validateViewSpec, warningsOf } from "../spec/validate";
import { CHILD_INSPECTING_PARENTS } from "./child-introspection";
import { COMPONENT_NOTES } from "./component-notes";
import { defaultContracts } from "./default-contracts";
import { FUNCTION_CHILDREN } from "./function-children";
import { COMPONENT_TYPED_ICON_SLOTS } from "./icon-slots";
import { PROP_COERCIONS } from "./prop-coercions";
import { defaultRegistry, listComponentNames } from "./registry";
import { splitSlotKey } from "./slot-keys";
import { TEXT_CHILDREN } from "./text-children";

/**
 * `defaultContracts` is a *view* over the tables, not a second copy of them —
 * but nothing about assembling it is checked by the tables' own drift gates.
 * Drop a fold and every one of those still passes while the renderer quietly
 * loses a behaviour, which is the failure this package exists to prevent.
 */
describe("defaultContracts carries every table it is assembled from", () => {
  it("leaves the curated category and note to the reference tier", () => {
    // Documentation, read by nothing at render or validate time — so it rides
    // with the prop tables behind `/reference` rather than in the path of a
    // server-side gate that imports `/spec`.
    expect(Object.keys(COMPONENT_NOTES).length).toBeGreaterThan(0);
    for (const [name, note] of Object.entries(COMPONENT_NOTES)) {
      expect(contractFor(defaultReferenceContracts, name), name).toMatchObject(note);
      expect(contractFor(defaultContracts, name).note, name).toBeUndefined();
    }
  });

  it("answers enumeratedValues from the same contracts the validator reads", () => {
    // Two exported APIs describing one fact must not be able to disagree.
    const contracts = extendContracts(defaultContracts, {
      BarChart: { propEnums: { orientation: ["horizontal", "vertical"] } },
    });
    expect(enumeratedValues("BarChart", "orientation", contracts)).toEqual([
      "horizontal",
      "vertical",
    ]);
    expect(enumeratedValues("BarChart", "orientation")).toBeUndefined();
    expect(enumeratedValues("Alert", "variant")).toEqual(PROP_ENUMS["Alert.variant"]);
  });

  it("carries every enumerated prop, under the component that owns it", () => {
    expect(Object.keys(PROP_ENUMS).length).toBeGreaterThan(0);
    for (const [key, values] of Object.entries(PROP_ENUMS)) {
      const [name, prop] = splitSlotKey(key);
      expect(contractFor(defaultContracts, name).propEnums?.[prop], key).toEqual(values);
    }
  });

  it("carries every coercion", () => {
    expect(PROP_COERCIONS.size).toBeGreaterThan(0);
    for (const [key, coercion] of PROP_COERCIONS) {
      const [name, prop] = splitSlotKey(key);
      expect(contractFor(defaultContracts, name).coercions?.[prop], key).toBe(coercion);
    }
  });

  it("carries every function-children and text-children entry", () => {
    expect(Object.keys(FUNCTION_CHILDREN).length).toBeGreaterThan(0);
    for (const [name, entry] of Object.entries(FUNCTION_CHILDREN)) {
      expect(contractFor(defaultContracts, name).functionChildren, name).toEqual(entry);
    }
    expect(Object.keys(TEXT_CHILDREN).length).toBeGreaterThan(0);
    for (const [name, note] of Object.entries(TEXT_CHILDREN)) {
      expect(contractFor(defaultContracts, name).textChildren, name).toBe(note);
    }
  });

  it("carries every dialog, child-inspecting parent, icon slot and name meaning", () => {
    expect(DIALOG_COMPONENTS.size).toBeGreaterThan(0);
    for (const name of DIALOG_COMPONENTS) {
      expect(contractFor(defaultContracts, name).dialog, name).toBe(true);
    }
    for (const [name, mode] of CHILD_INSPECTING_PARENTS) {
      expect(contractFor(defaultContracts, name).childInspection, name).toBe(mode);
    }
    expect(COMPONENT_TYPED_ICON_SLOTS.size).toBeGreaterThan(0);
    for (const key of COMPONENT_TYPED_ICON_SLOTS) {
      const [name, prop] = splitSlotKey(key);
      expect(contractFor(defaultContracts, name).iconComponentProps, key).toContain(prop);
    }
    for (const [name, meaning] of Object.entries(NAME_PROP_MEANING)) {
      expect(contractFor(defaultContracts, name).nameProp, name).toBe(meaning);
    }
  });

  it("claims nothing about a component it was never told about", () => {
    expect(contractFor(defaultContracts, "NoSuchComponent")).toEqual({});
    // A document naming a prototype member must not reach one.
    expect(contractFor(defaultContracts, "constructor")).toEqual({});
    expect(contractFor(defaultContracts, "__proto__")).toEqual({});
  });
});

describe("extendContracts", () => {
  const base: ComponentContracts = { Card: { category: "Layout", note: "a card" } };

  it("adds to an existing record rather than replacing it", () => {
    const merged = extendContracts(base, { Card: { propEnums: { tone: ["a", "b"] } } });
    expect(merged.Card).toEqual({
      category: "Layout",
      note: "a card",
      propEnums: { tone: ["a", "b"] },
    });
  });

  it("replaces a field it names, whole", () => {
    const merged = extendContracts(
      { Card: { propEnums: { tone: ["a"], size: ["s"] } } },
      { Card: { propEnums: { tone: ["z"] } } },
    );
    // Not merged inside the field: a partial set is indistinguishable from a
    // complete one, so the caller's is taken as complete.
    expect(merged.Card.propEnums).toEqual({ tone: ["z"] });
  });

  it("does not mutate the base", () => {
    extendContracts(base, { Card: { note: "changed" }, Widget: {} });
    expect(base.Card.note).toBe("a card");
    expect(Object.hasOwn(base, "Widget")).toBe(false);
  });

  it("resolves no prop through the prototype of a contract's own records", () => {
    // A contract is an object literal, here and in every host, so it carries
    // `Object.prototype`. A document names its own prop keys, which means it
    // picks `constructor` if it wants to — and the tables this replaced were a
    // Map and an `Object.hasOwn` guard.
    const contracts = extendContracts(defaultContracts, {
      Probe: { coercions: { since: "isoDate" }, propEnums: { tone: ["a"] } },
    });
    const contract = contractFor(contracts, "Probe");
    for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty"]) {
      expect(ownProp(contract.coercions, key), key).toBeUndefined();
      expect(enumeratedValues("Probe", key, contracts), key).toBeUndefined();
    }
    expect(ownProp(contract.coercions, "since")).toBe("isoDate");
  });

  it("cannot be reached through the prototype", () => {
    const merged = extendContracts(defaultContracts, {});
    expect(Object.getPrototypeOf(merged)).toBe(null);
    expect(contractFor(merged, "toString")).toEqual({});
  });
});

describe("componentNamesOf", () => {
  it("reads compound parts out of a registry", () => {
    const names = componentNamesOf({
      Widget: { subComponents: { Item: () => null } },
      Plain: {},
    });
    expect([...names].sort()).toEqual(["Plain", "Widget", "Widget.Item"]);
  });

  it("accepts the serialisable form, so a name list survives a process boundary", () => {
    const names = listComponentNames(defaultRegistry);
    expect(componentNamesOf(JSON.parse(JSON.stringify(names)) as string[])).toEqual(
      componentNamesOf(defaultRegistry),
    );
  });
});

describe("validateViewSpec against a registry", () => {
  const spec = (component: string, props: Record<string, unknown> = {}) => ({
    version: 1,
    title: "t",
    root: { component, props },
  });

  const registry = ["Card", "Table", "Table.Row", "BarChart"];

  it("says nothing about any name when no registry is given", () => {
    const result = validateViewSpec(spec("Cadr"));
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("reports a misspelled component, and names the one it meant", () => {
    const result = validateViewSpec(spec("Cadr"), { registry });
    const [issue] = warningsOf(result.issues);
    expect(issue.path).toBe("root.component");
    expect(issue.message).toContain('unknown component "Cadr"');
    expect(issue.message).toContain('did you mean "Card"');
    // Still conforming: `ok` means conformance, which the Zod mirror must match.
    expect(result.ok).toBe(true);
  });

  it("reports a misspelled compound part against its own parent", () => {
    const result = validateViewSpec(spec("Table.Rowe"), { registry });
    const [issue] = warningsOf(result.issues);
    expect(issue.message).toContain('"Table" has no compound part "Rowe"');
    expect(issue.message).toContain('did you mean "Table.Row"');
  });

  it("sees a transposition as one slip, not two edits", () => {
    // The shape the request named. Two substitutions under plain Levenshtein,
    // which would put the commonest typo of all outside every sane threshold.
    for (const [typo, meant] of [
      ["Cadr", "Card"],
      ["Talbe", "Table"],
      ["Table.Rwo", "Table.Row"],
    ]) {
      const [issue] = warningsOf(validateViewSpec(spec(typo), { registry }).issues);
      expect(issue.message, typo).toContain(`did you mean "${meant}"`);
    }
  });

  it("suggests the likelier word when two candidates tie", () => {
    // A transposition and a substitution both cost 1, so ties are common. Taken
    // in registry order, `"Tabel"` resolved to `Label` — a real component, in a
    // message an author is meant to act on.
    for (const [typo, meant] of [
      ["Tabel", "Table"],
      ["lable", "Label"],
      ["emter", "Meter"],
    ]) {
      const [issue] = warningsOf(
        validateViewSpec(spec(typo), { registry: defaultRegistry }).issues,
      );
      expect(issue.message, typo).toContain(`did you mean "${meant}"`);
    }
  });

  it("suggests the compound part when the dot was dropped", () => {
    // 73 of the registry's 175 names are compound parts, and dropping the dot
    // is the likeliest slip a PascalCase mental model makes — so this was the
    // whole no-suggestion population, every case one edit from a real name.
    const [issue] = warningsOf(
      validateViewSpec(spec("AccordionItem"), { registry: defaultRegistry }).issues,
    );
    expect(issue.message).toContain('did you mean "Accordion.Item"');
  });

  it("still never offers a root as the fix for a compound part", () => {
    const [issue] = warningsOf(
      validateViewSpec(spec("Table.Crd"), { registry: defaultRegistry }).issues,
    );
    const suggestion = /did you mean "([^"]+)"/.exec(issue.message)?.[1];
    expect(suggestion === undefined || suggestion.includes(".")).toBe(true);
  });

  it("charges nothing for a wrong capital", () => {
    const [issue] = warningsOf(validateViewSpec(spec("cadr"), { registry }).issues);
    expect(issue.message).toContain('did you mean "Card"');
  });

  it("suggests nothing when nothing is close", () => {
    const result = validateViewSpec(spec("Klaxon"), { registry });
    const [issue] = warningsOf(result.issues);
    expect(issue.message).toContain('unknown component "Klaxon"');
    expect(issue.message).not.toContain("did you mean");
  });

  it("never offers a root component as the fix for a compound part", () => {
    // `"Card"` is one edit from `"Cart"`, but a root cannot go where a part was
    // asked for, so the suggestion would send an author somewhere useless.
    const result = validateViewSpec(spec("Table.Card"), { registry });
    const [issue] = warningsOf(result.issues);
    expect(issue.message).not.toContain("did you mean");
  });

  it("accepts a registry object as readily as a list of names", () => {
    const fromRegistry = validateViewSpec(spec("Cadr"), { registry: defaultRegistry });
    expect(warningsOf(fromRegistry.issues)[0].message).toContain('did you mean "Card"');
  });

  it("passes a document that names only registered components", () => {
    const result = validateViewSpec(
      { version: 1, title: "t", root: { component: "Table", children: [{ component: "Table.Row" }] } },
      { registry },
    );
    expect(result.issues).toEqual([]);
  });

  it("reaches a node in a prop, at any depth", () => {
    // `$node` puts a ViewNode in a prop position and the renderer renders it
    // through the same path as a child, so it validated clean while producing
    // the very inline warning validation exists to pre-empt. The corpus uses
    // this shape eight times — `DataTable` column `render`, `Wizard` step
    // `content` — so the blind spot covered real documents.
    const result = validateViewSpec(
      {
        version: 1,
        title: "t",
        root: {
          component: "Card",
          props: {
            columns: [{ render: { $node: { component: "Table", children: [{ component: "Cadr" }] } } }],
          },
        },
      },
      { registry },
    );
    expect(warningsOf(result.issues).map((issue) => issue.path)).toEqual([
      "root.props.columns[0].render.$node.children[0].component",
    ]);
  });

  it("leaves ordinary data in a prop alone", () => {
    // A row that happens to carry a `component` key is a row, not a node.
    const result = validateViewSpec(
      {
        version: 1,
        title: "t",
        root: { component: "Card", props: { rows: [{ component: "Cadr", qty: 2 }] } },
      },
      { registry },
    );
    expect(result.issues).toEqual([]);
  });

  it("reaches names nested anywhere a node can appear", () => {
    const result = validateViewSpec(
      {
        version: 1,
        title: "t",
        root: {
          component: "Card",
          children: [{ $cond: "data.x", then: { component: "Cadr" } }],
        },
      },
      { registry },
    );
    expect(warningsOf(result.issues)[0].path).toBe("root.children[0].then.component");
  });
});

describe("validateViewSpec against custom contracts", () => {
  const registry = ["BarChart", "MyDialog", "MyMarkdown"];
  const contracts = extendContracts(defaultContracts, {
    BarChart: { propEnums: { orientation: ["horizontal", "vertical"] } },
    MyDialog: { dialog: true },
    MyMarkdown: { textChildren: "one string" },
  });

  const check = (root: unknown) =>
    warningsOf(validateViewSpec({ version: 1, title: "t", root }, { registry, contracts }).issues);

  it("warns on a value outside a custom component's set", () => {
    const [issue] = check({ component: "BarChart", props: { orientation: "sideways" } });
    expect(issue.path).toBe("root.props.orientation");
    expect(issue.message).toContain("BarChart.orientation");
    expect(issue.message).toContain("horizontal, vertical");
  });

  it("accepts a value inside it", () => {
    expect(check({ component: "BarChart", props: { orientation: "vertical" } })).toEqual([]);
  });

  it("warns that a custom dialog no action can target is unreachable", () => {
    const [issue] = check({ component: "MyDialog" });
    expect(issue.message).toContain("MyDialog needs a literal string \"id\"");
    expect(check({ component: "MyDialog", props: { id: "confirm" } })).toEqual([]);
  });

  it("warns when a custom text-children root is handed composed children", () => {
    const [issue] = check({
      component: "MyMarkdown",
      children: [{ component: "BarChart" }],
    });
    expect(issue.message).toContain("MyMarkdown parses its children as text");
  });

  it("sees a composed child through the wrappers that resolve to text", () => {
    // `childrenToText` walks `$each` and `$cond` and resolves them to their
    // text, so a component inside one contributes nothing exactly as a bare
    // component child does — and `children-text.ts` says the validator names
    // this rather than inventing text. Read off the child alone, the promise
    // held only for the unwrapped spelling: the root rendered an empty string
    // and nothing anywhere reported it.
    for (const wrapped of [
      { $each: "data.sections", as: "s", node: { component: "BarChart" } },
      { $cond: "data.flag", then: { component: "BarChart" } },
      { $cond: "data.flag", then: "text", else: { component: "BarChart" } },
    ]) {
      const [issue] = check({ component: "MyMarkdown", children: [wrapped] });
      expect(issue?.message, JSON.stringify(wrapped)).toContain(
        "MyMarkdown parses its children as text",
      );
    }
  });

  it("leaves a wrapper that does resolve to text alone", () => {
    expect(
      check({
        component: "MyMarkdown",
        children: [{ $each: "data.lines", as: "l", node: { $ref: "l" } }],
      }),
    ).toEqual([]);
  });

  it("keeps every built-in check while adding the host's", () => {
    const [issue] = warningsOf(
      validateViewSpec(
        { version: 1, title: "t", root: { component: "Dialog" } },
        { registry: [...registry, "Dialog"], contracts },
      ).issues,
    );
    expect(issue.message).toContain('Dialog needs a literal string "id"');
  });

  it("checks only what it is given when the defaults are not extended", () => {
    const bare = warningsOf(
      validateViewSpec(
        { version: 1, title: "t", root: { component: "Dialog" } },
        { contracts: { BarChart: {} } },
      ).issues,
    );
    expect(bare).toEqual([]);
  });
});

describe("renderComponentReference", () => {
  const contracts: ComponentContracts = {
    BarChart: {
      category: "Charts",
      note: "Bind `series` with `$ref`.",
      props: [
        { key: "series", optional: false, type: "Series[]" },
        { key: "orientation", optional: true, type: '"horizontal"|"vertical"' },
      ],
      slots: ["axis", "legend"],
      functionChildren: { args: ["point"], note: "Called **once per point**." },
    },
    "BarChart.Legend": { slots: ["swatch"] },
    Prose: { category: "Charts", textChildren: "one string" },
  };
  const categories = [{ name: "Charts", blurb: "Rendered from live data." }];

  it("documents a host's components the way the library's are documented", () => {
    const { components } = renderComponentReference(contracts, { categories });
    expect(components).toContain("### Charts");
    expect(components).toContain("Rendered from live data.");
    // Required props lead; the compound part is read off the addressable names.
    expect(components).toContain(
      '| `BarChart` | `.Legend` | `series`: Series[] · `orientation?`: "horizontal"\\|"vertical" | Bind `series` with `$ref`. |',
    );
    // A component with nothing declared still gets its row.
    expect(components).toContain("| `Prose` | — | — |  |");
  });

  it("emits the slot, function-children and text-children tables", () => {
    const regions = renderComponentReference(contracts, { categories });
    expect(regions.slots).toContain("| `BarChart` | `axis` `legend` |");
    expect(regions.slots).toContain("| `BarChart.Legend` | `swatch` |");
    expect(regions.functionChildren).toContain("| `BarChart` | Called **once per point**. | `point` |");
    expect(regions.textChildren).toContain("| `Prose` | one string |");
  });

  it("refuses to silently drop a component whose category is not in the list", () => {
    expect(() => renderComponentReference(contracts, { categories: DEFAULT_CATEGORIES })).toThrow(/Charts/);
  });

  it("renders the built-in components and a host's from one call", () => {
    // `defaultReferenceContracts`, not `defaultContracts` — the categories and
    // notes that put the library's own components in the table are reference
    // data, and the core contracts deliberately do not carry them.
    const merged = extendContracts(defaultReferenceContracts, contracts);
    const { components } = renderComponentReference(merged, { categories: [...DEFAULT_CATEGORIES, ...categories] });
    expect(components).toContain("| `Card` |");
    expect(components).toContain("| `BarChart` |");
  });
});
