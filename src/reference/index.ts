import viewSpecDocument from "../../VIEWSPEC.md?raw";
import componentDocs from "../registry/component-docs.json";
import { COMPONENT_NOTES } from "../registry/component-notes";
import { defaultContracts } from "../registry/default-contracts";
import {
  closestName,
  type ComponentContracts,
  extendContracts,
  type PropDoc,
} from "../spec/contracts";
import { replaceGeneratedRegion } from "./regions";

export { type ComponentContracts, extendContracts };

/**
 * Reference generation.
 *
 * `VIEWSPEC.md` is produced by calling `renderViewSpecReference` — the
 * generator's job is to *derive* the facts from the library's shipped
 * declarations, not to format them. So a host documenting its own components
 * gets the identical tables from the identical code, rather than a second
 * renderer that drifts. There is nothing here a built-in component gets and a
 * registered one does not.
 *
 * **Prose is never generated.** `renderReferenceRegions` returns the table
 * regions and nothing else; `renderViewSpecReference` *carries* this package's
 * own hand-written words around them, unfiltered. A host documenting its own
 * registry writes its own.
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
 * `renderReferenceRegions(extendContracts(defaultReferenceContracts, yours))`.
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
function formatProps(props: readonly PropDoc[] | undefined, limit: number | false): string {
  if (!props || props.length === 0) return "—";
  const required = props.filter((prop) => !prop.optional);
  const optional = props.filter((prop) => prop.optional);
  const ordered = [...required, ...optional];
  const shown = limit === false ? ordered : ordered.slice(0, limit);
  const rendered = shown
    .map((prop) => `\`${prop.key}${prop.optional ? "?" : ""}\`: ${tidyType(prop.type)}`)
    .join(" · ");
  const hidden = props.length - shown.length;
  return hidden > 0 ? `${rendered} · +${hidden} more` : rendered;
}

const byName = (a: string, b: string) => a.localeCompare(b);

/** Every addressable name under `name` — `"Table"` → `["Table.Body", …]`. */
function partKeys(contracts: ComponentContracts, name: string): string[] {
  const prefix = `${name}.`;
  return Object.keys(contracts).filter((key) => key.startsWith(prefix));
}

/**
 * `"Table"` → `["Body", "Row"]`, read off the addressable names themselves.
 *
 * Derived rather than declared, so registering `"Widget.Item"` is the whole act
 * of documenting it. Key order is kept: it is the order the component library
 * declares its parts in, which reads better than alphabetical.
 */
function partsOf(contracts: ComponentContracts, name: string): string[] {
  return partKeys(contracts, name)
    .map((key) => key.slice(name.length + 1))
    .filter((part) => !part.includes("."));
}

