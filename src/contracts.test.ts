import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { globSync } from "glob";
import { describe, expect, it } from "vitest";

import { NOT_ADDRESSABLE } from "./examples/not-addressable";
import {
  CHILD_INSPECTING_MODULES,
  CHILD_INSPECTING_PARENTS,
  IDENTITY_CHECKED_PARENTS,
} from "./registry/child-introspection";
import { COMPONENT_NOTES } from "./registry/component-notes";
import { COMPONENT_TYPED_ICON_OWNERS } from "./registry/icon-slots";
import { PROP_COERCION_OWNERS, PROP_COERCIONS } from "./registry/prop-coercions";
import { defaultRegistry, listComponentNames } from "./registry/registry";
import { lookupComponent } from "./registry/types";
import { DIALOG_COMPONENTS } from "./spec/validate";

/**
 * Contracts this package commits to, enforced rather than documented.
 *
 * Each maps to a constraint the design system states about itself. Prose in a
 * README cannot fail; these can.
 */

const root = path.resolve(import.meta.dirname, "..");
const sourceFiles = globSync("src/**/*.{ts,tsx}", { cwd: root, absolute: true });
const shippedFiles = sourceFiles.filter((file) => !/\.test\.tsx?$/.test(file));

const read = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => path.relative(root, file);

/** Module specifiers only — prose in a comment is not a dependency. */
function importedModules(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

describe("dependency contract", () => {
  const pkg = JSON.parse(read(path.join(root, "package.json"))) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };

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

  it("styles diagnostics with design tokens only", () => {
    const css = read(path.join(root, "src/styles.css"));
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(css).toMatch(/var\(--C-STATUS-ERROR\)/);
    expect(css).toMatch(/var\(--R-SIZE-/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it("honours the contrast contract: no fill token as ink on a surface", () => {
    // response-ui-css AGENTS.md, Don'ts: "No fill token (--C-PRIMARY /
    // --C-ACCENT / status bg-*) as ink on a surface — it's only guaranteed to
    // contrast its own on-* text, not the surface."
    // Status *-BG pairs are the blessed exception: --C-STATUS-X on
    // --C-STATUS-X-BG is the documented tint pattern.
    const css = read(path.join(root, "src/styles.css"));
    for (const fill of ["--C-PRIMARY", "--C-ACCENT", "--C-SECONDARY"]) {
      expect(css, `${fill} used as ink`).not.toContain(`var(${fill})`);
    }
  });

  it("uses only tokens that response-ui-css actually defines", () => {
    // A typo'd custom property fails silently at runtime — the declaration is
    // simply dropped. Cross-check every token against the foundation package.
    const cssRoot = path.join(root, "node_modules/@batthewz/response-ui-css/src");
    const foundation = globSync("**/*.css", { cwd: cssRoot, absolute: true })
      .map(read)
      .join("\n");

    const used = new Set(
      [...read(path.join(root, "src/styles.css")).matchAll(/var\((--[A-Za-z0-9-]+)/g)].map(
        (m) => m[1],
      ),
    );
    expect(used.size).toBeGreaterThan(10);

    const undefined_ = [...used].filter((token) => !foundation.includes(`${token}:`));
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
    const offenders = sourceFiles
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
  // The library publishes its own `src` (its `files` includes it), so these
  // gates read the real upstream source rather than a copy that could drift.
  // Resolved by path because its `exports` map deliberately hides package.json.
  const libraryRoot = path.join(root, "node_modules/@batthewz/response-ui-react-components");

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

describe("VIEWSPEC.md stays in step with the library", () => {
  it("is byte-identical to a fresh generation", () => {
    // Mirrors the library's own verify-docs script: the doc is generated, so a
    // stale one is a lie an agent would author against.
    const result = spawnSync("node", ["scripts/gen-viewspec-doc.mjs", "--check"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(result.stderr + result.stdout).toContain("up to date");
    expect(result.status).toBe(0);
  });
});

describe("README claims", () => {
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
