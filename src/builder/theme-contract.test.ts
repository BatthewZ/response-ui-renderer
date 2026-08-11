import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { OUTPUT_PATH, parseThemeTemplate, TEMPLATE_PATH } from "../../scripts/theme-template";
import {
  formatOklch,
  groupThemeTokens,
  isColorValue,
  liveThemeValue,
  parseOklch,
  THEME_TOKEN_GROUPS,
  THEME_TOKENS,
  type ThemeToken,
} from "./theme-contract";

/**
 * The theme panel offers a set of tokens, and the whole value of that set is
 * that it is the one `@batthewz/response-ui-css` actually defines. It is
 * generated, so what needs guarding is the generation: this re-derives it from
 * the installed foundation and compares, which is what fails when the contract
 * moves upstream and nobody reruns the script.
 */

describe("the committed token set is the installed contract", () => {
  it("is exactly what the generator derives from the theme template today", () => {
    const derived = parseThemeTemplate(readFileSync(TEMPLATE_PATH, "utf8")) as ThemeToken[];
    expect(derived.length).toBeGreaterThan(30);
    expect(derived).toEqual(THEME_TOKENS);
    // And the file on disk is the same bytes, so `--check` in `prepublishOnly`
    // and this test cannot disagree about what "up to date" means.
    expect(readFileSync(OUTPUT_PATH, "utf8")).toBe(`${JSON.stringify(derived, null, 2)}\n`);
  });

  it("carries only custom properties, which is all an override can set", () => {
    // `themeOverrides` applies `--*` keys and drops everything else, so a
    // `color-scheme` row in the panel would be a control that does nothing.
    for (const token of THEME_TOKENS) expect(token.name.startsWith("--")).toBe(true);
    expect(THEME_TOKENS.map((token) => token.name)).not.toContain("color-scheme");
  });

  it("keeps the template's own sections, and files the core colours under them", () => {
    // Pinned: the sections come out of prose, so a rewrite upstream that changed
    // them should be a visible failure rather than a quietly relabelled panel.
    expect(THEME_TOKEN_GROUPS.map((group) => group.name)).toEqual([
      "Fonts",
      "Canvas (page background)",
      "Brand",
      "Surfaces (cards, sidebars, popovers)",
      "Text",
      "Borders",
      "Status",
      "Radii",
      "Shadows",
      "Motion",
      "Page transitions — reference @keyframes you define elsewhere",
      "Spacing, type scale & weights — RESPONSIVE.",
    ]);

    const groupOf = (name: string) => THEME_TOKENS.find((token) => token.name === name)?.group;
    expect(groupOf("--C-PRIMARY")).toBe("Brand");
    expect(groupOf("--C-SURFACE-0")).toBe("Surfaces (cards, sidebars, popovers)");
    expect(groupOf("--DEFAULT-FONT")).toBe("Fonts");
  });

  it("marks the tokens that step at a breakpoint, and only those", () => {
    // A flat override of one applies at every width and flattens the step. The
    // template declares exactly those twice, which is where this is read from.
    const responsive = THEME_TOKENS.filter((token) => token.responsive).map((t) => t.name);
    expect(responsive).toContain("--H1");
    expect(responsive).toContain("--R-SIZE-1");
    expect(responsive).toContain("--BodyText-1");
    expect(responsive).not.toContain("--C-PRIMARY");
    expect(responsive).not.toContain("--RADIUS-SM");
  });

  it("marks the optional tokens, which are the ones commented out upstream", () => {
    const optional = new Set(THEME_TOKENS.filter((t) => t.optional).map((t) => t.name));
    expect(optional.has("--RADIUS-SM")).toBe(true);
    expect(optional.has("--SHADOW-MD")).toBe(true);
    expect(optional.has("--C-PRIMARY")).toBe(false);
    expect(optional.has("--C-CANVAS")).toBe(false);
  });

  it("groups a list a host supplies the same way it groups its own", () => {
    const own: ThemeToken[] = [
      { name: "--A", suggested: "1", group: "One", responsive: false, optional: false },
      { name: "--B", suggested: "2", group: "One", responsive: false, optional: false },
      { name: "--C", suggested: "3", group: "Two", responsive: false, optional: false },
    ];
    expect(groupThemeTokens(own).map((group) => [group.name, group.tokens.length])).toEqual([
      ["One", 2],
      ["Two", 1],
    ]);
  });
});

describe("OKLCH channels", () => {
  it("reads the spelling the design system is authored in", () => {
    expect(parseOklch("oklch(0.55 0.22 263)")).toEqual({ l: 0.55, c: 0.22, h: 263 });
    expect(parseOklch("oklch(0.55 0.22 263 / 0.5)")).toEqual({ l: 0.55, c: 0.22, h: 263, alpha: 0.5 });
    expect(parseOklch("  oklch(1 0 0)  ")).toEqual({ l: 1, c: 0, h: 0 });
  });

  it("reads a percentage as a share of the channel's own range", () => {
    // 100% is lightness 1 and alpha 1, but chroma 0.4. One scale for all three
    // silently desaturates every colour it touches.
    expect(parseOklch("oklch(50% 50% 200)")).toEqual({ l: 0.5, c: 0.2, h: 200 });
    expect(parseOklch("oklch(50% 0.1 200 / 50%)")).toEqual({ l: 0.5, c: 0.1, h: 200, alpha: 0.5 });
  });

  it("refuses anything that is not one, rather than guessing", () => {
    for (const value of ["#ff0000", "rgb(1 2 3)", "var(--C-PRIMARY)", "1rem", "", "oklch()"]) {
      expect(parseOklch(value), value).toBeNull();
    }
  });

  it("round-trips a value without growing digits on every edit", () => {
    const parsed = parseOklch("oklch(0.55 0.22 263)");
    expect(parsed).not.toBeNull();
    expect(formatOklch(parsed!)).toBe("oklch(0.55 0.22 263)");
    expect(formatOklch({ l: 1 / 3, c: 0.1, h: 200 })).toBe("oklch(0.3333 0.1 200)");
    expect(formatOklch({ l: 0.5, c: 0.1, h: 200, alpha: 0.25 })).toBe("oklch(0.5 0.1 200 / 0.25)");
  });

  it("knows which values are worth a swatch", () => {
    expect(isColorValue("oklch(0.5 0.1 200)")).toBe(true);
    expect(isColorValue("#abc")).toBe(true);
    expect(isColorValue("rgb(0 0 0)")).toBe(true);
    expect(isColorValue("0.5rem")).toBe(false);
    expect(isColorValue('"Poppins", sans-serif')).toBe(false);
    expect(isColorValue("240ms")).toBe(false);
  });
});

describe("liveThemeValue", () => {
  it("falls back to the template's suggestion when nothing is painted", () => {
    // jsdom computes no custom properties, which is the same answer a token the
    // page has never defined gives in a browser.
    const token = THEME_TOKENS.find((t) => t.name === "--C-PRIMARY");
    expect(token).toBeDefined();
    expect(liveThemeValue(token!)).toBe(token?.suggested);
    expect(liveThemeValue("--C-PRIMARY")).toBe(token?.suggested);
    expect(liveThemeValue("--NOT-A-TOKEN")).toBe("");
  });
});
