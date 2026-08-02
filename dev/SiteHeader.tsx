import { Select } from "@batthewz/response-ui-react-components";
import type { ReactNode } from "react";

import type { ThemeMode } from "../src/index";
import { pageHref, type PageId, SITE_PAGES } from "./site";
import { SITE_THEMES } from "./site-theme";

interface SiteHeaderProps {
  page: PageId;
  theme: string;
  onThemeChange: (theme: string) => void;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  /** Controls belonging to one page, placed ahead of the theme pickers. */
  children?: ReactNode;
}

/**
 * The site frame: brand, pages, and the theme controls every page is subject to.
 *
 * The pickers live here rather than on the playground because the prose pages
 * are rendered documents too — picking a theme reskins the reference you are
 * reading, which is the claim the package makes stated in the one form that
 * cannot be exaggerated.
 */
export function SiteHeader({
  page,
  theme,
  onThemeChange,
  themeMode,
  onThemeModeChange,
  children,
}: SiteHeaderProps) {
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

      <div className="pg-topbar-controls">
        {children}

        <div className="pg-control">
          <label className="pg-control-label" htmlFor="pg-theme">
            Theme
          </label>
          <Select
            id="pg-theme"
            className="py-r6"
            value={theme}
            onChange={(e) => onThemeChange(e.target.value)}
          >
            {SITE_THEMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>

        <div className="pg-control">
          <label className="pg-control-label" htmlFor="pg-mode">
            Scope
          </label>
          <Select
            id="pg-mode"
            className="py-r6"
            value={themeMode}
            onChange={(e) => onThemeModeChange(e.target.value as ThemeMode)}
          >
            <option value="root">page (root)</option>
            <option value="scoped">view (scoped)</option>
          </Select>
        </div>
      </div>
    </header>
  );
}
