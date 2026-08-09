#!/usr/bin/env node
/**
 * Regenerates the component tables inside VIEWSPEC.md.
 *
 * The prose is hand-written; only the regions between the GENERATED markers are
 * produced here, from two sources that cannot drift:
 *
 *  1. the library's live barrel — the same import `defaultRegistry` derives from,
 *     so a component added upstream appears with no edit here;
 *  2. the library's shipped `dist/**\/*.d.ts` — the real prop types, rather than
 *     prose about them. (Its `docs/` would be nicer prose, but is not reliably
 *     in the published tarball; the declarations always are.)
 *
 * Only the category and the authoring note are curated, in
 * `src/registry/component-notes.ts`, and a test asserts every live component has
 * one — so a new component upstream forces a decision instead of vanishing.
 *
 * Usage: node scripts/gen-viewspec-doc.mjs [--check]
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { globSync } from "glob";
import * as ResponseUI from "@batthewz/response-ui-react-components";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const libRoot = path.join(root, "node_modules/@batthewz/response-ui-react-components");
const docPath = path.join(root, "VIEWSPEC.md");

const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");

const isComponentLike = (v) =>
  typeof v === "function" ||
  (typeof v === "object" && v !== null && "$$typeof" in v && (v.$$typeof === FORWARD_REF || v.$$typeof === MEMO));

const isExported = (name, value) => /^[A-Z]/.test(name) && isComponentLike(value);

/** Mirrors `createRegistryFromModule`, so the doc lists exactly what renders. */
function liveComponents() {
  const out = [];
  for (const [name, value] of Object.entries(ResponseUI)) {
    if (!isExported(name, value)) continue;
    const parts = Object.entries(value)
      .filter(([k, v]) => isExported(k, v))
      .map(([k]) => k);
    out.push({ name, parts });
  }
  out.push({ name: "Icon", parts: [] });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Props every component inherits from the DOM; noise in a terse reference.
 *
 * `classNames` is here for a different reason: 51 components take it, its type
 * is a union of every slot key, and inside a table cell that both truncates
 * mid-union and pushes the props a document actually needs into "+N more". The
 * keys are worth more in one table of their own — see the slots region.
 */
const PASSTHROUGH = new Set([
  "className",
  "classNames",
  "style",
  "ref",
  "key",
  "children",
  "asChild",
]);

const declarationFiles = globSync("dist/components/**/*.d.ts", { cwd: libRoot, absolute: true });
const declarationSource = new Map(declarationFiles.map((f) => [path.basename(f, ".d.ts"), readFileSync(f, "utf8")]));

/**
 * Every declared type name to the file that declares it.
 *
 * A component does not always sit in a file named after it — `AvatarGroup` and
 * the four `EmptyState*` parts are exported from a sibling's module — and
 * looking up by basename alone left every one of them with an empty Props
 * column in the reference. Built lazily so the parsing helpers below are
 * defined by the time it runs.
 */
let typeIndex = null;
function sourceDeclaring(typeName) {
  if (typeIndex === null) {
    typeIndex = new Map();
    for (const source of declarationSource.values()) {
      for (const declaration of declarationsIn(source)) {
        if (!typeIndex.has(declaration.name)) typeIndex.set(declaration.name, source);
      }
    }
  }
  return typeIndex.get(typeName) ?? null;
}

/** The declarations that define a component's props, wherever they live. */
function sourceFor(name) {
  return (
    declarationSource.get(name) ??
    sourceDeclaring(`${name}Props`) ??
    sourceDeclaring(`${name}RootProps`) ??
    ""
  );
}

/** Extracts the balanced `{ … }` that follows `index`. */
function balancedBlock(source, index) {
  const open = source.indexOf("{", index);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/**
 * `type Variant = "a" | "b";` → the right-hand side, so enums read literally.
 *
 * Falls back to a scan of every declaration file, because the shared scales
 * (`Gap`, `Size`) are imported from a sibling module rather than declared inline.
 */
function resolveAlias(source, name) {
  const pattern = new RegExp(`\\btype ${name}\\b[^=;{]*=\\s*([^;{]+);`);
  const local = pattern.exec(source);
  if (local) return local[1].trim();
  for (const other of declarationSource.values()) {
    const found = pattern.exec(other);
    if (found) return found[1].trim();
  }
  return name;
}

/** Collapsed and alias-resolved, but neither clipped nor escaped. */
function resolveType(source, raw) {
  let type = raw.replace(/\s+/g, " ").trim();
  if (/^[A-Z]\w*$/.test(type)) type = resolveAlias(source, type);
  return type.replace(/\s*\|\s*/g, "|");
}

/** A resolved type as a markdown table cell — a bare pipe would end it early. */
function tidyType(type) {
  const clipped = type.length > 72 ? `${type.slice(0, 69)}…` : type;
  return clipped.replace(/\|/g, "\\|");
}

/** The balanced body of the first `type`/`interface` in `typeNames` that exists. */
function declarationBody(source, typeNames) {
  for (const typeName of typeNames) {
    // Located by name alone: a generic default (`<T extends ElementType = "div">`)
    // puts an `=` before the assignment, so anchoring on `=` misses half of them.
    const declaration = new RegExp(`\\b(?:type|interface) ${typeName}\\b`).exec(source);
    if (!declaration) continue;
    const brace = source.indexOf("{", declaration.index);
    const semicolon = source.indexOf(";", declaration.index);
    if (brace === -1 || (semicolon !== -1 && semicolon < brace)) continue;
    const body = balancedBlock(source, declaration.index);
    if (body !== null) return body;
  }
  return null;
}

/** Every `key: type` declared directly in a block, ignoring nested shapes. */
function entriesOf(source, body) {
  const entries = [];
  let depth = 0;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    const entry = depth === 0 ? /^(\w+|"[^"]+"|\[[^\]]+\])(\??):\s*(.+?);?$/.exec(trimmed) : null;
    depth += (line.match(/[{(]/g) ?? []).length - (line.match(/[})]/g) ?? []).length;
    if (!entry) continue;
    entries.push({
      key: entry[1].replace(/"/g, ""),
      optional: entry[2] === "?",
      isFunction: /=>/.test(entry[3]),
      type: resolveType(source, entry[3]),
    });
  }
  return entries;
}

/** Props declared in a `…Props` object literal, minus DOM passthrough. */
function propsOf(source, typeNames) {
  const body = declarationBody(source, typeNames);
  if (body === null) return [];
  return entriesOf(source, body).filter(
    (entry) =>
      !PASSTHROUGH.has(entry.key) &&
      !entry.key.startsWith("aria-") &&
      !entry.key.startsWith("data-") &&
      // A required callback is host code, not something a document declares.
      !(entry.isFunction && !entry.optional),
  );
}

/** Every `type X = {…}` / `interface X {…}` in a file, with its balanced body. */
function declarationsIn(source) {
  const found = [];
  for (const match of source.matchAll(/\b(?:type|interface)\s+(\w+)\b/g)) {
    const brace = source.indexOf("{", match.index);
    const semicolon = source.indexOf(";", match.index);
    if (brace === -1 || (semicolon !== -1 && semicolon < brace)) continue;
    const body = balancedBlock(source, match.index);
    if (body !== null) found.push({ name: match[1], body });
  }
  return found;
}

/**
 * `classNames?: SlotClassNames<"a" | "b">` → the keys.
 *
 * An alias is resolved at either position: the union may be one
 * (`SlotClassNames<Keys>`), and so may the whole type — `Markdown` declares
 * `classNames?: Slots`, and matching only the first spelling dropped its eleven
 * keys from the reference with a `--check` that still passed, because the
 * generator dropped them on both sides.
 */
function slotKeysIn(source, body) {
  const declared = /classNames\?:\s*([\w<>"|\s]+?);/.exec(body);
  if (!declared) return null;
  const type = /^[A-Z]\w*$/.test(declared[1].trim())
    ? resolveAlias(source, declared[1].trim())
    : declared[1];
  const match = /SlotClassNames<\s*([^>]+?)\s*>/.exec(type);
  if (!match) return null;
  const inner = match[1].includes('"') ? match[1] : resolveAlias(source, match[1]);
  const keys = [...inner.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return keys.length > 0 ? keys : null;
}

/** A union of nothing but string literals — the only kind a document can get wrong. */
function literalUnion(type) {
  if (!/^"[^"]*"(\|"[^"]*")*$/.test(type)) return null;
  return type.split("|").map((member) => member.slice(1, -1));
}

/**
 * The props-type name each addressable component declares its props under.
 *
 * `Root` → `RootProps` / `RootRootProps`, `Root.Part` → `RootPartProps` or the
 * unprefixed `PartProps` — `AppShell.SidebarLink` uses the latter. Only the
 * component's own declaration file is searched, so the short form cannot pick up
 * a same-named type belonging to something else. The convention is the
 * library's own and already load-bearing here, so a miss is reported rather than
 * skipped: see `describeInternals`.
 */
const propsTypeForms = (base) => [`${base}Props`, `${base}RootProps`, `${base}OwnProps`];

function propsTypeNames(name, parts) {
  return [
    [name, propsTypeForms(name)],
    ...parts.map((part) => [
      `${name}.${part}`,
      [...propsTypeForms(`${name}${part}`), `${part}Props`],
    ]),
  ];
}

/**
 * Slot keys and enumerated prop values, per addressable component.
 *
 * Both are derived from the shipped declarations, and both exist because a
 * document is JSON: nothing checks a slot key or a union member at author time,
 * so the reference has to carry them and the validator has to know them.
 *
 * A `classNames` this cannot attribute to a component throws rather than being
 * dropped. A silently skipped one is a whole component's override surface
 * missing from the reference, with a `--check` that still passes because the
 * generator dropped it on both sides.
 */
function describeInternals(components, notAddressable) {
  const slots = [];
  const enums = {};

  // Every props type any addressable component claims. A file holds more than
  // one component's props — `Avatar.d.ts` also declares `AvatarGroupProps` — so
  // "unplaced" means claimed by nobody, not merely claimed by someone else.
  const claimed = new Set(
    components.flatMap(({ name, parts }) => propsTypeNames(name, parts).flatMap(([, names]) => names)),
  );

  for (const { name, parts } of components) {
    // Slot keys and value sets for something a document cannot address at all
    // are advice about a component it must not reach for.
    if (Object.hasOwn(notAddressable, name)) continue;
    const source = sourceFor(name);
    if (!source) continue;

    const labelOf = new Map();
    for (const [label, typeNames] of propsTypeNames(name, parts)) {
      for (const typeName of typeNames) labelOf.set(typeName, label);
    }

    const unplaced = [];
    for (const declaration of declarationsIn(source)) {
      const label = labelOf.get(declaration.name);
      const keys = slotKeysIn(source, declaration.body);
      if (keys && label === undefined) {
        if (!claimed.has(declaration.name)) unplaced.push(declaration.name);
        continue;
      }
      if (label === undefined || Object.hasOwn(notAddressable, label)) continue;
      if (keys) slots.push({ name: label, keys });
      for (const entry of entriesOf(source, declaration.body)) {
        const members = literalUnion(entry.type);
        if (members) enums[`${label}.${entry.key}`] = members;
      }
    }

    if (unplaced.length > 0) {
      throw new Error(
        `${name}: classNames declared on ${unplaced.join(", ")}, which names no addressable component — ` +
          "the slot keys would vanish from the reference. Fix the mapping in propsTypeNames().",
      );
    }
  }

  return { slots: slots.sort((a, b) => a.name.localeCompare(b.name)), enums };
}

function renderSlots(slots) {
  const lines = ["| Component | `classNames` keys |", "| --- | --- |"];
  for (const { name, keys } of slots) {
    lines.push(`| \`${name}\` | ${keys.map((key) => `\`${key}\``).join(" ")} |`);
  }
  return lines.join("\n");
}

function renderFunctionChildren(functionChildren) {
  const lines = ["| Component | Called | In scope inside `children` |", "| --- | --- | --- |"];
  for (const [name, { note, args }] of Object.entries(functionChildren)) {
    lines.push(`| \`${name}\` | ${note} | ${args.map((a) => `\`${a}\``).join(" · ")} |`);
  }
  return lines.join("\n");
}

function renderTextChildren(textChildren) {
  const lines = ["| Component | `children` is |", "| --- | --- |"];
  for (const [name, note] of Object.entries(textChildren)) {
    lines.push(`| \`${name}\` | ${note} |`);
  }
  return lines.join("\n");
}

