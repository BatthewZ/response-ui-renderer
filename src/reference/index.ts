import componentDocs from "../registry/component-docs.json";
import { COMPONENT_NOTES } from "../registry/component-notes";
import { defaultContracts } from "../registry/default-contracts";
import { type ComponentContracts, extendContracts, type PropDoc } from "../spec/contracts";

export { extendContracts };

/**
 * The reference tables, rendered from contracts.
 *
 * `VIEWSPEC.md` is produced by calling this — the generator's job is to *derive*
 * the facts from the library's shipped declarations, not to format them. So a
 * host documenting its own components gets the identical tables from the
 * identical code, rather than a second renderer that drifts. There is nothing
 * here a built-in component gets and a registered one does not.
 *
 * Prose is not generated and never will be: this returns the table regions, and
 * the words around them stay hand-written by whoever owns the document.
 */

/**
 * `defaultContracts` plus everything only a reference reads — the prop tables,
 * the slot keys, and the curated category and note.
 *
 * A separate value behind a separate entry point, because none of that is read
 * at render or validate time: it is 60-odd kilobytes of documentation, and a
 * package that ships zero runtime dependencies should not put it in the path of
 * a page that renders one card, nor in a server-side validation gate.
 *
 * Extend this, not `defaultContracts`, when generating a reference:
 * `renderComponentReference(extendContracts(defaultReferenceContracts, yours))`.
 */
export function referenceContracts(docs: ComponentContracts): ComponentContracts {
  // Derived facts first: their key order is the library's own declaration
  // order, which is the order compound parts are listed in. The curated notes
  // land last because they are the only hand-written layer.
  return extendContracts(extendContracts(docs, defaultContracts), COMPONENT_NOTES);
}

export const defaultReferenceContracts: ComponentContracts = referenceContracts(componentDocs);

export type ReferenceCategory = {
  /** Heading the section is emitted under. */
  name: string;
  /** One line of standing advice for everything in it. */
  blurb: string;
};

export type ReferenceRegions = {
  /** `### Category` headings, each with a Component / Parts / Props / Notes table. */
  components: string;
  /** Component → its `classNames` slot keys. */
  slots: string;
  /** Component → when its `children` function is called, and what is in scope. */
  functionChildren: string;
  /** Component → how its text children combine. */
  textChildren: string;
};

/**
 * The sections `@batthewz/response-ui-react-components` is documented under.
 *
 * Order is the reading order of the reference. A host documenting its own
 * components passes its own list; the built-in one is exported because the
 * common case is adding a section to these rather than replacing them.
 */
export const DEFAULT_CATEGORIES: readonly ReferenceCategory[] = [
  {
    name: "Layout",
    blurb: "Structure and spacing. The `r1`–`r6` scale is **inverted** — `r1` is the largest step.",
  },
  { name: "Typography", blurb: "Text and inline marks." },
  {
    name: "Action",
    blurb:
      'Buttons and triggers. `Button` defaults to `type: "button"` — a submit control must say so explicitly.',
  },
  { name: "Feedback", blurb: "Status, progress and loading." },
  { name: "Data", blurb: "Tables, metrics and lists driven by `data` + `$each`." },
  {
    name: "Form",
    blurb: "Bind every control with `$field`; declare the field in `spec.forms` first.",
  },
  {
    name: "Overlay",
    blurb: "Floating surfaces. Dialogs need a literal `id` so an action can target them.",
  },
  { name: "Navigation", blurb: "Disclosure, tabs, wayfinding and app chrome." },
  { name: "Media", blurb: "Images, rails and showcases." },
  {
    name: "Animation",
    blurb:
      "Presentational only. Pass `animate: false` when the content must be readable without a viewport observer.",
  },
];

/** A resolved type as a markdown table cell — a bare pipe would end it early. */
function tidyType(type: string): string {
  const clipped = type.length > 72 ? `${type.slice(0, 69)}…` : type;
  return clipped.replace(/\|/g, "\\|");
}

/** Required props first, then optional, then a count of what did not fit. */
function formatProps(props: readonly PropDoc[] | undefined, limit = 7): string {
  if (!props || props.length === 0) return "—";
  const required = props.filter((prop) => !prop.optional);
  const optional = props.filter((prop) => prop.optional);
  const shown = [...required, ...optional].slice(0, limit);
  const rendered = shown
    .map((prop) => `\`${prop.key}${prop.optional ? "?" : ""}\`: ${tidyType(prop.type)}`)
    .join(" · ");
  const hidden = props.length - shown.length;
  return hidden > 0 ? `${rendered} · +${hidden} more` : rendered;
}

const byName = (a: string, b: string) => a.localeCompare(b);