function renderComponents(
  contracts: ComponentContracts,
  categories: readonly ReferenceCategory[],
  propLimit: number | false,
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
      formatProps(contract.props, propLimit),
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

  // Reaching here with nothing to show has two causes and they need different
  // advice. Returning "" would be the silent drop this function throws to
  // prevent, one level up.
  if (rows.size === 0 && Object.keys(contracts).length > 0) {
    const named = Object.keys(contracts);
    throw new Error(
      named.length <= 8
        ? `no contract carries a category, so the component table would be empty — ${named
            .map((name) => `\`${name}\``)
            .join(", ")} ${
            named.length === 1 ? "is not a documented component" : "are not documented components"
          }. A component the reference deliberately leaves out (see the not-addressable table) ` +
          "cannot be scoped to."
        : "no contract carries a category, so the component table would be empty — " +
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

/**
 * A markdown table, or a sentence saying there is nothing in it.
 *
 * The empty case only arises under a scope, and it is not cosmetic. Each of
 * these tables sits under hand-written prose that describes its contents —
 * "These two **call** theirs", and the names below are in scope — and a header
 * row with no body leaves that prose asserting rows a reader cannot see. The
 * prose is not filtered, so the correction has to come from the generated side.
 */
function renderTable(
  header: readonly string[],
  rows: readonly string[],
  empty: string,
): string {
  if (rows.length === 0) return `_${empty}_`;
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

export type ReferenceOptions = {
  /** Sections, in reading order. Defaults to `DEFAULT_CATEGORIES`. */
  categories?: readonly ReferenceCategory[];

  /**
   * Props listed per row before the rest become `+N more`; `false` for all of
   * them. Defaults to 7.
   *
   * The cap is a concession to breadth, not a judgement about which props
   * matter: 175 components have to fit one readable file, so the widest rows
   * lose their tail. A **scoped** reference has no such problem, and the props
   * it hides are the ones an author then invents — which nothing catches,
   * because value checking cannot fire on a prop name that was never declared.
   * Narrow the contracts and pass `false`.
   */
  propLimit?: number | false;
};

/**
 * The generated regions of a ViewSpec reference, for whatever these contracts
 * describe.
 *
 * Throws when a contract claims a category the list does not name, because the
 * alternative is a component that is silently absent from the document a model
 * authors against.
 */
export function renderReferenceRegions(
  contracts: ComponentContracts,
  { categories = DEFAULT_CATEGORIES, propLimit = 7 }: ReferenceOptions = {},
): ReferenceRegions {
  if (propLimit !== false && (!Number.isInteger(propLimit) || propLimit < 1)) {
    // `0`, `-1` and `NaN` all reach `slice` and produce a props cell that names
    // no props behind a dangling `· +N more`; a negative one silently drops the
    // last prop of every row, which is the omission this option exists to end.
    throw new Error(
      `renderReferenceRegions: propLimit must be a positive integer or false, not ${String(propLimit)}.`,
    );
  }
  return {
    components: renderComponents(contracts, categories, propLimit),
    slots: renderTable(
      ["Component", "`classNames` keys"],
      rowsFor(contracts, (name, contract) =>
        contract.slots?.length
          ? `| \`${name}\` | ${contract.slots.map((key) => `\`${key}\``).join(" ")} |`
          : undefined,
      ),
      "No component in this reference takes `classNames`.",
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
      "No component in this reference calls its `children` — place them as usual. " +
        "The prose and example in this section describe components this reference does not cover; " +
        "do not author a component that has no row in the tables above.",
    ),
    textChildren: renderTable(
      ["Component", "`children` is"],
      rowsFor(contracts, (name, contract) =>
        contract.textChildren === undefined
          ? undefined
          : `| \`${name}\` | ${contract.textChildren} |`,
      ),
      "No component in this reference parses its `children` as text.",
    ),
  };
}

/**
 * Component names, as a list or a set.
 *
 * Deliberately not `Iterable<string>`: a bare `string` satisfies that, so
 * `include: "Card"` would typecheck and then scope to the letters C, a, r, d.
 */
export type ComponentNames = readonly string[] | ReadonlySet<string>;

/** Pass exactly one. Two lists would have to agree, and could not be made to. */
export type ContractScope =
  | { readonly include: ComponentNames; readonly exclude?: undefined }
  | { readonly exclude: ComponentNames; readonly include?: undefined };

/**
 * A name the caller believes is documented and is not.
 *
 * Reported rather than skipped: the whole point of a scoped reference is that
 * it re-derives from the installed version, so a name that has been renamed
 * upstream must surface on upgrade. On the `include` side, skipping produces a
 * reference missing a component the author is about to use. On the `exclude`
 * side the cost is quieter and still real — an exclusion that has stopped
 * matching silently re-admits a component the caller deliberately removed — so
 * both paths report rather than shrug.
 */
function refuseUnknown(contracts: ComponentContracts, names: readonly string[]): void {
  const unknown = names.filter((name) => !Object.hasOwn(contracts, name));
  if (unknown.length === 0) return;
  const known = Object.keys(contracts);
  const detail = unknown.map((name) => {
    const nearest = closestName(name, known);
    return nearest === undefined ? `"${name}"` : `"${name}" (did you mean "${nearest}"?)`;
  });
  throw new Error(`scopeContracts: no contract for ${detail.join(", ")}.`);
}

