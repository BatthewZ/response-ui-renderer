import { ReactNode } from 'react';
/**
 * Where `data-theme` is written.
 *
 * This is a real constraint of `@batthewz/response-ui-css`, not a preference.
 * Its built-in themes are authored `:root[data-theme="grimdark"]`, and `:root`
 * is `<html>` — so writing the attribute to a wrapper `<div>` matches nothing
 * and the theme silently does not apply.
 *
 * - `"root"`   — sets the attribute on `<html>`. Works with the built-in themes
 *                (default, events, grimdark, tech). Affects the whole document.
 * - `"scoped"` — sets it on the view's wrapper element. Themes the subtree only,
 *                but ONLY works for themes authored with a bare
 *                `[data-theme="…"]` selector. Built-in themes will not apply.
 *
 * `themeOverrides` is unaffected by this choice: inline custom properties
 * cascade to descendants regardless of selector, so it is always scoped and
 * always works.
 */
export type ThemeMode = "root" | "scoped";
/** Theme name meaning "no override layer" — the `:root` token set itself. */
export declare const DEFAULT_THEME = "default";
type ViewThemeScopeProps = {
    theme?: string;
    themeOverrides?: Record<string, string>;
    mode?: ThemeMode;
    className?: string;
    children: ReactNode;
};
export declare function ViewThemeScope({ theme, themeOverrides, mode, className, children, }: ViewThemeScopeProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ViewThemeScope.d.ts.map