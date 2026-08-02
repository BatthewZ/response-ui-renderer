import readme from "../../README.md?raw";
import type { ViewSpec } from "../../src/spec";
import viewspec from "../../VIEWSPEC.md?raw";
import { type DocPageId, pageHref } from "../site";
import { outlineOf } from "./doc-outline";

/**
 * A link between the repository's documents names a file. On the site that file
 * is a page, and the file itself is not deployed — only its rendering is — so
 * left alone `[VIEWSPEC.md](VIEWSPEC.md)` walks a reader into a 404. Any
 * fragment is kept: the section ids are the ones `outlineOf` assigns.
 */
const DOC_FILES: Readonly<Record<string, DocPageId>> = {
  "README.md": "overview",
  "VIEWSPEC.md": "reference",
};

function rewriteDocLinks(markdown: string): string {
  return markdown.replace(
    /\]\((README\.md|VIEWSPEC\.md)(#[^)\s]*)?\)/g,
    (whole, file: string, fragment: string | undefined) => {
      const page = DOC_FILES[file];
      return page ? `](${pageHref(page)}${fragment ?? ""})` : whole;
    },
  );
}

/**
 * The site's prose pages, as ViewSpec documents.
 *
 * Nothing here is a special case for documentation: the pages compose `Markdown`
 * out of the same registry a document reaches, bind their source through `data`
 * the way any document binds anything, and are handed to the same `ViewRenderer`
 * the playground previews into. The claim the package makes about generated
 * views is therefore one the site is standing on rather than describing — and
 * when it stops being true, the reference stops rendering.
 *
 * The markdown is the repository's own README and VIEWSPEC, imported as text.
 * Copying them into the document would put a second, staler spelling of the
 * reference behind a `--check` gate that only guards the first.
 */
function docPage(title: string, markdown: string): ViewSpec {
  const { intro, sections } = outlineOf(rewriteDocLinks(markdown));

  return {
    version: 1,
    title,
    data: {
      intro: { type: "static", value: intro },
      sections: { type: "static", value: sections },
    },
    root: {
      component: "Container",
      // Wider than a reading measure on purpose: prose is capped to one in CSS,
      // and the width left over is what the reference tables need.
      props: { size: "xl", className: "pg-docs" },
      children: [
        {
          component: "Stack",
          props: { gap: "r3" },
          children: [
            { component: "Markdown", props: { children: { $ref: "data.intro" } } },

            {
              component: "Stack",
              props: {
                as: "nav",
                "aria-label": "On this page",
                className: "pg-docs-toc",
                gap: "r6",
              },
              children: [
                {
                  // Text children, concatenated verbatim: the heading above the
                  // list is a literal, and `$each` contributes one already-made
                  // link per section. The list is one `Markdown`, so it parses
                  // as one `<ul>` — a node per row would parse as one list each.
                  component: "Markdown",
                  children: [
                    "**On this page**\n\n",
                    { $each: "data.sections", as: "section", node: { $ref: "section.link" } },
                  ],
                },
              ],
            },

            {
              $each: "data.sections",
              as: "section",
              node: {
                // The wrapper is what carries the anchor — see `doc-outline.ts`.
                component: "Stack",
                props: { as: "section", id: { $ref: "section.id" }, gap: "r4" },
                children: [
                  { component: "Markdown", props: { children: { $ref: "section.body" } } },
                ],
              },
            },

            {
              component: "Markdown",
              props: { className: "pg-docs-colophon" },
              children: [
                "*Rendered from JSON by `ViewRenderer` — this page is a ViewSpec document, ",
                "not bespoke markup. Its source arrives as a `static` data binding.*",
              ],
            },
          ],
        },
      ],
    },
  };
}

/** Typed by the page list, so a page added there fails here until it has a document. */
export const DOC_PAGES: Readonly<Record<DocPageId, ViewSpec>> = {
  overview: docPage("Overview", readme),
  reference: docPage("ViewSpec reference", viewspec),
};
