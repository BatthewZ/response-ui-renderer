/**
 * The site is one HTML file and routes on a query parameter, exactly as the
 * `?view=` full-page route does. Nothing here is a router: a link is an `href`,
 * so every page is a real URL that can be shared, opened in a new tab and served
 * by static hosting with no rewrite rule — which is why the published site needs
 * no SPA fallback.
 *
 * Ids and labels live here rather than beside the documents they render, so the
 * documents can link to a page without importing the module that builds them.
 */
export type PageId = "playground" | "overview" | "reference";

/** Every page but the playground is a rendered document. */
export type DocPageId = Exclude<PageId, typeof PLAYGROUND_PAGE>;

export const PLAYGROUND_PAGE = "playground";

const PAGE_PARAM = "page";

export const SITE_PAGES: readonly { id: PageId; label: string }[] = [
  { id: PLAYGROUND_PAGE, label: "Playground" },
  { id: "overview", label: "Overview" },
  { id: "reference", label: "ViewSpec reference" },
];

export function pageHref(id: PageId): string {
  return `?${PAGE_PARAM}=${id}`;
}

export function isDocPageId(value: string | null): value is DocPageId {
  return SITE_PAGES.some((page) => page.id === value) && value !== PLAYGROUND_PAGE;
}

/** The requested page, falling back to the playground for anything unknown. */
export function requestedPage(search: string): PageId {
  const value = new URLSearchParams(search).get(PAGE_PARAM);
  return isDocPageId(value) ? value : PLAYGROUND_PAGE;
}
