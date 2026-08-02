/**
 * Splits a markdown file into the shape a document can loop over.
 *
 * `Markdown` renders no heading ids, so a link to `#adapters` has nothing to
 * land on. Sectioning is the way out that does not need the component to grow
 * an API: the host hands over one body per heading, the document wraps each in
 * a `Stack as="section"` carrying the id, and the anchor resolves against the
 * element the document made rather than one the parser would have had to.
 *
 * The split is fence-aware. A `## ` inside a code block is sample text — in
 * VIEWSPEC.md the fenced `jsonc` and shell blocks are full of `#` — and cutting
 * there would open a section mid-fence, leaving both halves with an unbalanced
 * delimiter and the rest of the page rendered as code.
 */

export type DocSection = {
  id: string;
  title: string;
  /** The heading line and everything under it, ready to parse. */
  body: string;
  /**
   * The section's own line of the contents list, as markdown.
   *
   * Host data rather than document logic, because the format has no string
   * concatenation: `$each` binds a node per row, and a row can only contribute
   * text it already holds.
   */
  link: string;
};

export type DocOutline = {
  /** Everything above the first `##` — the title and its lede. */
  intro: string;
  sections: DocSection[];
};

const FENCE = /^ {0,3}(```|~~~)/;
const SECTION_HEADING = /^## (?!#)(.*)$/;

/**
 * A heading's text as a URL fragment: inline marks dropped, everything that is
 * not a word character folded to a single dash.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function outlineOf(markdown: string): DocOutline {
  const lines = markdown.split("\n");
  const intro: string[] = [];
  const sections: DocSection[] = [];
  const taken = new Set<string>();
  let current: { title: string; lines: string[] } | undefined;
  let fence: string | undefined;

  for (const line of lines) {
    const opener = FENCE.exec(line);
    if (opener) {
      // Only a delimiter of the same kind closes a fence, so a `~~~` inside a
      // ``` block is content and must not end it.
      if (fence === undefined) fence = opener[1];
      else if (line.trimStart().startsWith(fence)) fence = undefined;
    }

    const heading = fence === undefined ? SECTION_HEADING.exec(line) : null;
    if (heading) {
      if (current) sections.push(toSection(current, taken));
      current = { title: heading[1].trim(), lines: [line] };
      continue;
    }

    (current ? current.lines : intro).push(line);
  }

  if (current) sections.push(toSection(current, taken));

  return { intro: intro.join("\n").trim(), sections };
}

function toSection(
  raw: { title: string; lines: string[] },
  taken: Set<string>,
): DocSection {
  const base = slugify(raw.title) || "section";
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  taken.add(id);

  return {
    id,
    title: raw.title,
    body: raw.lines.join("\n").trim(),
    link: `- [${raw.title}](#${id})\n`,
  };
}