/**
 * The contracts for a named set of components, and nothing else.
 *
 * The reference documents every addressable name because it cannot know which
 * ones a given producer uses. A producer *does* know: an application that only
 * ever authors a dozen component names is paying to describe the rest on every
 * request. Narrow the contracts and the tables narrow with them — categories
 * left with no rows drop out, and `renderViewSpecReference` returns the same
 * document minus what nobody addresses.
 *
 * Scoped rather than hand-copied so it cannot drift: a subset kept downstream
 * is a second source of truth for prop names, and a wrong prop name is exactly
 * what the reference exists to prevent. This is derived from whatever version
 * is installed, so it cannot describe a different one.
 *
 * A **compound part travels with its root, in both directions** — a part cannot
 * render outside its parent, and a root whose parts were filtered away would
 * advertise an empty Parts column while the parts stayed renderable. Naming
 * `"Tabs.Panel"` therefore includes `Tabs` *and its other parts*: pulling in the
 * root without them is the same lie in a smaller font. Excluding a root excludes
 * its parts; excluding a part leaves the root, because dropping one part says
 * nothing about the rest.
 */
export function scopeContracts(
  contracts: ComponentContracts,
  scope: ContractScope,
): ComponentContracts {
  const including = scope.include !== undefined;
  if (including === (scope.exclude !== undefined)) {
    throw new Error("scopeContracts: pass exactly one of `include` or `exclude`.");
  }

  const named = [...(scope.include ?? scope.exclude ?? [])];
  if (named.length === 0) {
    throw new Error(
      `scopeContracts: \`${including ? "include" : "exclude"}\` is empty. ` +
        "An empty include documents nothing and an empty exclude documents everything; " +
        "neither is a scope, and both are likelier to be a list that failed to build.",
    );
  }
  refuseUnknown(contracts, named);

  const listed = new Set<string>();
  const take = (name: string) => {
    listed.add(name);
    for (const part of partKeys(contracts, name)) listed.add(part);
  };
  for (const name of named) {
    take(name);
    // Only when including: a part names its root as a dependency — and the root
    // brings the siblings, or its Parts column would advertise one of eight.
    const dot = including ? name.lastIndexOf(".") : -1;
    if (dot !== -1) take(name.slice(0, dot));
  }

  const next: Record<string, ComponentContracts[string]> = Object.create(null) as Record<
    string,
    ComponentContracts[string]
  >;
  // Key order is the library's own declaration order, which decides the order
  // compound parts are listed in. Filtering must not reorder it.
  for (const [name, contract] of Object.entries(contracts)) {
    if (listed.has(name) === including) next[name] = contract;
  }

  if (Object.keys(next).length === 0) {
    throw new Error(
      "scopeContracts: the scope keeps no components, so there is nothing to document.",
    );
  }
  return next;
}


export type ViewSpecReferenceOptions = ReferenceOptions &
  (ContractScope | { readonly include?: undefined; readonly exclude?: undefined }) & {
    /**
     * Defaults to `defaultReferenceContracts`. Supply
     * `extendContracts(defaultReferenceContracts, yours)` to have components you
     * registered documented alongside the library's — extending, not replacing,
     * because the prose this carries describes the library.
     */
    readonly contracts?: ComponentContracts;
  };

