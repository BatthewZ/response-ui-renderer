import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reading the theme contract out of the file that defines it.
 *
 * `themeOverrides` re-points design tokens, and which tokens are worth
 * re-pointing is `_theme-template.css` in `@batthewz/response-ui-css` — the file
 * a consumer copies to write a theme. The builder's theme panel offers exactly
 * that set, so it is read off that file rather than restated: a picker offering
 * a token the design system does not read would be a control that does nothing,
 * and a hand-kept list would become one the first time the contract moved.
 *
 * Read at build time, not at runtime, because `@batthewz/response-ui-css` is a
 * devDependency here and must stay one — the renderer's peers are React and the
 * component library, and a published module importing a CSS file out of a
 * package a consumer may not have installed would break the moment it shipped.
 *
 * A module of its own rather than part of the generator so that
 * `builder/theme-contract.test.ts` can re-derive with this same parser and fail
 * when the committed JSON falls behind the installed foundation. A parser only
 * the generator could reach would be checked by nothing but the generator.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const TEMPLATE_PATH = path.join(
  root,
  "node_modules/@batthewz/response-ui-css/src/_theme-template.css",
);

export const OUTPUT_PATH = path.join(root, "src/builder/theme-tokens.json");

export type ParsedThemeToken = {
  name: string;
  suggested: string;
  group: string;
  responsive: boolean;
  optional: boolean;
};

const DECLARATION = /(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g;

/** Opens a breakpoint block — the only thing that makes a token responsive. */
const WIDTH_MEDIA = /@media[^{]*\bwidth\b/;

/**
 * A comment that is a heading rather than an explanation.
 *
 * The template is prose as much as CSS, and its groupings — Brand, Surfaces,
 * Text, Status — are the ones a reader already has in front of them. A heading
 * is one line, names no token, and is not a sentence: the template's prose runs
 * to full stops and its headings do not. Getting this wrong costs a label, never
 * a token, because tokens are collected independently of it.
 */
const RULE = "[\\s\\u2500-\\u257f]";
const CLOSED_COMMENT = new RegExp(`^\\s*/\\*${RULE}*(.+?)${RULE}*\\*/\\s*$`);
const OPEN_COMMENT = new RegExp(`^\\s*/\\*${RULE}*(.+?)\\s*\\u2500{3,}\\s*$`);

function headingOf(line: string): string | null {
  // A section heading is either a comment of its own, or the first line of a
  // block comment with the template's horizontal rule drawn out beside it. Every
  // other line of a block comment is explanation, and there is a lot of it.
  const text = (CLOSED_COMMENT.exec(line) ?? OPEN_COMMENT.exec(line))?.[1].trim();
  if (text === undefined || text === "") return null;

  // What is left to reject is the template's prose, which announces itself: it
  // runs long, runs to sentences, starts mid-thought, and names files, selectors
  // and tokens. A heading does none of those.
  if (text.length > 70) return null;
  if (!/^[A-Z0-9]/.test(text)) return null;
  if (/--|[:/]|\.\s/.test(text)) return null;
  return text;
}

/**
 * Every token the template declares, with the group it sits under.
 *
 * `responsive` is read off the template's own shape rather than off the token's
 * name: the responsive tokens are the ones it declares twice, once per
 * breakpoint. That matters to whoever is editing one, because `themeOverrides`
 * is a flat inline style — an override of a token that bumps at 40rem applies at
 * both widths and flattens the bump, which the template says in as many words.
 */
export function parseThemeTemplate(source: string): ParsedThemeToken[] {
  const lines = source.split("\n");
  const found = new Map<string, ParsedThemeToken>();
  const atBreakpoint = new Set<string>();
  let group = "Theme";
  let inComment = false;
  // Depth rather than a flag: the breakpoint block wraps a selector block, so
  // one `}` closes the selector and not the media query.
  let mediaDepth = 0;
  let braceDepth = 0;

  for (const line of lines) {
    const heading = headingOf(line);
    if (heading !== null) {
      group = heading;
      continue;
    }

    // Tracked for every line, declaration or not. A line that both opens a
    // comment and declares a token — which is how each optional run starts —
    // would otherwise never open the block, and every token below it on the
    // continuation lines would be read as one the template declares for real.
    const startedInComment = inComment;
    const opens = line.lastIndexOf("/*");
    const closes = line.lastIndexOf("*/");
    if (opens > closes) inComment = true;
    else if (closes > opens) inComment = false;

    // Tracked before the declarations on this line are read, so a token
    // declared on the same line as the `@media` that opens its block still
    // counts as inside it.
    if (mediaDepth === 0 && WIDTH_MEDIA.test(line)) mediaDepth = braceDepth + 1;
    braceDepth += (line.match(/\{/g)?.length ?? 0) - (line.match(/\}/g)?.length ?? 0);
    if (mediaDepth > 0 && braceDepth < mediaDepth) mediaDepth = 0;

    // All of them: two declarations on one line is legal CSS, and an anchored
    // match reads the first and drops the second without saying so.
    DECLARATION.lastIndex = 0;
    for (const [, name, value] of line.matchAll(DECLARATION)) {
      if (mediaDepth > 0) atBreakpoint.add(name);
      if (found.has(name)) continue;
      found.set(name, {
        name,
        suggested: value.trim(),
        group,
        optional: startedInComment || /^\s*\/\*/.test(line),
        responsive: false,
      });
    }
  }

  // Declared inside a width breakpoint as well as outside one. Counting *any*
  // second declaration instead is a proxy that a dark-mode block or a duplicated
  // line would trip, and the panel would then tell someone a colour token bumps
  // at 40rem — which is not a thing it can do.
  return [...found.values()].map((token) => ({
    ...token,
    responsive: atBreakpoint.has(token.name),
  }));
}
