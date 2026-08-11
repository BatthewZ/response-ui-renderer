import tokens from "./theme-tokens.json";

/**
 * The theme contract — the tokens a document's `themeOverrides` may re-point.
 *
 * Derived from `_theme-template.css` in `@batthewz/response-ui-css`, the file a
 * consumer copies to write a theme, by `scripts/gen-theme-tokens.mjs`. Generated
 * rather than hand-kept for the reason everything else here is: a picker
 * offering a token the design system does not read is a control that does
 * nothing, and a list nobody regenerates becomes one.
 *
 * A host theming its own system passes its own tokens to the builder — this set
 * describes response-ui, not the shape of the idea.
 */

export type ThemeToken = {
  /** The custom property, `--C-PRIMARY`. */
  name: string;
  /** What the template suggests. A starting point, not the live value. */
  suggested: string;
  /** The section the template files it under — Brand, Surfaces, Status. */
  group: string;
  /**
   * Declared at two breakpoints in the template, so it bumps at 40rem.
   * `themeOverrides` is a flat inline style: an override applies at both widths
   * and the bump is lost. The panel says so where the token is.
   */
  responsive: boolean;
  /** Commented out in the template — optional, with a package default behind it. */
  optional: boolean;
};

export type ThemeTokenGroup = { name: string; tokens: readonly ThemeToken[] };

export const THEME_TOKENS: readonly ThemeToken[] = tokens;

/** The tokens in the template's own order, under the template's own headings. */
export const THEME_TOKEN_GROUPS: readonly ThemeTokenGroup[] = (() => {
  const groups: { name: string; tokens: ThemeToken[] }[] = [];
  for (const token of THEME_TOKENS) {
    const last = groups[groups.length - 1];
    if (last && last.name === token.group) last.tokens.push(token);
    else groups.push({ name: token.group, tokens: [token] });
  }
  return groups;
})();

/** Groups a list of tokens the same way, for a host that supplies its own. */
export function groupThemeTokens(list: readonly ThemeToken[]): readonly ThemeTokenGroup[] {
  const groups: { name: string; tokens: ThemeToken[] }[] = [];
  for (const token of list) {
    const last = groups[groups.length - 1];
    if (last && last.name === token.group) last.tokens.push(token);
    else groups.push({ name: token.group, tokens: [token] });
  }
  return groups;
}

export type Oklch = { l: number; c: number; h: number; alpha?: number };

/**
 * `oklch(0.55 0.22 263)` as numbers, or `null` for anything else.
 *
 * The design system is OKLCH-native, and the point of that space is that its
 * three channels mean something separately — lightness, chroma, hue. A slider
 * each is a better control than a colour well that cannot represent the value it
 * is editing, and it keeps an edit inside the gamut the theme was authored in.
 */
export function parseOklch(value: string): Oklch | null {
  const match =
    /^oklch\(\s*([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+)(?:deg)?(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i.exec(
      value.trim(),
    );
  if (match === null) return null;

  // A percentage means a share of the channel's full range, and the ranges
  // differ: 100% is lightness 1 and alpha 1, but chroma 0.4.
  const ratio = (raw: string, full: number): number =>
    raw.endsWith("%") ? (Number(raw.slice(0, -1)) / 100) * full : Number(raw);

  const [, l, c, h, alpha] = match;
  const parsed: Oklch = { l: ratio(l, 1), c: ratio(c, 0.4), h: Number(h) };
  if (alpha !== undefined) parsed.alpha = ratio(alpha, 1);

  return Number.isFinite(parsed.l) && Number.isFinite(parsed.c) && Number.isFinite(parsed.h)
    ? parsed
    : null;
}

const trim = (value: number, places: number): string => String(Number(value.toFixed(places)));

export function formatOklch({ l, c, h, alpha }: Oklch): string {
  const body = `${trim(l, 4)} ${trim(c, 4)} ${trim(h, 2)}`;
  return alpha === undefined ? `oklch(${body})` : `oklch(${body} / ${trim(alpha, 3)})`;
}

/** Whether a value is a colour, and so worth drawing a swatch for. */
export function isColorValue(value: string): boolean {
  const trimmed = value.trim();
  return /^(oklch|oklab|rgba?|hsla?|color|lab|lch)\(/i.test(trimmed) || /^#\w{3,8}$/.test(trimmed);
}

/**
 * What a token resolves to right now, on the element a view is themed from.
 *
 * The template's value is one theme's suggestion; what a picker should open on
 * is what the page is actually painted with, so a token the host's theme has
 * already moved does not snap back to a stranger's value the moment it is
 * touched.
 */
export function liveThemeValue(
  token: ThemeToken | string,
  element?: Element | null,
): string {
  const name = typeof token === "string" ? token : token.name;
  const fallback =
    typeof token === "string" ? (THEME_TOKENS.find((t) => t.name === name)?.suggested ?? "") : token.suggested;

  if (typeof window === "undefined") return fallback;
  const target = element ?? document.documentElement;
  const live = window.getComputedStyle(target).getPropertyValue(name).trim();
  return live !== "" ? live : fallback;
}
