import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { safeUrl } from "@batthewz/response-ui-react-components";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";

import { NOT_ADDRESSABLE } from "./examples/not-addressable";
import * as rootBarrel from "./index";
import {
  defaultReferenceContracts,
  renderReferenceRegions,
  renderViewSpecReference,
} from "./reference";
import {
  CHILD_INSPECTING_MODULES,
  CHILD_INSPECTING_PARENTS,
  IDENTITY_CHECKED_PARENTS,
} from "./registry/child-introspection";
import { COMPONENT_NOTES } from "./registry/component-notes";
import { FUNCTION_CHILDREN } from "./registry/function-children";
import { COMPONENT_TYPED_ICON_OWNERS } from "./registry/icon-slots";
import { PROP_COERCION_OWNERS, PROP_COERCIONS } from "./registry/prop-coercions";
import { defaultRegistry, listComponentNames } from "./registry/registry";
import {
  CONTENT_PROPS,
  HEADING_LEVEL_PROPS,
  RENAMED_ELEMENT_PROP_OWNERS,
  RENAMED_ELEMENT_PROPS,
  RENAMED_URL_PROP_OWNERS,
  RENAMED_URL_PROPS,
} from "./registry/sink-props";
import { TEXT_CHILDREN } from "./registry/text-children";
import { lookupComponent } from "./registry/types";
import { RENDER_DIAGNOSTIC_CLASSES, RENDER_DIAGNOSTIC_SELECTOR } from "./render/diagnostics";
import { NAME_PROP_MEANING } from "./render/id-scope";
import {
  ALLOWED_AS_ELEMENTS,
  DIALOG_COMPONENTS,
  isDangerousUrl,
  PROP_ENUMS,
  URL_PROPS as UNIVERSAL_URL_PROP_NAMES,
  validateViewSpec,
  warningsOf,
} from "./spec/validate";

/**
 * What the scan looks for in the library's JSX. The universal attribute names,
 * plus `to`: the router adapter's Link renders `<a href={to}>`, so a `to=` in a
 * component is a URL attribute one indirection away — and that indirection is
 * what hid two of the three holes this gate exists to prevent.
 */
const URL_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set([...UNIVERSAL_URL_PROP_NAMES, "to"]);

/**
 * URLs the renderer's filter and the component library's `safeUrl` must judge
 * identically. Spans both answers and every axis the two implementations could
 * drift on independently of their constants: scheme casing, the noise
 * characters a browser ignores mid-scheme, the tab/LF/CR refusal, the `data:`
 * MIME carve-out, and the relative forms that must never be refused.
 */
const SAFE_URL_CORPUS: readonly string[] = [
  "https://ok.example/x", "http://ok.example/x", "mailto:a@b.example", "tel:+441234",
  "/relative", "./sibling", "../up", "#anchor", "?q=1", "", "//cdn.example/a.png",
  "/path?x=a:b", "./a:b.md",
  "data:image/png;base64,iVBORw0KGgo=", "data:image/jpeg,x", "data:image/gif,x",
  "data:image/webp,x", "data:image/avif,x", "data:image/jpg,x",
  "javascript:alert(1)", "JaVaScRiPt:alert(1)", "vbscript:msgbox(1)",
  "data:text/html;base64,PHNjcmlwdD4=", "data:image/svg+xml,<svg onload=alert(1)>",
  "data:image/svg+xml;base64,PHN2Zz4=", "data:application/xhtml+xml,<html/>",
  "data:text/plain,hello", "data:font/woff2;base64,x", "data:image/pngx,y",
  "blob:https://evil.example/8f2c", "view-source:https://evil.example",
  "file:///etc/passwd", "ws://evil.example", "ftp://files.example/x",
  "intent://scan#Intent;scheme=zxing;end", "sms:+441234", "geo:51.5,-0.12",
  "java\tscript:alert(1)", "java\nscript:alert(1)", " javascript:alert(1)",
  "java\u200bscript:alert(1)", "java\ufeffscript:alert(1)", "\u0000javascript:alert(1)",
  "https://ok.example/a\tb", "https://ok.example/a\nb", "mailto:a@b.example?body=x\ny",
];

/**
 * Contracts this package commits to, enforced rather than documented.
 *
 * Each maps to a constraint the design system states about itself. Prose in a
 * README cannot fail; these can.
 */

const root = path.resolve(import.meta.dirname, "..");
// The library publishes its own `src` (its `files` includes it), so the gates
// below read the real upstream source rather than a copy that could drift.
// Resolved by path because its `exports` map deliberately hides package.json.
const libraryRoot = path.join(root, "node_modules/@batthewz/response-ui-react-components");
const sourceFiles = globSync("src/**/*.{ts,tsx}", { cwd: root, absolute: true });
const shippedFiles = sourceFiles.filter((file) => !/\.test\.tsx?$/.test(file));

const read = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => path.relative(root, file);

/**
 * The Props cell of a component's row in the reference's four-column tables.
 *
 * A component name also heads rows in the narrower slot and text-children
 * tables, so the row is chosen by shape, and cells are split on unescaped pipes
 * only — a union of literals carries `\|` inside one cell.
 */
function propsCellOf(doc: string, name: string): string | undefined {
  for (const row of doc.matchAll(new RegExp(`^\\| \`${name}\` \\|.*$`, "gm"))) {
    const cells = row[0].split(/(?<!\\)\|/).map((cell) => cell.trim());
    if (cells.length === 6) return cells[3];
  }
  return undefined;
}