/**
 * `VIEWSPEC.md` — the whole reference, as a string.
 *
 * **This document's prose is about `@batthewz/response-ui-react-components`.**
 * It is the reference this package ships, re-rendered from the contracts it is
 * handed, so `contracts` is for *adding* your components to it. A host
 * documenting a registry of its own instead wants `renderReferenceRegions`
 * and its own words around it.
 *
 * With no options it reproduces the committed file byte for byte. Given a scope
 * it returns the same document describing only those components — the form a
 * producer with a fixed component vocabulary should put in front of a model:
 *
 * ```ts
 * renderViewSpecReference({ include: NAMES_MY_APP_AUTHORS, propLimit: false });
 * ```
 *
 * What a scope deliberately does **not** reach, because the failure of getting
 * it wrong is worse than the bytes:
 *
 * - **Hand-written words are carried, not filtered** — the prose between the
 *   regions, a surviving component's curated note, and the worked examples.
 *   Some of those examples author components a narrow scope drops, so a scoped
 *   document can *demonstrate* a name its own tables do not document. Tagging
 *   advice by component set would silently delete it whenever a tag was wrong,
 *   which is the worse failure; instead, a generated table left empty by a scope
 *   says so in place of showing a bare header.
 * - **The not-addressable table travels with the prose**, so it is neither
 *   re-rendered here nor scoped. It is advice about the *absence* of a
 *   component, and absence is exactly what a scope produces: filtering it would
 *   delete the sentence that stops an author reaching for `FileUpload` in the
 *   one document where nothing else mentions it. Its three siblings are
 *   re-rendered because contracts change them; this one no input can change,
 *   and a splice that can only ever write back what is already there is not a
 *   check on anything — the generator owns it, against `not-addressable.json`.
 *
 * The tables describe the peer library **as of this package's release**, not as
 * of the copy resolved in your `node_modules`: they are derived at build time
 * from the declarations, so a peer within the same `^` range that has since
 * added a prop will not show it. Regenerating cannot drift past this package;
 * it can lag its peer.
 */
/** The document with its generated regions cut out — the hand-written half. */
const viewSpecProse = viewSpecDocument.replace(
  /<!-- GENERATED:[\s\S]*?<!-- \/GENERATED:[a-z-]+ -->/g,
  "",
);

/**
 * Components the prose *authors* that these contracts do not document.
 *
 * A scope narrows the tables and leaves the worked examples alone, so a profile
 * can show a component being used and then not describe it — and the component
 * still renders, because the registry is not scoped. The author gets no error,
 * only a missing prop table, and invents props against it: the exact failure a
 * reference exists to prevent, reintroduced by making the reference smaller.
 *
 * Scoped prose was the alternative and is worse — a mis-tagged block deletes
 * advice silently. So the gap is stated instead of closed.
 *
 * Deliberately narrow: `"component": "X"` in an example, which is a name shown
 * being authored, and not every name prose happens to mention in backticks.
 * Rule 9 naming `Timeline` is a remark; a copy-me JSON block is an instruction.
 */
function undocumentedInProse(contracts: ComponentContracts): string[] {
  const authored = [...viewSpecProse.matchAll(/"component":\s*"([\w.]+)"/g)].map((m) => m[1]);
  return [...new Set(authored)].filter((name) => !Object.hasOwn(contracts, name));
}

export function renderViewSpecReference(options: ViewSpecReferenceOptions = {}): string {
  const { contracts = defaultReferenceContracts, include, exclude, ...rest } = options;
  const scoped =
    include === undefined && exclude === undefined
      ? contracts
      : scopeContracts(contracts, (include === undefined ? { exclude } : { include }));

  const regions = renderReferenceRegions(scoped, rest);

  // Prepended to the components region rather than written into the prose: it
  // is generated, so it round-trips through the markers, and it is empty for an
  // unscoped document, which is what keeps that case byte-identical to the
  // committed file. `renderReferenceRegions` does not do this — the claim is
  // about *this* document's examples, not about anyone's contracts.
  const undocumented = undocumentedInProse(scoped);
  const components =
    undocumented.length === 0
      ? regions.components
      : // No "above"/"below": the worked examples sit on both sides of this
        // region, and two earlier drafts of this sentence named the wrong one.
        `⚠️ **This reference is scoped**, and its worked examples were written against the ` +
        `whole library. ${undocumented.map((name) => `\`${name}\``).join(", ")} ` +
        `${undocumented.length === 1 ? "appears" : "appear"} in an example and ` +
        `${undocumented.length === 1 ? "is" : "are"} **not documented here** — authoring ` +
        `one renders it, with no prop list to author it against. Use only components with a row below.\n\n` +
        regions.components;

  let doc = replaceGeneratedRegion(viewSpecDocument, "components", components);
  doc = replaceGeneratedRegion(doc, "slots", regions.slots);
  doc = replaceGeneratedRegion(doc, "function-children", regions.functionChildren);
  return replaceGeneratedRegion(doc, "text-children", regions.textChildren);
}
