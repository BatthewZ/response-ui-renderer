import type { ReactNode } from "react";

import { pageHref, type PageId, SITE_PAGES } from "./site";

interface SiteHeaderProps {
  page: PageId;
  /** Controls belonging to one page. The bar has none of its own. */
  children?: ReactNode;
}

/**
 * The site frame: brand, pages, and whatever the page below contributes.
 *
 * Mounted once, by `Site`, and never by a page: a bar a page renders is a bar
 * that is thrown away and rebuilt every time you follow a link in it, which
 * shows as a flash and loses whatever state its controls were holding. A page
 * with controls of its own passes them as children.
 *
 * It carried a theme picker over the example themes, and the scope control that
 * went with it. Both are gone. The picker put `events` / `grimdark` / `tech`
 * in a dropdown beside the brand, which reads as the set of themes the design
 * system ships — and it defines exactly one, `default`. The documents make the
 * theming claim better anyway, in the form a consumer would actually write it:
 * every exemplar carries its own `themeOverrides`, visible in the JSON next to
 * the view it repaints.
 */
export function SiteHeader({ page, children }: SiteHeaderProps) {
  return (
    <header className="pg-topbar">
      <div className="pg-brand">
        <span className="pg-mark" aria-hidden="true" />
        <span className="pg-brand-name">response-ui</span>
        <span className="pg-brand-part">renderer</span>
      </div>

      <nav className="pg-nav" aria-label="Pages">
        {SITE_PAGES.map((entry) => (
          <a
            key={entry.id}
            className="pg-nav-link"
            href={pageHref(entry.id)}
            aria-current={entry.id === page ? "page" : undefined}
          >
            {entry.label}
          </a>
        ))}
      </nav>

      <div className="pg-topbar-controls">{children}</div>
    </header>
  );
}
