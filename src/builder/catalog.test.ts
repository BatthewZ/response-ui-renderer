import { describe, expect, it } from "vitest";

import { NOT_ADDRESSABLE } from "../examples/not-addressable";
import { defaultReferenceContracts } from "../reference/contracts";
import { defaultRegistry, listComponentNames } from "../registry/registry";
import { extendRegistry } from "../registry/types";
import {
  type ComponentContracts,
  extendContracts,
  isComponentNode,
  isEventHandlerSpec,
  type ViewNode,
} from "../spec";
import { createBuilderCatalog, literalUnion, placeholderFromRef, templatesFromDocuments } from "./catalog";
import { defaultBuilderTemplates } from "./templates";

/**
 * The catalogue is the builder's only source of knowledge about components, and
 * the whole claim is that it *derives* rather than declares. These are the
 * checks that a hand-written list would fail: the palette is exactly the
 * registry, and a component the registry gained a minute ago is in it.
 */

const catalog = createBuilderCatalog({
  templates: defaultBuilderTemplates,
  excluded: NOT_ADDRESSABLE,
});

describe("the palette is the registry", () => {
  it("offers every addressable name that a document can drive, and no other", () => {
    const addressable = listComponentNames(defaultRegistry);
    const offered = catalog.entries.map((entry) => entry.name).sort();
    const expected = addressable
      .filter((name) => !Object.hasOwn(NOT_ADDRESSABLE, name))
      .sort();

    expect(offered).toEqual(expected);
    // The exclusions are real, and are the reason the two lists differ.
    expect(addressable.length - offered.length).toBe(Object.keys(NOT_ADDRESSABLE).length);
    expect(offered).not.toContain("FileUpload");
  });

  it("names each entry once", () => {
    expect(new Set(catalog.entries.map((entry) => entry.name)).size).toBe(catalog.entries.length);
  });

  it("groups every entry under a section that is actually emitted", () => {
    const grouped = catalog.groups.flatMap((group) => group.entries.map((entry) => entry.name));
    expect(grouped.sort()).toEqual(catalog.entries.map((entry) => entry.name).sort());
  });

  it("files a compound part under its root's own section", () => {
    const row = catalog.entry("Table.Row");
    expect(row).toBeDefined();
    expect(row?.parent).toBe("Table");
    expect(row?.label).toBe("Row");
    expect(row?.category).toBe(catalog.entry("Table")?.category);
    expect(catalog.parts("Table").map((part) => part.name)).toContain("Table.Row");
  });

  it("searches on the name a document spells, not the label", () => {
    expect(catalog.search("table.r").map((entry) => entry.name)).toContain("Table.Row");
    expect(catalog.search("").length).toBe(catalog.entries.length);
    expect(catalog.search("no-such-component")).toEqual([]);
  });
});

describe("which components take children", () => {
  it("reads it off the template, so the true leaves are leaves", () => {
    for (const leaf of ["Input", "Divider", "Avatar", "Checkbox", "Spacer"]) {
      expect(catalog.acceptsChildren(leaf), leaf).toBe(false);
    }
    for (const container of ["Card", "Stack", "Row", "Table.Row", "Accordion"]) {
      expect(catalog.acceptsChildren(container), container).toBe(true);
    }
  });

  it("refuses a component that parses its children as text", () => {
    // Dropping a component into `Markdown` would not nest it — the parser has
    // no use for it and the validator says so in as many words.
    expect(catalog.textChildren("Markdown")).toBeDefined();
    expect(catalog.acceptsChildren("Markdown")).toBe(false);
  });

  it("treats a component no template speaks for as a container", () => {
    // The forgiving direction: a host that registered something and has not
    // described it can still nest in it, and the render says at once whether
    // that was sensible.
    const bare = createBuilderCatalog({ templates: {} });
    expect(bare.acceptsChildren("Input")).toBe(true);
  });
});

