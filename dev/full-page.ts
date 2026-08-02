/** `?view=<example name>` renders a committed document full-page, no demo chrome. */
export const EDITOR_VIEW = "editor";

/**
 * `?view=editor` renders whatever the playground's editor held when the link was
 * followed. localStorage rather than the query string because a document is far
 * past a URL's practical length, and rather than sessionStorage because a tab
 * opened with `rel="noreferrer"` does not inherit it.
 */
export const EDITOR_HANDOFF_KEY = "response-ui-renderer:full-page-document";