/**
 * `"Table"` → `["Body", "Row"]`, read off the addressable names themselves.
 *
 * Derived rather than declared, so registering `"Widget.Item"` is the whole act
 * of documenting it. Key order is kept: it is the order the component library
 * declares its parts in, which reads better than alphabetical.
 */
function partsOf(contracts: ComponentContracts, name: string): string[] {
  const prefix = `${name}.`;
  return Object.keys(contracts)
    .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes("."))
    .map((key) => key.slice(prefix.length));
}

function renderComponents(
  contracts: ComponentContracts,
  categories: readonly ReferenceCategory[],
): string {
  const known = new Set(categories.map((category) => category.name));
  const rows = new Map<string, { name: string; line: string }[]>();
  const unplaced = new Set<string>();

  for (const [name, contract] of Object.entries(contracts)) {
    // No category means "not documented" — a compound part, or a component the
    // curated notes deliberately leave out.
    if (contract.category === undefined) continue;
    if (!known.has(contract.category)) {
      unplaced.add(contract.category);
      continue;
    }
    const parts = partsOf(contracts, name);
    const cells = [
      `\`${name}\``,
      parts.length ? parts.map((part) => `\`.${part}\``).join(" ") : "—",
      formatProps(contract.props),
      contract.note ?? "",
    ];
    if (!rows.has(contract.category)) rows.set(contract.category, []);
    rows.get(contract.category)?.push({ name, line: `| ${cells.join(" | ")} |` });
  }

  // Bucketed under a heading that is never emitted, a component vanishes from
  // the reference while every check that compares a generation against itself
  // still agrees. `Action` was lost exactly this way, taking Button, IconButton
  // and CopyButton with it — so this throws rather than skipping.
  if (unplaced.size > 0) {
    throw new Error(
      `contracts categorise components as ${[...unplaced].sort(byName).join(", ")}, which the category list does not name — they would be silently omitted.`,
    );
  }

  // Reaching here with nothing to show means every contract lacked a category,
  // which is what `extendContracts(defaultContracts, yours)` produces — the core
  // contracts deliberately carry no category. Returning "" would be the silent
  // drop this function throws to prevent, one level up.
  if (rows.size === 0 && Object.keys(contracts).length > 0) {
    throw new Error(
      "no contract carries a category, so the component table would be empty — " +
        "generate a reference from `defaultReferenceContracts`, not `defaultContracts`.",
    );
  }

  const lines: string[] = [];
  for (const category of categories) {
    const table = rows.get(category.name);
    if (!table?.length) continue;
    lines.push(`### ${category.name}`, "", category.blurb, "");
    lines.push("| Component | Parts | Props | Notes |");
    lines.push("| --- | --- | --- | --- |");
    lines.push(...[...table].sort((a, b) => byName(a.name, b.name)).map((row) => row.line));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function renderTable(header: readonly string[], rows: readonly string[]): string {
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows,
  ].join("\n");
}

/** Every entry carrying `field`, in name order, as one markdown row each. */
function rowsFor(
  contracts: ComponentContracts,
  row: (name: string, contract: ComponentContracts[string]) => string | undefined,
): string[] {
  return Object.keys(contracts)
    .sort(byName)
    .map((name) => row(name, contracts[name]))
    .filter((line): line is string => line !== undefined);
}

/**
 * The generated regions of a ViewSpec reference, for whatever these contracts
 * describe.
 *
 * Throws when a contract claims a category the list does not name, because the
 * alternative is a component that is silently absent from the document a model
 * authors against.
 */
export function renderComponentReference(
  contracts: ComponentContracts,
  categories: readonly ReferenceCategory[] = DEFAULT_CATEGORIES,
): ReferenceRegions {
  return {
    components: renderComponents(contracts, categories),
    slots: renderTable(
      ["Component", "`classNames` keys"],
      rowsFor(contracts, (name, contract) =>
        contract.slots?.length
          ? `| \`${name}\` | ${contract.slots.map((key) => `\`${key}\``).join(" ")} |`
          : undefined,
      ),
    ),
    functionChildren: renderTable(
      ["Component", "Called", "In scope inside `children`"],
      rowsFor(contracts, (name, contract) =>
        contract.functionChildren
          ? `| \`${name}\` | ${contract.functionChildren.note} | ${contract.functionChildren.args
              .map((arg) => `\`${arg}\``)
              .join(" · ")} |`
          : undefined,
      ),
    ),
    textChildren: renderTable(
      ["Component", "`children` is"],
      rowsFor(contracts, (name, contract) =>
        contract.textChildren === undefined
          ? undefined
          : `| \`${name}\` | ${contract.textChildren} |`,
      ),
    ),
  };
}