function formatProps(props, limit = 7) {
  if (props.length === 0) return "—";
  const required = props.filter((p) => !p.optional);
  const optional = props.filter((p) => p.optional);
  const shown = [...required, ...optional].slice(0, limit);
  const rendered = shown
    .map((p) => `\`${p.key}${p.optional ? "?" : ""}\`: ${tidyType(p.type)}`)
    .join(" · ");
  const hidden = props.length - shown.length;
  return hidden > 0 ? `${rendered} · +${hidden} more` : rendered;
}

function render(components, notes, notAddressable) {
  const byCategory = new Map();
  for (const component of components) {
    if (Object.hasOwn(notAddressable, component.name)) continue;
    const meta = notes[component.name];
    if (!meta) continue;
    if (!byCategory.has(meta.category)) byCategory.set(meta.category, []);
    byCategory.get(meta.category).push({ ...component, ...meta });
  }

  // A category with no entry here is bucketed and then never emitted, so its
  // components vanish from the doc while `--check` still passes — it compares a
  // generation against itself. `Action` was dropped this way, taking Button,
  // IconButton and CopyButton with it.
  const unordered = [...byCategory.keys()].filter((name) => !Object.hasOwn(CATEGORY_ORDER, name));
  if (unordered.length > 0) {
    throw new Error(
      `component-notes.json categorises components as ${unordered.join(", ")}, which CATEGORY_ORDER does not list — they would be silently omitted.`,
    );
  }

  const lines = [];
  for (const category of Object.keys(CATEGORY_ORDER)) {
    const rows = byCategory.get(category);
    if (!rows?.length) continue;
    lines.push(`### ${category}`, "", CATEGORY_ORDER[category], "");
    lines.push("| Component | Parts | Props | Notes |");
    lines.push("| --- | --- | --- | --- |");
    for (const row of rows.sort((a, b) => a.name.localeCompare(b.name))) {
      const source = sourceFor(row.name);
      // The same forms the slot and enum passes accept. Spelling a subset here
      // left `ProgressBar` — whose props are declared as `ProgressBarOwnProps`,
      // the root type being inlined into its `forwardRef` union — with an empty
      // Props column, while its enums came through the other path regardless.
      const props = formatProps(propsOf(source, propsTypeForms(row.name)));
      const parts = row.parts.length ? row.parts.map((p) => `\`.${p}\``).join(" ") : "—";
      lines.push(`| \`${row.name}\` | ${parts} | ${props} | ${row.note ?? ""} |`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

const CATEGORY_ORDER = {
  Layout: "Structure and spacing. The `r1`–`r6` scale is **inverted** — `r1` is the largest step.",
  Typography: "Text and inline marks.",
  Action: 'Buttons and triggers. `Button` defaults to `type: "button"` — a submit control must say so explicitly.',
  Feedback: "Status, progress and loading.",
  Data: "Tables, metrics and lists driven by `data` + `$each`.",
  Form: "Bind every control with `$field`; declare the field in `spec.forms` first.",
  Overlay: "Floating surfaces. Dialogs need a literal `id` so an action can target them.",
  Navigation: "Disclosure, tabs, wayfinding and app chrome.",
  Media: "Images, rails and showcases.",
  Animation: "Presentational only. Pass `animate: false` when the content must be readable without a viewport observer.",
};

function renderNotAddressable(notAddressable) {
  const lines = ["| Component | Why not, and what to do instead |", "| --- | --- |"];
  for (const [name, reason] of Object.entries(notAddressable).sort()) {
    lines.push(`| \`${name}\` | ${reason} |`);
  }
  return lines.join("\n");
}

/** Replaces a `<!-- GENERATED:x -->…<!-- /GENERATED:x -->` region in place. */
function replaceRegion(doc, id, body) {
  const pattern = new RegExp(`(<!-- GENERATED:${id} -->)[\\s\\S]*?(<!-- /GENERATED:${id} -->)`);
  if (!pattern.test(doc)) throw new Error(`VIEWSPEC.md has no GENERATED:${id} region`);
  return doc.replace(pattern, `$1\n${body}\n$2`);
}

function main() {
  // The same JSON the runtime modules import, so the doc and the parity gate can
  // never disagree about which components are excused or how they are grouped.
  const notes = JSON.parse(readFileSync(path.join(root, "src/registry/component-notes.json"), "utf8"));
  const notAddressable = JSON.parse(
    readFileSync(path.join(root, "src/examples/not-addressable.json"), "utf8"),
  );
  const functionChildren = JSON.parse(
    readFileSync(path.join(root, "src/registry/function-children.json"), "utf8"),
  );
  const textChildren = JSON.parse(
    readFileSync(path.join(root, "src/registry/text-children.json"), "utf8"),
  );

  const components = liveComponents();
  const { slots, enums } = describeInternals(components, notAddressable);

  const original = readFileSync(docPath, "utf8");
  let doc = replaceRegion(original, "components", render(components, notes, notAddressable));
  doc = replaceRegion(doc, "slots", renderSlots(slots));
  doc = replaceRegion(doc, "function-children", renderFunctionChildren(functionChildren));
  doc = replaceRegion(doc, "text-children", renderTextChildren(textChildren));
  doc = replaceRegion(doc, "not-addressable", renderNotAddressable(notAddressable));

  // Read by the validator at runtime, so a document can be told that a value is
  // outside a union before it renders into nothing. Generated rather than
  // hand-kept for the same reason the doc is.
  const enumsPath = path.join(root, "src/spec/prop-enums.json");
  const enumsBody = `${JSON.stringify(enums, null, 2)}\n`;
  const enumsOriginal = readFileSync(enumsPath, "utf8");

  if (process.argv.includes("--check")) {
    const stale = [
      doc === original ? null : "VIEWSPEC.md",
      enumsBody === enumsOriginal ? null : "src/spec/prop-enums.json",
    ].filter(Boolean);
    if (stale.length > 0) {
      console.error(`${stale.join(" and ")} stale — run \`bun run docs:viewspec\`.`);
      process.exit(1);
    }
    console.log("VIEWSPEC.md is up to date.");
    return;
  }

  writeFileSync(docPath, doc);
  writeFileSync(enumsPath, enumsBody);
  console.log(
    `VIEWSPEC.md regenerated (${components.length} components, ${slots.length} with slots, ` +
      `${Object.keys(enums).length} enumerated props).`,
  );
}

main();