/** Module specifiers only — prose in a comment is not a dependency. */
function importedModules(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

describe("dependency contract", () => {
  const pkg = JSON.parse(read(path.join(root, "package.json"))) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    sideEffects?: unknown;
  };

  it("marks its stylesheets as side-effectful, so a bundler cannot drop them", () => {
    // `sideEffects: false` is what makes the JS tree-shake, and it is also a
    // licence for a bundler to delete `import "…/builder.css"` — the only way a
    // consumer has of getting the chrome's styles, and the line the README
    // tells them to write. The array form keeps both.
    expect(pkg.sideEffects).toEqual(["*.css"]);
  });

  it("ships no runtime dependencies", () => {
    // response-ui-react-components: "do NOT add a validator as a runtime
    // dependency" — and the same reasoning applies to everything else. A
    // consumer's bundle should gain nothing but this package's own code.
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it("keeps zod an optional peer, never a hard requirement", () => {
    expect(pkg.peerDependencies?.zod).toBeDefined();
    expect(pkg.peerDependenciesMeta?.zod?.optional).toBe(true);
  });

  it("imports zod from exactly one module, so the core never pulls it in", () => {
    const importers = shippedFiles.filter((file) =>
      importedModules(read(file)).some((m) => m === "zod" || m.startsWith("zod/")),
    );
    expect(importers.map(rel)).toEqual(["src/zod.ts"]);
  });

  it("imports lucide from exactly one module, so the core never pulls in ~1600 icons", () => {
    const importers = shippedFiles.filter((file) =>
      importedModules(read(file)).some((m) => m.startsWith("lucide-react")),
    );
    expect(importers.map(rel)).toEqual(["src/icons.ts"]);
  });
});

describe("design-system contract", () => {
  it("uses no raw hex colours", () => {
    // ETHOS.md: "If you're about to write a raw hex code […] stop. There is a
    // token for it." The renderer this replaces hardcoded six.
    const offenders = shippedFiles.filter((file) => /#[0-9a-fA-F]{3,8}\b/.test(read(file)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("writes no CSS-in-JS", () => {
    // The extracted renderer injected a <style> tag holding @keyframes.
    for (const file of shippedFiles) {
      const source = read(file);
      expect(source, rel(file)).not.toMatch(/<style[\s>]/);
      expect(source, rel(file)).not.toMatch(/@keyframes/);
    }
  });

  // Every stylesheet the package ships, not one named file. The builder's chrome
  // arrived as a second one, and a gate that names `styles.css` would have gone
  // on passing while the new sheet did whatever it liked.
  const shippedStylesheets = globSync("src/**/*.css", { cwd: root, absolute: true });

  it("ships more than one stylesheet, so these gates have to read them all", () => {
    expect(shippedStylesheets.map(rel).sort()).toEqual([
      "src/builder/builder.css",
      "src/styles.css",
    ]);
  });

  it.each(shippedStylesheets)("%s writes no colour of its own", (file) => {
    // Colour only — these sheets do carry raw *lengths*, deliberately: chrome
    // geometry is not part of the design language. Colour is, and a raw one
    // stops following the theme silently.
    //
    // Case-insensitive, and `oklch`/`oklab`/`lab`/`lch`/`color-mix` are in the
    // list because the design system is authored in OKLCH — `oklch(…)` is the
    // syntax someone here would actually reach for, and it was the one the
    // original spelling of this gate let through.
    const css = read(file);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgba?|hsla?|hwb|oklch|oklab|lab|lch|color|color-mix)\s*\(/i);
    // The named colours, less the four keywords that are not colours at all.
    // An allowlist would need a CSS value parser; this is the set that shows up
    // when someone is sketching.
    expect(css).not.toMatch(
      /:\s*(white|black|red|blue|green|grey|gray|silver|purple|orange|yellow|pink|rebeccapurple)\b/i,
    );
    expect(css).toMatch(/var\(--R-SIZE-/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it("styles diagnostics with the status tokens they are about", () => {
    expect(read(path.join(root, "src/styles.css"))).toMatch(/var\(--C-STATUS-ERROR\)/);
  });

  it.each(shippedStylesheets)(
    "%s honours the contrast contract: no fill token as ink on a surface",
    (file) => {
      // response-ui-css AGENTS.md, Don'ts: "No fill token (--C-PRIMARY /
      // --C-ACCENT / status bg-*) as ink on a surface — it's only guaranteed to
      // contrast its own on-* text, not the surface."
      // Status *-BG pairs are the blessed exception: --C-STATUS-X on
      // --C-STATUS-X-BG is the documented tint pattern.
      // Matched by prefix and without the closing paren, so `--C-PRIMARY-HOVER`
      // and `var(--C-ACCENT, black)` are caught too — every one of them is a
      // fill, and the first spelling of this gate saw none of them. The status
      // backgrounds are fills as well; they are excluded from the ink test
      // rather than the list because `--C-STATUS-X` on `--C-STATUS-X-BG` is the
      // documented tint pair and this sheet uses it.
      const css = read(file);
      for (const fill of ["--C-PRIMARY", "--C-ACCENT", "--C-SECONDARY"]) {
        const used = new RegExp(`var\\(\\s*${fill}[,)-]`).test(css);
        expect(used, `${fill} (or a variant of it) used as ink`).toBe(false);
      }
    },
  );

  it.each(shippedStylesheets)("%s uses only tokens response-ui-css defines", (file) => {
    // A typo'd custom property fails silently at runtime — the declaration is
    // simply dropped. Cross-check every token against the foundation package.
    const cssRoot = path.join(root, "node_modules/@batthewz/response-ui-css/src");
    // Not `examples/`: those themes are worked examples that "deleting must
    // break nothing", so a token defined only there is not part of the contract
    // and must not certify a usage here.
    const foundation = globSync("**/*.css", { cwd: cssRoot, absolute: true, ignore: "examples/**" })
      .map(read)
      .join("\n");

    const css = read(file);
    // A sheet may declare custom properties of its own — the builder's panel
    // widths are two — and those are not the foundation's to define. They must
    // be namespaced, though: an unnamespaced one is this package writing into
    // the design system's own vocabulary from the outside.
    const declared = new Set([...css.matchAll(/^\s*(--[A-Za-z0-9-]+)\s*:/gm)].map((m) => m[1]));
    expect([...declared].filter((token) => !token.startsWith("--rui-"))).toEqual([]);

    const used = new Set([...css.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(10);

    const undefined_ = [...used].filter(
      (token) => !declared.has(token) && !foundation.includes(`${token}:`),
    );
    expect(undefined_).toEqual([]);
  });
});

describe("host-independence contract", () => {
  it("depends on no router", () => {
    const routers = /^(react-router|react-router-dom|next\/(router|navigation)|@tanstack\/react-router)$/;
    for (const file of shippedFiles) {
      const offending = importedModules(read(file)).filter((m) => routers.test(m));
      expect(offending, rel(file)).toEqual([]);
    }
  });

  it("hardcodes no server routes", () => {
    // The extracted renderer rewrote every binding to /api/fetch and /api/proxy.
    for (const file of shippedFiles) {
      expect(read(file), rel(file)).not.toMatch(/["'`]\/api\//);
    }
  });

  it("names no host-specific binding type", () => {
    // `connection` resolved credentials from one app's database table.
    for (const file of shippedFiles) {
      expect(read(file), rel(file)).not.toMatch(/connectionId/);
    }
  });
});

describe('RSC "use client" contract', () => {
  // response-ui-react-components applies the directive selectively and ships a
  // verify-directives script; this is the equivalent gate. Without it,
  // ViewRenderer cannot be imported from a Next.js App Router server component.
  const CLIENT_ONLY = /\b(useState|useEffect|useMemo|useCallback|useRef|useId|useContext|createContext|useSyncExternalStore|extends Component)\b/;

  it("marks every module that needs the client boundary", () => {
    const missing = shippedFiles.filter((file) => {
      const source = read(file);
      return CLIENT_ONLY.test(source) && !/^\s*["']use client["'];/.test(source);
    });
    expect(missing.map(rel)).toEqual([]);
  });

  it("leaves barrels and pure modules directive-neutral", () => {
    // A directive on a barrel would drag the whole package across the boundary.
    for (const file of ["src/index.ts", "src/spec/index.ts", "src/spec/types.ts", "src/spec/validate.ts", "src/zod.ts"]) {
      expect(read(path.join(root, file)), file).not.toMatch(/^\s*["']use client["']/);
    }
  });
});

describe("render diagnostics are discoverable", () => {
  it("declares every diagnostic class in one module", () => {
    // The corpus gates ask the DOM "did anything go wrong?" via
    // RENDER_DIAGNOSTIC_SELECTOR. A diagnostic rendered with a literal class
    // would answer no — which is how a text-only gate missed three error boxes
    // and a missing icon that renders no text at all.
    const offenders = shippedFiles
      .filter((file) => rel(file) !== "src/render/diagnostics.ts")
      .filter((file) => /["'`]rui-render-/.test(read(file)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("matches every class the selector looks for", () => {
    const declared = [...RENDER_DIAGNOSTIC_SELECTOR.matchAll(/\.([\w-]+)/g)].map((m) => m[1]).sort();
    expect(declared).toEqual([...Object.values(RENDER_DIAGNOSTIC_CLASSES)].sort());
  });
});

describe("sources stay text", () => {
  it("embeds no control character that makes git treat a source file as binary", () => {
    // A raw NUL written into a string literal costs the whole file its diff:
    // git renders it as "Binary files differ" and `git grep`/ripgrep skip it,
    // so the file silently drops out of review and out of every search.
    // Spell them as escapes instead — "\u0000" is the same string, still text.
    // Tab, newline and carriage return are exempt; git tolerates those.
    const offenders = sourceFiles
      .filter((file) => [...read(file)].some((ch) => {
        const code = ch.codePointAt(0) ?? 0;
        return code < 0x09 || (code > 0x0d && code < 0x20);
      }))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("no suppressed diagnostics", () => {
  it("carries no eslint or typescript ignores anywhere, tests included", () => {
    // CLAUDE.md: "Never suppress or add ts/eslint error ignores."
    // This file is excluded because it necessarily spells the patterns it hunts.
    const suppression = /eslint-disable|@ts-expect-error|@ts-ignore|@ts-nocheck/;
    // `dev/` too: it is inside the TypeScript project and is linted alongside
    // `src/`, so a suppression there silences a real gate. The dependency and
    // import gates deliberately stay off it — a harness may use devDependencies
    // the published package must not.
    const offenders = [...sourceFiles, ...globSync("dev/**/*.{ts,tsx}", { cwd: root, absolute: true })]
      .filter((file) => rel(file) !== "src/contracts.test.ts")
      .filter((file) => suppression.test(read(file)));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe("icon-slot map stays in step with the library", () => {
  it.each(COMPONENT_TYPED_ICON_OWNERS)("%s still exists upstream", (name) => {
    // Hand-maintained list — this converts an upstream rename into a test
    // failure instead of a runtime crash in a consumer's browser.
    expect(lookupComponent(defaultRegistry, name)).toBeTruthy();
  });
});

/**
 * Every table that names a component by hand is drift-prone. The registry is
 * derived from the library's barrel precisely so nothing has to be, but three
 * coercion tables cannot be derived — they encode which props the library types
 * with something JSON cannot express. Each is gated instead.
 */
describe("hand-maintained coercion tables", () => {
  it.each([...DIALOG_COMPONENTS])("%s is a real component whose open state we own", (name) => {
    expect(lookupComponent(defaultRegistry, name)).toBeTruthy();
  });

  it.each([...CHILD_INSPECTING_PARENTS.keys()])("%s still exists upstream", (name) => {
    expect(lookupComponent(defaultRegistry, name)).toBeTruthy();
  });

  it.each(Object.keys(IDENTITY_CHECKED_PARENTS))("%s still exists upstream", (name) => {
    expect(lookupComponent(defaultRegistry, name)).toBeTruthy();
  });

  it.each(PROP_COERCION_OWNERS)("%s still exists upstream", (name) => {
    expect(lookupComponent(defaultRegistry, name)).toBeTruthy();
  });

  it("every coerced prop is still declared by its component upstream", () => {
    // A prop renamed upstream would leave the coercion silently inert, which is
    // worse than a crash: the document looks right and the value never lands.
    const missing: string[] = [];
    for (const key of PROP_COERCIONS.keys()) {
      const dot = key.lastIndexOf(".");
      const owner = key.slice(0, dot).split(".")[0];
      const prop = key.slice(dot + 1);
      const declaration = globSync(`src/components/**/${owner}.tsx`, {
        cwd: libraryRoot,
        absolute: true,
      })[0];
      if (!declaration) {
        missing.push(`${key} (no ${owner}.tsx upstream)`);
        continue;
      }
      if (!new RegExp(`\\b${prop}\\??:`).test(read(declaration))) {
        missing.push(`${key} (prop not declared)`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("names every library module that clones or identity-checks its children", () => {
    // The renderer stands between such a parent and the real element. A
    // component that starts doing either without being named here silently stops
    // working — nothing throws, the behaviour simply never happens.
    const inspecting = globSync("src/components/**/*.tsx", { cwd: libraryRoot })
      .filter((file) => !/\.(test|examples)\.tsx$/.test(file))
      .filter((file) => {
        const source = read(path.join(libraryRoot, file));
        // `child.type === X` compares element identity; `target.type === "text"`
        // is a DOM input type and is not a child inspection.
        return /\bcloneElement\b/.test(source) || /\.type\s*[!=]==\s*[A-Z]/.test(source);
      })
      .map((file) => file.replace(/^src\//, ""))
      .sort();

    expect(inspecting).toEqual([...CHILD_INSPECTING_MODULES].sort());
  });
});

/**
 * The two sink tables, and the gate that is the actual point of them.
 *
 * A URL filter keyed on the prop's name is only ever as complete as its list of
 * names, and that list was hand-kept: `AppShell.SidebarLink.to`,
 * `Swimlane.viewAllHref` and `RequireAuth.redirect` all reached a live `href`
 * because nobody had written them down. Keying on the value instead is not
 * available — `CodeBlock.code` holds a `javascript:` string legitimately — so
 * the name stays the key and the *list* stops being hand-kept: the scan below
 * reads the library's own source and fails when it finds a sink nobody
 * classified. A rename test cannot do this; only an omission test can.
 */
describe("the gates read the library this package says it supports", () => {
  it("the installed peer satisfies the declared range", () => {
    // Every gate below reads `node_modules`, so all of them are only as
    // meaningful as the version sitting there. That version drifted behind the
    // declared peer range once already, and the whole suite stayed green while
    // validating a library the package no longer claimed to support — the one
    // failure mode no amount of scanning can notice from the inside.
    const declared = (
      JSON.parse(read(path.join(root, "package.json"))) as {
        peerDependencies: Record<string, string>;
      }
    ).peerDependencies["@batthewz/response-ui-react-components"];
    const installed = (
      JSON.parse(read(path.join(libraryRoot, "package.json"))) as { version: string }
    ).version;

    // Caret on 0.x pins the minor, which is this repo's stated rule: "pre-1.0 a
    // break bumps the minor". Spelled out rather than pulling in a semver
    // package, because this package ships no runtime dependencies and one more
    // dev dependency to compare two triples is not worth it.
    const parse = (v: string) => v.replace(/^\^/, "").split(".").map(Number);
    const [dMajor, dMinor, dPatch] = parse(declared);
    const [iMajor, iMinor, iPatch] = parse(installed);
    const ceiling = dMajor === 0 ? [0, dMinor + 1, 0] : [dMajor + 1, 0, 0];
    const atLeast =
      iMajor > dMajor ||
      (iMajor === dMajor && (iMinor > dMinor || (iMinor === dMinor && iPatch >= dPatch)));
    const below =
      iMajor < ceiling[0] ||
      (iMajor === ceiling[0] && (iMinor < ceiling[1] || (iMinor === ceiling[1] && iPatch < ceiling[2])));

    expect({ declared, installed, satisfies: atLeast && below }).toEqual({
      declared,
      installed,
      satisfies: true,
    });
  });
});

describe("sink-prop tables stay in step with the library", () => {
  it.each([...RENAMED_URL_PROP_OWNERS, ...RENAMED_ELEMENT_PROP_OWNERS])(
    "%s still exists upstream",
    (name) => {
      expect(lookupComponent(defaultRegistry, name)).toBeTruthy();
    },
  );

  it.each([...RENAMED_URL_PROPS, ...RENAMED_ELEMENT_PROPS])(
    "%s is still declared by its component upstream",
    (key) => {
      const dot = key.lastIndexOf(".");
      const owner = key.slice(0, dot).split(".")[0];
      const prop = key.slice(dot + 1);
      const declaration = globSync(`src/components/**/${owner}.tsx`, {
        cwd: libraryRoot,
        absolute: true,
      })[0];
      expect(declaration).toBeTruthy();
      expect(new RegExp(`\\b${prop}\\??:`).test(read(declaration))).toBe(true);
    },
  );

  /**
   * Every JSX attribute in the library that a browser resolves as a URL, paired
   * with the identifier feeding it: `href={viewAllHref}` → `viewAllHref`.
   * Attribute values that are not a bare identifier (`src={preview?.url}`) are
   * component-internal by construction and are reported separately.
   */
  /**
   * Prose is not code. The library documents these very indirections in its
   * docblocks — `AppShell` explains `<a href={to} {...rest}>` in a comment — and
   * a gate that reads a comment as a finding can also be *satisfied* by one.
   * Block comments and whole-line `//` comments only, so a `https://` inside a
   * string literal survives.
   */
  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  function urlAttributeFeeds(source: string): { prop: string; attr: string }[] {
    const names = [...URL_ATTRIBUTE_NAMES].join("|");
    return [...source.matchAll(new RegExp(`\\b(${names})=\\{(\\w+)\\}`, "g"))].map((m) => ({
      attr: m[1],
      prop: m[2],
    }));
  }

  it("names every prop that feeds a URL attribute under a different name", () => {
    // The scan is over the library's shipped `src`, which is the real upstream
    // rather than a copy of it. `to=` is included because the router adapter's
    // Link turns it into an `href` — that indirection is exactly what hid two
    // of the three holes.
    const files = globSync("src/components/**/*.tsx", { cwd: libraryRoot, absolute: true }).filter(
      (file) => !/\.(test|examples)\.tsx$/.test(file),
    );

    const unclassified: string[] = [];
    let feeds = 0;

    for (const file of files) {
      const source = stripComments(read(file));
      for (const { prop, attr } of urlAttributeFeeds(source)) {
        feeds += 1;
        // Spelled like the attribute it becomes — the universal set covers it
        // for every component at once, registered or not.
        if (UNIVERSAL_URL_PROP_NAMES.has(prop)) continue;
        // Declared by the component that renders this element, under this name?
        // If not, the identifier is a local and the value never came from a
        // document. `\bprop\??:` is the same declaration test the coercion gate
        // uses, applied to the file the attribute lives in.
        if (!new RegExp(`^\\s+${prop}\\??\\s*:`, "m").test(source)) continue;
        const owner = path.basename(file, ".tsx");
        // The question this gate asks is whether a *document* can put a value
        // here, so the two populations that answer "no" are not findings:
        //
        // `router-adapter` is the indirection itself, not a component — its
        // `to` is where the classified props arrive, and the registry has no
        // such name. `FileUpload` is on the not-addressable list: it needs a
        // live `File`, so its `previewUrl` can only ever be a blob URL the
        // component minted for itself.
        //
        // Both are read from existing sources of truth rather than named here.
        // A component leaving `NOT_ADDRESSABLE`, or the adapter growing a real
        // registry entry, re-arms this test by itself.
        if (!lookupComponent(defaultRegistry, owner)) continue;
        if (Object.hasOwn(NOT_ADDRESSABLE, owner)) continue;
        const classified = [...RENAMED_URL_PROPS].some((key) => {
          const [component, declared] = [key.slice(0, key.lastIndexOf(".")), key.slice(key.lastIndexOf(".") + 1)];
          return declared === prop && component.split(".")[0] === owner;
        });
        if (!classified) unclassified.push(`${owner}.${prop} → ${attr} (${path.basename(file)})`);
      }
    }

    // The scan finding nothing would satisfy the assertion below it.
    expect(feeds).toBeGreaterThan(0);
    expect(unclassified).toEqual([]);
  });

  it("names every prop that chooses the host element under a different name", () => {
    // `as` is universal; anything else that lands in a JSX tag position is a
    // renamed element picker. The library spells those by destructuring with a
    // capitalised alias — `titleAs: Heading = "h2"` — which is what this finds.
    const files = globSync("src/components/**/*.tsx", { cwd: libraryRoot, absolute: true }).filter(
      (file) => !/\.(test|examples)\.tsx$/.test(file),
    );

    const unclassified: string[] = [];
    let pickers = 0;

    for (const file of files) {
      const source = stripComments(read(file));
      // `[{,\n]` rather than a line anchor: the library destructures inline —
      // `{ title, titleAs: Heading = "h2", … }` — and anchoring to the start of
      // a line silently skipped `AppShell.SidebarSection.titleAs`, one of the
      // three props this gate exists to have found.
      for (const match of source.matchAll(/[{,\n]\s*(\w+):\s*[A-Z]\w*\s*=\s*["'](\w+)["']/g)) {
        const [, prop, fallback] = match;
        // The alias defaults to a real host element — that is what makes this a
        // tag position rather than an ordinary renamed prop.
        if (!ALLOWED_AS_ELEMENTS.has(fallback)) continue;
        pickers += 1;
        if (prop === "as") continue;
        const owner = path.basename(file, ".tsx");
        const classified = [...RENAMED_ELEMENT_PROPS].some((key) => {
          const [component, declared] = [key.slice(0, key.lastIndexOf(".")), key.slice(key.lastIndexOf(".") + 1)];
          return declared === prop && component.split(".")[0] === owner;
        });
        if (!classified) unclassified.push(`${owner}.${prop} (defaults to <${fallback}>)`);
      }
    }

    expect(pickers).toBeGreaterThan(0);
    expect(unclassified).toEqual([]);
  });

  it("names every content prop that collides with a URL attribute's name", () => {
    // The other direction of the same mistake. `ActivityFeed.Item.action` is a
    // `ReactNode` slot whose name happens to be `<form action>`; under a scheme
    // allowlist ordinary prose has a scheme, so the slot rendered empty. A prop
    // the library types as content is never a URL, whatever it is called.
    const files = globSync("src/components/**/*.tsx", { cwd: libraryRoot, absolute: true }).filter(
      (file) => !/\.(test|examples)\.tsx$/.test(file),
    );
    const names = [...UNIVERSAL_URL_PROP_NAMES].join("|");
    const unclassified: string[] = [];
    let slots = 0;

    for (const file of files) {
      const source = stripComments(read(file));
      for (const match of source.matchAll(
        new RegExp(`^\\s+(${names})\\??:\\s*(ReactNode|ReactElement)\\b`, "gm"),
      )) {
        slots += 1;
        const owner = path.basename(file, ".tsx");
        const classified = [...CONTENT_PROPS].some((key) => {
          const dot = key.lastIndexOf(".");
          return key.slice(dot + 1) === match[1] && key.slice(0, dot).split(".")[0] === owner;
        });
        if (!classified) {
          unclassified.push(`${owner}.${match[1]} is content — add it to CONTENT_PROPS`);
        }
      }
    }

    expect(slots).toBeGreaterThan(0);
    expect(unclassified).toEqual([]);
  });

  it("names every prop interpolated into a tag name", () => {
    // `Accordion` builds `` `h${headingLevel}` ``. The value is a fragment, so
    // the element allowlist cannot judge it and it needs its own table.
    const files = globSync("src/components/**/*.tsx", { cwd: libraryRoot, absolute: true }).filter(
      (file) => !/\.(test|examples)\.tsx$/.test(file),
    );
    const unclassified: string[] = [];
    let interpolations = 0;

    for (const file of files) {
      const source = stripComments(read(file));
      for (const match of source.matchAll(/=\s*`[a-z]+\$\{(\w+)\}`/g)) {
        interpolations += 1;
        const owner = path.basename(file, ".tsx");
        const classified = [...HEADING_LEVEL_PROPS].some((key) => {
          const dot = key.lastIndexOf(".");
          return key.slice(dot + 1) === match[1] && key.slice(0, dot).split(".")[0] === owner;
        });
        if (!classified) {
          unclassified.push(`${owner}.${match[1]} builds a tag name — add it to HEADING_LEVEL_PROPS`);
        }
      }
    }

    expect(interpolations).toBeGreaterThan(0);
    expect(unclassified).toEqual([]);
  });

  it("finds every prop bag the library spreads named so the nested check sees it", () => {
    // The nested filter is scoped to props whose name ends in `Props`. That is
    // the library's convention, not a rule it is bound by, so it is asserted:
    // a bag named otherwise would be spread onto an element unexamined.
    const files = globSync("src/components/**/*.tsx", { cwd: libraryRoot, absolute: true }).filter(
      (file) => !/\.(test|examples)\.tsx$/.test(file),
    );
    const bags = new Set<string>();
    for (const file of files) {
      const source = stripComments(read(file));
      for (const match of source.matchAll(/\{\.\.\.(\w+)\}/g)) {
        // Only bags a *document* fills. `dismissHandlers` is a local from
        // `useLightDismiss`; the component's own rest element is not a bag
        // either. Both are excluded by asking whether the name is a declared
        // prop, rather than by naming them here — a local that later becomes a
        // prop re-arms this by itself.
        if (/^(props|rest|others|restProps)$/.test(match[1])) continue;
        if (!new RegExp(`^\\s+${match[1]}\\??\\s*:`, "m").test(source)) continue;
        bags.add(match[1]);
      }
    }
    expect(bags.size).toBeGreaterThan(0);
    expect([...bags].filter((name) => !name.endsWith("Props"))).toEqual([]);
  });

  it("agrees with the component library's own URL policy, by behaviour", () => {
    // The same question, settled first by `safeUrl` in the component library.
    // The renderer cannot call it at runtime — `/spec` must stay free of React
    // AND of the component library, so a server can validate without either —
    // so the decision is mirrored, and this is what stops the mirror drifting
    // into a second, weaker opinion.
    //
    // Compared by BEHAVIOUR, not by reading the two declarations as text. The
    // text form of this gate passed as long as the two constants matched, which
    // left the scheme-noise stripping and the way each side *uses* those
    // constants unexamined — and those are where a divergence would actually
    // live. A shared corpus asks the only question that matters: do the two
    // agree about this URL?
    // A URL that trims to empty is the one input where `safeUrl`'s sentinel is
    // ambiguous — `""` means both "refused" and "allowed, and it was empty".
    // Asserted separately below rather than skipped, so the exclusion is a
    // recorded fact about the two contracts and not a quiet allowance.
    const verdicts = [...SAFE_URL_CORPUS].filter((url) => url.trim() !== "").map((url) => ({
      url,
      // `safeUrl` returns "" to refuse; `isDangerousUrl` returns true to refuse.
      upstreamRefuses: safeUrl(url) === "",
      oursRefuses: isDangerousUrl(url),
    }));

    // The corpus must exercise both answers, or agreement is trivial.
    expect(verdicts.some((v) => v.upstreamRefuses)).toBe(true);
    expect(verdicts.some((v) => !v.upstreamRefuses)).toBe(true);

    const disagreements = verdicts.filter((v) => v.upstreamRefuses !== v.oursRefuses);
    expect(disagreements).toEqual([]);
  });

  it.each(["", "   "])("both treat %j as nothing to render, by different means", (url) => {
    // `safeUrl` returns "", which its callers read as a refusal; the renderer
    // calls it safe and lets an empty attribute through. Neither is wrong and
    // neither is dangerous — an empty `href` resolves to the current page — but
    // it is the one place the two contracts do not line up, and it is written
    // down here so nobody has to rediscover it from a failing corpus.
    expect(safeUrl(url)).toBe("");
    expect(isDangerousUrl(url)).toBe(false);
  });
});

describe("`name` classification stays in step with the library", () => {
  it.each(Object.keys(NAME_PROP_MEANING))("%s still exists upstream", (name) => {
    expect(lookupComponent(defaultRegistry, name)).toBeTruthy();
  });

  it("classifies every component whose `name` could be a DOM name", () => {
    // `name` is scoped as a DOM form-control name unless this table says
    // otherwise, and getting that wrong is silent in both directions: an
    // unclassified semantic `name` is corrupted (an icon vanishes, initials go
    // wrong), and a `name` wrongly called semantic leaves radio groups merged.
    //
    // Read from the shipped declarations rather than the library's working
    // tree — those are the contract for the installed peer range.
    const declarations = globSync("dist/**/*.d.ts", { cwd: libraryRoot, absolute: true });

    const declaring: string[] = [];
    const unclassified: string[] = [];
    const unresolved: string[] = [];

    for (const file of declarations) {
      const source = read(file);
      // Brace-matched rather than line-terminated: these types close with
      // `} & ComponentPropsWithRef<"input">;`, so a `^};?$` terminator matches
      // nothing at all — which is how this gate first shipped seeing zero of
      // them and passing.
      // A generic parameter may itself carry a default (`<T = Fallback>`), so
      // the head is matched loosely and anchored on the brace that opens the
      // body — AvatarUpload declares exactly that and a tighter guard drops it.
      // `interface` counts too: the library uses both spellings, and a props
      // type this cannot see is a `name` nobody classified.
      for (const match of source.matchAll(
        /^(?:export )?(?:type (\w+?)(?:Own)?Props(?:<.*>)? = |interface (\w+?)(?:Own)?Props(?:<.*>)? )\{$/gm,
      )) {
        let depth = 1;
        let i = match.index + match[0].length;
        for (; i < source.length && depth > 0; i++) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") depth--;
        }
        const body = source.slice(match.index + match[0].length, i);
        // `name\??:`, not `name\?:`. Requiring the optional marker filtered out
        // exactly the population this exists to catch: a pass-through DOM name
        // is optional, a load-bearing semantic one tends to be required. That
        // one character let `ViewTransition` and `Repeater` through while the
        // gate stayed green.
        if (!/^\s+name\??\s*:/m.test(body)) continue;

        const component = match[1] ?? match[2];
        declaring.push(component);
        if (lookupComponent(defaultRegistry, component)) {
          if (!Object.hasOwn(NAME_PROP_MEANING, component)) unclassified.push(component);
          continue;
        }
        // Named rather than skipped: a props type this cannot attribute to an
        // addressable component is a `name` nobody has looked at, which is the
        // exact hole the gate exists to close.
        unresolved.push(`${component}Props in ${path.relative(libraryRoot, file)}`);
      }
    }

    // The scan finding nothing would satisfy every check above it.
    expect(declaring.length).toBeGreaterThan(0);
    expect({ unclassified, unresolved }).toEqual({ unclassified: [], unresolved: [] });
  });
});

describe("function children stay in step with the library", () => {
  /** Field names declared directly on an interface, ignoring nested objects. */
  function fieldsOf(source: string, typeName: string): string[] {
    const declaration = new RegExp(`\\b(?:interface|type) ${typeName}\\b`).exec(source);
    if (!declaration) return [];
    const open = source.indexOf("{", declaration.index);
    if (open === -1) return [];
    const fields: string[] = [];
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") {
        depth += 1;
        continue;
      }
      if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) break;
        continue;
      }
      // Depth 1 is the interface body itself; anything deeper is a nested shape
      // whose keys are not arguments — `selected: { value, label }[]` must not
      // contribute `value` and `label`.
      if (depth !== 1) continue;
      const rest = source.slice(i);
      const field = /^\n\s*(\w+)\??:/.exec(rest);
      if (field) fields.push(field[1]);
    }
    return fields;
  }

  it("names every component whose children is a function, and its arguments", () => {
    // A document supplies nodes; these roots CALL what they are given. One
    // gained without an entry here is a component a document kills by using it
    // normally, and a renamed argument is a `$ref` that silently resolves to
    // nothing — so assert the whole table, not merely that its names exist.
    const declared: Record<string, string[]> = {};
    for (const file of globSync("src/components/**/*.tsx", { cwd: libraryRoot })) {
      if (/\.(test|examples)\.tsx$/.test(file)) continue;
      const source = read(path.join(libraryRoot, file));
      const signature = /\bchildren\?:\s*\(\s*\w+:\s*(\w+)\s*\)\s*=>/.exec(source);
      if (!signature) continue;
      // The generator already relies on file basename === component name.
      declared[path.basename(file, ".tsx")] = fieldsOf(source, signature[1]);
    }

    expect(declared).toEqual(
      Object.fromEntries(
        Object.entries(FUNCTION_CHILDREN).map(([name, entry]) => [name, [...entry.args]]),
      ),
    );
  });

  it("tells the reference how often each root calls its children", () => {
    // Curated, because no type records it — and it decides what a document
    // writes: one call over the whole list, or one call per row. Asserted
    // against the shipped doc rather than the table, because reaching the page
    // an agent reads is the claim; having a field is not.
    const doc = read(path.join(root, "VIEWSPEC.md"));
    expect(Object.keys(FUNCTION_CHILDREN).length).toBeGreaterThan(0);
    for (const [name, entry] of Object.entries(FUNCTION_CHILDREN)) {
      expect(entry.note, `${name} has no note`).not.toEqual("");
      expect(doc, `VIEWSPEC.md does not carry ${name}'s note`).toContain(entry.note);
      for (const arg of entry.args) {
        expect(doc, `VIEWSPEC.md does not name ${name}'s "${arg}" argument`).toContain(`\`${arg}\``);
      }
    }
  });
});

describe("text children stay in step with the library", () => {
  it("names every component whose children the library types as a string", () => {
    // The mirror of the function-children gate, and it fails the same way: such
    // a root is handed elements where a string was expected and throws inside
    // the library, so one gained without an entry here is a component a document
    // kills by using it normally.
    const declared: string[] = [];
    for (const file of globSync("src/components/**/*.tsx", { cwd: libraryRoot })) {
      if (/\.(test|examples)\.tsx$/.test(file)) continue;
      if (!/\bchildren\??:\s*string\s*;/.test(read(path.join(libraryRoot, file)))) continue;
      // The generator already relies on file basename === component name.
      declared.push(path.basename(file, ".tsx"));
    }

    expect(declared.sort()).toEqual(Object.keys(TEXT_CHILDREN).sort());
  });

  it("tells the reference how those children combine", () => {
    // Concatenation is a decision, not a type: an author who assumes a newline
    // between entries writes a document that renders one run-on paragraph and
    // has nothing to read that would say why.
    const doc = read(path.join(root, "VIEWSPEC.md"));
    expect(Object.keys(TEXT_CHILDREN).length).toBeGreaterThan(0);
    for (const [name, note] of Object.entries(TEXT_CHILDREN)) {
      expect(note, `${name} has no note`).not.toEqual("");
      expect(doc, `VIEWSPEC.md does not carry ${name}'s note`).toContain(note);
    }
  });
});

describe("VIEWSPEC.md curation", () => {
  const topLevel = listComponentNames(defaultRegistry).filter((name) => !name.includes("."));

  it("categorises every addressable component", () => {
    // The doc is generated from the live barrel; a component with no category
    // would silently vanish from it. This forces the decision instead.
    const uncategorised = topLevel.filter(
      (name) => !Object.hasOwn(COMPONENT_NOTES, name) && !Object.hasOwn(NOT_ADDRESSABLE, name),
    );
    expect(uncategorised).toEqual([]);
  });

  it("lists every categorised component in the generated doc", () => {
    // Categorising a component is not the same as documenting it. `Action` was
    // absent from the generator's order map, so Button, IconButton and
    // CopyButton were bucketed and then dropped — and `--check` still passed,
    // because it compares a fresh generation against itself. Assert the shipped
    // artifact instead, which is what an agent actually reads.
    const doc = read(path.join(root, "VIEWSPEC.md"));
    const documented = new Set([...doc.matchAll(/^\| `([A-Za-z0-9]+)` \|/gm)].map((m) => m[1]));
    const missing = Object.keys(COMPONENT_NOTES).filter((name) => !documented.has(name));
    expect(missing).toEqual([]);
  });

  it("shows the props of every component whose values it enumerates", () => {
    // Being in the doc is not the same as being described in it. The enum pass
    // and the component table read the same declarations, but the table once
    // spelled its own narrower list of props-type names: `ProgressBar` declares
    // `ProgressBarOwnProps`, so its `variant`, `color` and `size` reached
    // prop-enums.json while its Props column read "—". `--check` agreed, and so
    // did every gate above — the row was there, it was simply empty.
    const doc = read(path.join(root, "VIEWSPEC.md"));
    const owners = new Set(
      Object.keys(PROP_ENUMS)
        .filter((key) => key.split(".").length === 2)
        .map((key) => key.split(".")[0]),
    );
    expect(owners.size).toBeGreaterThan(0);
    const undescribed = [...owners].filter((name) => propsCellOf(doc, name) === "—");
    expect(undescribed).toEqual([]);
  });

  it("categorises nothing that does not exist", () => {
    const phantom = Object.keys(COMPONENT_NOTES).filter((name) => !topLevel.includes(name));
    expect(phantom).toEqual([]);
  });

  it("never names one of the design system's example themes", () => {
    // CLAUDE.md: the example themes are examples. Naming one in a reference an
    // agent generates against would make it look like a built-in set.
    const doc = read(path.join(root, "VIEWSPEC.md"));
    for (const example of ["events", "grimdark", "tech"]) {
      expect(doc, `VIEWSPEC.md names the example theme "${example}"`).not.toMatch(
        new RegExp(`["'\`]${example}["'\`]`),
      );
    }
  });
});

describe("the shipped reference renderer produces the shipped reference", () => {
  // `--check` below proves the doc matches a fresh *generation*. It cannot
  // prove the committed `component-docs.json` — the artifact a host actually
  // imports to document its own registry — says the same thing, because the
  // generator would rewrite both sides from the same in-memory derivation.
  // This reads the two committed files and relates them to each other.
  const regions = renderReferenceRegions(defaultReferenceContracts);

  it.each(Object.entries(regions))("renders VIEWSPEC.md's %s region byte for byte", (id, body) => {
    const marker = id.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const doc = read(path.join(root, "VIEWSPEC.md"));
    const found = new RegExp(
      `<!-- GENERATED:${marker} -->\\n([\\s\\S]*?)\\n<!-- /GENERATED:${marker} -->`,
    ).exec(doc);
    expect(found, `VIEWSPEC.md has no GENERATED:${marker} region`).not.toBeNull();
    expect(found?.[1]).toBe(body);
  });

  it("returns the committed document unchanged when nothing is scoped", () => {
    // Read this narrowly. The prose comes from the same file it is compared
    // against, so for the ~24kB outside the regions this is `f(x) === x` and
    // cannot fail — it does NOT check that the prose is correct or complete,
    // and no test here does. What it does establish is that splicing the four
    // regions disturbs nothing around them and that the unscoped call is the
    // committed artifact, which is the baseline a scoped profile differs from.
    // The check that the regions are really rewritten lives in
    // `reference/scope.test.ts`, where a scope makes the output differ.
    expect(renderViewSpecReference()).toBe(read(path.join(root, "VIEWSPEC.md")));
  });

  it("the tables a prompt builder reads are reachable from the package root", () => {
    // Each of these is a fact a document author needs and cannot derive: which
    // props are bounded, which components call their children, which parse them
    // as text, which icon slot wants a component rather than a node, and the
    // curated notes. Every other test imports them by module path, so deleting
    // a line from the barrel changed nothing anywhere — and the barrel is the
    // only spelling a consumer has, since `exports` carries no wildcard.
    expect(Object.keys(rootBarrel)).toEqual(
      expect.arrayContaining([
        "PROP_ENUMS",
        "COMPONENT_NOTES",
        "FUNCTION_CHILDREN",
        "PROP_COERCIONS",
        "TEXT_CHILDREN",
        "COMPONENT_TYPED_ICON_SLOTS",
      ]),
    );
    // Reached through the barrel, not by module path: the same objects the
    // renderer binds, not a second copy a consumer would have to trust.
    expect(rootBarrel.TEXT_CHILDREN).toBe(TEXT_CHILDREN);
    expect(rootBarrel.COMPONENT_TYPED_ICON_SLOTS.has("AppShell.SidebarLink.icon")).toBe(true);
  });

  it("names in the not-addressable table are the ones the corpus excuses", () => {
    // Two committed artifacts related to each other. The shipped renderer does
    // not touch this region — it is curated advice carried with the prose — so
    // without this, editing `not-addressable.json` and forgetting to regenerate
    // leaves the reference telling an author to reach for something the parity
    // gate has already given up on.
    const doc = read(path.join(root, "VIEWSPEC.md"));
    const rows = /<!-- GENERATED:not-addressable -->\n([\s\S]*?)\n<!-- \/GENERATED:not-addressable -->/
      .exec(doc)?.[1]
      .split("\n")
      .slice(2);
    expect(rows).toEqual(
      Object.entries(NOT_ADDRESSABLE)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, reason]) => `| \`${name}\` | ${reason} |`),
    );
  });

  it("documents every component the registry can address", () => {
    // The docs artifact is what a host extends. A component missing from it
    // has no props, no slots and no compound parts in any reference generated
    // downstream, while VIEWSPEC.md itself may still look complete.
    const excused = new Set(Object.keys(NOT_ADDRESSABLE));
    const missing = listComponentNames(defaultRegistry).filter(
      (name) =>
        !Object.hasOwn(defaultReferenceContracts, name) &&
        !excused.has(name) &&
        !excused.has(name.split(".")[0]),
    );
    expect(missing).toEqual([]);
  });
});

describe("VIEWSPEC.md stays in step with the library", () => {
  it("is byte-identical to a fresh generation", () => {
    // Mirrors the library's own verify-docs script: the doc is generated, so a
    // stale one is a lie an agent would author against.
    const result = spawnSync("bun", ["scripts/gen-viewspec-doc.mjs", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.stderr + result.stdout).toContain("up to date");
    expect(result.status).toBe(0);
  });
});

describe("README claims", () => {
  it("reports a typo exactly as the validation section shows it", () => {
    // A message quoted in prose is a claim, and this one is the whole promise
    // of passing a registry — a reader will compare their output against it.
    const readme = read(path.join(root, "README.md"));
    const quoted = /^unknown component "Cadr".*$/m.exec(readme)?.[0];
    expect(quoted, "README no longer shows an unknown-component message").toBeTruthy();

    const result = validateViewSpec(
      { version: 1, title: "t", root: { component: "Cadr" } },
      { registry: defaultRegistry },
    );
    expect(warningsOf(result.issues).map((issue) => issue.message)).toContain(quoted);
  });

  it("states the component counts the registry actually has", () => {
    // A number in prose is a claim; this makes it fail rather than drift.
    const all = listComponentNames(defaultRegistry);
    const top = all.filter((name) => !name.includes("."));
    // Collapsed because the claim is line-wrapped in the source.
    const readme = read(path.join(root, "README.md")).replace(/\s+/g, " ");
    // `Icon` is this package's own addition, not one the library exports.
    expect(readme).toContain(`${top.length - 1} components and ${all.length - top.length} compound`);
    expect(readme).toContain(`${Object.keys(NOT_ADDRESSABLE).length} need host code`);
  });
});
