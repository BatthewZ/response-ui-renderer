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

/** Props every component inherits from the DOM; noise in a terse reference. */
const PASSTHROUGH = new Set(["className", "style", "ref", "key", "children", "asChild"]);

const declarationFiles = globSync("dist/components/**/*.d.ts", { cwd: libRoot, absolute: true });
const declarationSource = new Map(declarationFiles.map((f) => [path.basename(f, ".d.ts"), readFileSync(f, "utf8")]));

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

function tidyType(source, raw) {
  let type = raw.replace(/\s+/g, " ").trim();
  if (/^[A-Z]\w*$/.test(type)) type = resolveAlias(source, type);
  type = type.replace(/\s*\|\s*/g, "|");
  if (type.length > 72) type = `${type.slice(0, 69)}…`;
  // A bare pipe would end the markdown table cell mid-union.
  return type.replace(/\|/g, "\\|");
}

/** Props declared in a `…Props` object literal, minus DOM passthrough. */
function propsOf(source, typeNames) {
  for (const typeName of typeNames) {
    // Located by name alone: a generic default (`<T extends ElementType = "div">`)
    // puts an `=` before the assignment, so anchoring on `=` misses half of them.
    const declaration = new RegExp(`\\btype ${typeName}\\b`).exec(source);
    if (!declaration) continue;
    const brace = source.indexOf("{", declaration.index);
    const semicolon = source.indexOf(";", declaration.index);
    if (brace === -1 || (semicolon !== -1 && semicolon < brace)) continue;
    const body = balancedBlock(source, declaration.index);
    if (body === null) continue;

    const props = [];
    let depth = 0;
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      const entry = depth === 0 ? /^(\w+|"[^"]+"|\[[^\]]+\])(\??):\s*(.+?);?$/.exec(trimmed) : null;
      depth += (line.match(/[{(]/g) ?? []).length - (line.match(/[})]/g) ?? []).length;
      if (!entry) continue;
      const key = entry[1].replace(/"/g, "");
      if (PASSTHROUGH.has(key) || key.startsWith("aria-") || key.startsWith("data-")) continue;
      if (/=>/.test(entry[3]) && entry[2] === "") continue;
      props.push({ key, optional: entry[2] === "?", type: tidyType(source, entry[3]) });
    }
    if (props.length > 0) return props;
  }
  return [];
}

function formatProps(props, limit = 7) {
  if (props.length === 0) return "—";
  const required = props.filter((p) => !p.optional);
  const optional = props.filter((p) => p.optional);
  const shown = [...required, ...optional].slice(0, limit);
  const rendered = shown.map((p) => `\`${p.key}${p.optional ? "?" : ""}\`: ${p.type}`).join(" · ");
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
      const source = declarationSource.get(row.name) ?? "";
      const props = formatProps(propsOf(source, [`${row.name}Props`, `${row.name}RootProps`]));
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

  const components = liveComponents();
  const original = readFileSync(docPath, "utf8");
  let doc = replaceRegion(original, "components", render(components, notes, notAddressable));
  doc = replaceRegion(doc, "not-addressable", renderNotAddressable(notAddressable));

  if (process.argv.includes("--check")) {
    if (doc !== original) {
      console.error("VIEWSPEC.md is stale — run `bun run docs:viewspec`.");
      process.exit(1);
    }
    console.log("VIEWSPEC.md is up to date.");
    return;
  }

  writeFileSync(docPath, doc);
  console.log(`VIEWSPEC.md regenerated (${components.length} components).`);
}

main();
