import type { Ref } from "react";

import { lucideIcons } from "../src/icons";
import { ViewRenderer } from "../src/index";
import { useDemoAdapters } from "./adapters";
import { DOC_PAGES } from "./pages";
import type { DocPageId } from "./site";

interface DocsPageProps {
  page: DocPageId;
  /** The frame scrolls and focuses this on arrival — see `Site`. */
  ref?: Ref<HTMLElement>;
}

/**
 * A prose page, rendered the way any host renders a document.
 *
 * There is no markdown branch here and no documentation component: the page is a
 * ViewSpec, `ViewRenderer` is the only thing that reads it, and the adapters are
 * the same ones the playground hands its previews.
 *
 * Links inside the prose are the markdown's own anchors and navigate the browser
 * — they never reach `navigate`, which is an action a document declares, not
 * something a parsed link becomes. Links to another of the repository's
 * documents are therefore rewritten to page URLs before parsing; see `./pages`.
 */
export function DocsPage({ page, ref }: DocsPageProps) {
  const adapters = useDemoAdapters();

  return (
    // `position: relative` is not decoration — see `.pg-page` in app.css.
    <main className="pg-page" ref={ref} tabIndex={-1}>
      <ViewRenderer spec={DOC_PAGES[page]} icons={lucideIcons} adapters={adapters} />
    </main>
  );
}