describe("insertion templates", () => {
  it("names the component it was asked for, never another", () => {
    // The corpus is walked by component name and a template is whatever node was
    // found — so a walk that captured a *parent* node under a child's name would
    // hand back something that renders, validates, and is not what was dropped.
    const wrong = catalog.entries
      .filter((entry) => catalog.template(entry.name).component !== entry.name)
      .map((entry) => entry.name);
    expect(wrong).toEqual([]);
  });

  it("brings a compound component in assembled", () => {
    const table = catalog.template("Table");
    const names: string[] = [];
    const walk = (node: ViewNode): void => {
      if (!isComponentNode(node)) return;
      names.push(node.component);
      for (const child of node.children ?? []) walk(child);
    };
    walk(table);
    expect(names).toContain("Table.Row");
    expect(names).toContain("Table.Cell");
  });

  it("carries no binding out of the corpus it came from", () => {
    // A `$ref` into `data.rows` means nothing in a document with no `data`, and
    // a `$field` names a form that was never declared. `$node` is deliberately
    // not in this list: it is a nested node, not a binding, and it is how a
    // component with a `ReactNode` prop — `AppShell`'s sidebar — is composed at
    // all. Stripping it would hand back a shell with nothing in it.
    for (const entry of catalog.entries) {
      const json = JSON.stringify(catalog.template(entry.name));
      for (const binding of ["$ref", "$each", "$cond", "$field"]) {
        expect(json.includes(binding), `${entry.name} carries ${binding}`).toBe(false);
      }
    }
  });

  it("carries no handler, and keeps data that merely looks like one", () => {
    // Asserted on the shape rather than on the text: `"action"` appears in
    // `ActivityFeed`'s items as an ordinary column, and a check that reads the
    // JSON for the word deletes real data to go green.
    const handlers: string[] = [];
    for (const entry of catalog.entries) {
      for (const [key, value] of Object.entries(catalog.template(entry.name).props ?? {})) {
        if (isEventHandlerSpec(value)) handlers.push(`${entry.name}.${key}`);
      }
    }
    expect(handlers).toEqual([]);

    const feed = JSON.stringify(catalog.template("ActivityFeed"));
    expect(feed).toContain("action");
  });

  it("fills every required prop", () => {
    const missing: string[] = [];
    for (const entry of catalog.entries) {
      const template = catalog.template(entry.name);
      for (const prop of catalog.props(entry.name)) {
        if (prop.optional) continue;
        if (template.props?.[prop.key] === undefined) missing.push(`${entry.name}.${prop.key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("only ever seeds an enumerated prop with a member of its set", () => {
    const wrong: string[] = [];
    for (const entry of catalog.entries) {
      const template = catalog.template(entry.name);
      for (const [prop, values] of Object.entries(catalog.enums(entry.name))) {
        const value = template.props?.[prop];
        if (typeof value === "string" && !values.includes(value)) {
          wrong.push(`${entry.name}.${prop} = ${value}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it("hands back a copy, so editing one drop does not edit the next", () => {
    const first = catalog.template("Card");
    const second = catalog.template("Card");
    expect(first).not.toBe(second);
    first.props = { padding: "r1" };
    expect(catalog.template("Card").props?.padding).not.toBe("r1");
  });
});

describe("a host's own components", () => {
  const Widget = () => null;
  const registry = extendRegistry(defaultRegistry, { Widget });
  const contracts: ComponentContracts = extendContracts(defaultReferenceContracts, {
    Widget: {
      category: "Data",
      note: "A host's own.",
      propEnums: { tone: ["calm", "loud"] },
      slots: ["body"],
      props: [
        { key: "label", optional: false, type: "string" },
        { key: "tone", optional: true, type: '"calm"|"loud"' },
        { key: "size", optional: true, type: '"sm"|"lg"' },
      ],
    },
  });

  const extended = createBuilderCatalog({
    registry,
    contracts,
    templates: defaultBuilderTemplates,
    excluded: NOT_ADDRESSABLE,
  });

  it("puts it in the palette with the section its contract names", () => {
    const entry = extended.entry("Widget");
    expect(entry).toBeDefined();
    expect(entry?.category).toBe("Data");
    expect(entry?.note).toBe("A host's own.");
    expect(extended.groups.find((group) => group.category === "Data")?.entries.map((e) => e.name)).toContain(
      "Widget",
    );
  });

  it("gives it the same inspector the built-ins get", () => {
    expect(extended.enums("Widget")).toEqual({ tone: ["calm", "loud"] });
    expect(extended.slots("Widget")).toEqual(["body"]);
    // Required first, which is the order the reference prints them in.
    expect(extended.props("Widget").map((prop) => prop.key)).toEqual(["label", "tone", "size"]);
  });

  it("builds it a template out of its contract when no document names it", () => {
    const template = extended.template("Widget");
    expect(template.component).toBe("Widget");
    expect(template.props?.label).toBe("Label");
    // Optional props stay unset: a template is a starting point, not a filled
    // form, and every value it writes is one the author has to notice and undo.
    expect(template.props?.tone).toBeUndefined();
  });

  it("leaves a required prop it cannot type alone, rather than writing a word", () => {
    // A word where a handler, an array or an object belongs is worse than an
    // absent prop: `options.map is not a function` is a render error, and the
    // inspector reads a string as "no action" — showing a state the document
    // does not hold, with no control to clear it.
    const shapes = createBuilderCatalog({
      registry: extendRegistry(defaultRegistry, { Shapes: () => null }),
      contracts: extendContracts(defaultReferenceContracts, {
        Shapes: {
          category: "Data",
          props: [
            { key: "onPick", optional: false, type: "(value: string) => void" },
            { key: "config", optional: false, type: "PickerConfig" },
            { key: "rows", optional: false, type: "Array<Row>" },
            { key: "label", optional: false, type: "string" },
            { key: "count", optional: false, type: "number" },
          ],
        },
      }),
    });

    const props = shapes.template("Shapes").props ?? {};
    expect(props.onPick).toBeUndefined();
    expect(props.config).toBeUndefined();
    // A shape it *does* know still gets a usable value.
    expect(props.rows).toEqual([]);
    expect(props.label).toBe("Label");
    expect(props.count).toBe(1);
  });

  it("prefers a template the host supplies", () => {
    const withTemplate = createBuilderCatalog({
      registry,
      contracts,
      templates: { Widget: { component: "Widget", props: { label: "Sales" }, children: ["x"] } },
    });
    expect(withTemplate.template("Widget").props?.label).toBe("Sales");
    expect(withTemplate.acceptsChildren("Widget")).toBe(true);
  });

  it("leaves it out of a palette that has not registered it", () => {
    expect(catalog.entry("Widget")).toBeUndefined();
  });
});

describe("deriving values", () => {
  it("reads a union of literals, and refuses anything else", () => {
    expect(literalUnion('"sm"|"md"|"lg"')).toEqual(["sm", "md", "lg"]);
    expect(literalUnion('"sm" | "md"')).toEqual(["sm", "md"]);
    expect(literalUnion("string|number")).toBeNull();
    expect(literalUnion('"sm"|string')).toBeNull();
    // One literal is a constant, not a choice, and a picker over it is a
    // control that can only ever say what it already says.
    expect(literalUnion('"only"')).toBeNull();
    expect(literalUnion("")).toBeNull();
  });

  it("turns a binding path into the words it stood for", () => {
    expect(placeholderFromRef("data.user.firstName")).toBe("First name");
    expect(placeholderFromRef("row.total")).toBe("Total");
    expect(placeholderFromRef("data.rows.0.label")).toBe("Label");
    expect(placeholderFromRef("plain")).toBe("Plain");
  });

  it("takes the first node naming each component, out of any documents", () => {
    const templates = templatesFromDocuments([
      { version: 1, title: "a", root: { component: "Card", children: [{ component: "Text" }] } },
      { version: 1, title: "b", root: { component: "Card", props: { padding: "r1" } } },
    ]);
    expect(Object.keys(templates).sort()).toEqual(["Card", "Text"]);
    expect(templates.Card.children).toBeDefined();
  });
});
