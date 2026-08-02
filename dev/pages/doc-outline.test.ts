import { describe, expect, it } from "vitest";

import readme from "../../README.md?raw";
import viewspec from "../../VIEWSPEC.md?raw";
import { outlineOf } from "./doc-outline";

/**
 * How many headings the split should find, decided a different way: whole fenced
 * regions are removed by one regex, then what is left is counted. Re-walking the
 * document line by line would restate `outlineOf`'s own algorithm, and a mirror
 * agrees with the bug as readily as with the behaviour.
 */
function headingCount(markdown: string): number {
  const withoutFences = markdown.replace(/^```[\s\S]*?^```/gm, "");
  return (withoutFences.match(/^## (?!#)/gm) ?? []).length;
}

describe("outlineOf", () => {
  it("puts everything above the first heading in the intro", () => {
    const { intro, sections } = outlineOf("# Title\n\nLede.\n\n## One\n\nBody.");

    expect(intro).toBe("# Title\n\nLede.");
    expect(sections).toHaveLength(1);
  });

  it("keeps the heading line inside the section it opens", () => {
    const { sections } = outlineOf("## One\n\nBody.\n\n## Two\n\nMore.");

    expect(sections.map((section) => section.body)).toEqual([
      "## One\n\nBody.",
      "## Two\n\nMore.",
    ]);
  });

  it("does not split on a heading inside a code fence", () => {
    const { sections } = outlineOf(
      "## Real\n\n```sh\n## not a heading\necho hi\n```\n\nAfter the fence.",
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].body).toContain("## not a heading");
    expect(sections[0].body).toContain("After the fence.");
  });

  it("does not let a tilde fence inside a backtick fence close it", () => {
    const { sections } = outlineOf("## Real\n\n````\n~~~\n## still code\n~~~\n````\n");

    expect(sections).toHaveLength(1);
    expect(sections[0].body).toContain("## still code");
  });

  it("ignores deeper headings", () => {
    const { sections } = outlineOf("## One\n\n### Nested\n\n#### Deeper");

    expect(sections).toHaveLength(1);
  });

  it("gives repeated titles distinct ids, so every anchor resolves", () => {
    const { sections } = outlineOf("## Theming\n\na\n\n## Theming\n\nb");

    expect(sections.map((section) => section.id)).toEqual(["theming", "theming-2"]);
  });

  it("slugs inline marks out of an id but leaves them in the title", () => {
    const { sections } = outlineOf("## The `$ref` node\n");

    expect(sections[0].id).toBe("the-ref-node");
    expect(sections[0].title).toBe("The `$ref` node");
  });

  it("builds a contents link that points at its own section", () => {
    const { sections } = outlineOf("## Data Bindings\n");

    expect(sections[0].link).toBe("- [Data Bindings](#data-bindings)\n");
  });
});

// The pages are built from these two files at import time, and VIEWSPEC.md is
// regenerated from the live library. A heading gained, lost or newly wrapped in
// a fence changes what the site renders without changing a line of dev/.
describe.each([
  ["README.md", readme],
  ["VIEWSPEC.md", viewspec],
])("%s", (_name, markdown) => {
  const { intro, sections } = outlineOf(markdown);

  it("finds every top-level heading and no others", () => {
    expect(sections).toHaveLength(headingCount(markdown));
  });

  it("opens every section on its own heading", () => {
    for (const section of sections) {
      expect(section.body.split("\n")[0]).toMatch(/^## (?!#)/);
    }
  });

  // The failure this guards is a split *inside* a fence: both halves keep an
  // unbalanced delimiter, and the reader gets the rest of the page as code.
  it("leaves every code fence closed inside the section that opened it", () => {
    for (const part of [intro, ...sections.map((section) => section.body)]) {
      const fences = (part.match(/^```/gm) ?? []).length;
      expect(fences % 2, `unbalanced fences in "${part.split("\n")[0]}"`).toBe(0);
    }
  });

  it("loses no content to the split", () => {
    const rejoined = [intro, ...sections.map((section) => section.body)].join("\n");
    expect(rejoined.replace(/\s+/g, " ").trim()).toBe(markdown.replace(/\s+/g, " ").trim());
  });

  it("gives every section a unique anchor", () => {
    const ids = sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
