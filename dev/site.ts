/**
 * The site is one HTML file and routes on a query parameter, exactly as the
 * `?view=` full-page route does. A link between pages is an ordinary `href`, so
 * every page is a real URL that can be shared, opened in a new tab and served by
 * static hosting with no rewrite rule — which is why the published site needs no
 * SPA fallback. `Site` intercepts a plain left-click on one of those links and
 * pushes the identical URL instead of reloading, which costs the URLs nothing
 * and buys a frame that survives the navigation.
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

/**
 * The page a query string names, or `null` for one that names none — which is
 * what separates a link this site owns from `?view=`, an anchor into the
 * repository, or anything else a document happens to point at.
 */
export function pageOf(search: string): PageId | null {
  const value = new URLSearchParams(search).get(PAGE_PARAM);
  return SITE_PAGES.some((page) => page.id === value) ? (value as PageId) : null;
}

/** The requested page, falling back to the playground for anything unknown. */
export function requestedPage(search: string): PageId {
  return pageOf(search) ?? PLAYGROUND_PAGE;
}
