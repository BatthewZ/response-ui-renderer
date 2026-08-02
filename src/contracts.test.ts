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
import { FUNCTION_CHILDREN } from "./registry/function-children";
import { COMPONENT_TYPED_ICON_OWNERS } from "./registry/icon-slots";
import { PROP_COERCION_OWNERS, PROP_COERCIONS } from "./registry/prop-coercions";
import { defaultRegistry, listComponentNames } from "./registry/registry";
import { TEXT_CHILDREN } from "./registry/text-children";
import { lookupComponent } from "./registry/types";
import { RENDER_DIAGNOSTIC_CLASSES, RENDER_DIAGNOSTIC_SELECTOR } from "./render/diagnostics";
import { DIALOG_COMPONENTS } from "./spec/validate";

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
