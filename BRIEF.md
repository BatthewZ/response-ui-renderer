# BRIEF — @batthewz/response-ui-renderer

## Q1. What exactly?

A new, independently-releasable 4th package in the `@batthewz` family that turns a
**declarative JSON document (ViewSpec) into rendered `@batthewz/response-ui-react-components`**,
honouring the design system's contracts (tokens-only, no CSS-in-JS, headless injection,
`data-theme` theming via `response-ui-css`). Every component the React package exports is
addressable from JSON; theme + `themeOverrides` drive `response-ui-css` custom properties.

**Extracted from** `ui-on-demand/src/web/lib/view-engine/` (1963 LOC), de-coupled from that
app's server, router, and auth.

**NOT in scope (explicit scope edges):**

- NOT touching `ui-on-demand` at all — no migration of its 5 call sites, its
  `src/web/lib/view-engine/` stays exactly as it is. (User chose "standalone sibling repo".)
- NOT the chatbot/AI pipeline — no extractor, repair engine, prompt builder, or DB persistence.
- NOT shipping the `connection` data-binding type. It resolves stored OAuth credentials against
  ui-on-demand's `apiConnection` DB table; it is meaningless to a third party and would bake one
  app's server contract into a public wire format.
- NOT re-implementing any component. The renderer only *maps* to response-ui exports (+ one
  lucide `Icon` resolver, per the user's explicit choice).

### What will the user DO with the result, and how often?

The recurring action: **an LLM (or any producer) emits a ViewSpec JSON blob; a consumer app
mounts `<ViewRenderer spec={json} />` and gets a themed, interactive response-ui page — many
times per session, on every message turn.** In `ui-on-demand` that is every single chat
response, streamed live into a preview panel. The economic outcome is that the design system
becomes addressable by machine-generated content without the consumer writing per-component
glue.

Two acceptance checks are shaped by this:

- **C6** (untrusted input): a producer is an LLM, so the renderer must never crash the host page
  on a malformed/hostile spec — every node degrades in place.
- **C7** (real specimens): the 5 `.viewspec.json` files ui-on-demand actually ships must render.

## Q2. How will I know it works? (staked BEFORE building)

Commands: `bun run typecheck` && `bun test` && `bun run build`, from
`~/coding/@batthewz/response-ui-renderer`.

| ID | Check | Breaks a lazy version because… |
|----|-------|-------------------------------|
| C1 | Every component exported by `response-ui-react-components`'s barrel is reachable from JSON. A test **enumerates the package's live exports at runtime** and asserts the registry covers them. | A hand-copied list drifts. ui-on-demand already has **5 divergent hand-maintained lists** and confirmed drift. The test must read the real barrel, not a fixture. |
| C2 | Declared `subComponents` all exist. A test asserts no registry entry maps to `undefined`. | `registry-entries.ts:288` maps `Table.Caption`, which **does not exist** on the package — renders "Unknown component". |
| C3 | `themeOverrides` produce real CSS custom properties on the rendered subtree, AND scoped `theme` is honest about `:root[data-theme]`. | The package's themes are `:root[data-theme="x"]` (matches `<html>` only). The extracted `ViewThemeScope` sets `data-theme` on a `<div>` → **silently no-ops**. A lazy version ships the div and claims theming works. |
| C4 | Zero runtime dependencies; `zod` is NOT one of them. Asserted by reading built `package.json`. | react-components' AGENTS.md: "do NOT add a validator as a runtime dependency". The source schema is Zod. Copying it violates the sibling package's stated contract. |
| C5 | No raw hex / CSS-in-JS in shipped source. Asserted by a grep test over `src/`. | The extracted code hardcodes `#ef4444`, `#fef2f2`, `#991b1b`, `#fffbeb`, `#f59e0b`, `#92400e` and injects a `<style>` tag with `@keyframes`. ETHOS.md forbids both. |
| C6 | Hostile/degenerate specs never throw: `{}`, `null` root, cyclic-ish deep nesting, unknown component, `$each` over a non-array, `$ref` into `undefined`, duplicate keys, `component: "__proto__"`, prop named `dangerouslySetInnerHTML`. | An LLM produces these. A lazy version only tests the happy path. |
| C7 | All 5 real `examples/*.viewspec.json` from ui-on-demand render to non-empty DOM with **zero** "Unknown component" boxes. | This is the requester's actual data as they really keep it. |
| C8 | `navigate`, `fetch`, and `toast` are injectable; the package imports **neither** `react-router-dom` nor any `/api/*` path. Asserted by a grep test. | Extracted code hardcodes `useNavigate()`, `/api/proxy/…`, `/api/fetch?url=`. |
| C9 | No `eslint-disable` / `@ts-expect-error` / `@ts-ignore` anywhere in `src/`. Asserted by a grep test. | CLAUDE.md rule 4 — "Never suppress, only fix." The extracted registry ships 3 `no-explicit-any` disables. |

**Falsification duty:** every check above must be watched to go RED at least once before I
trust it.

## Q3. What would make this the wrong thing to build?

**Character read.** `~/coding/@batthewz/ETHOS.md` + `CLAUDE.md` govern this package (not
ui-on-demand's AGENTS.md). Character: layered, cherry-pickable packages; *"headless + injection
everywhere"*; *"tokens are the only vocabulary — no escape hatches to chaos"*; *"zero
CSS-in-JS"*; *"single sources of truth, no migrations/adapters"*; *"correctness encoded as
contracts"*; terse comments only where code isn't self-explanatory.

A JSON→React renderer is a legitimate optional top layer that *consumes* react-components — it
fits "pay only for the layer you use". **The ask does not fight the project's character.**

**Biggest misunderstanding risk:** that "extract the render logic" means *copy* it. It does not.
Three parts of the extracted code are actively hostile to a public package, and shipping them
verbatim would be the wrong thing:

1. **The `zod` schema** would break react-components' no-validator-dependency contract → replace
   with a dependency-free validator. (C4)
2. **The app's server/router coupling** (`/api/fetch`, `/api/proxy`, `useNavigate`) would bake
   ui-on-demand's backend into a third party's wire format → injection. (C8)
3. **Inline hex + injected `<style>`** violate the tokens-only / zero-CSS-in-JS ethos. (C5)

**One-way doors named before committing:**

- **The ViewSpec JSON wire format** — third parties will author documents against it. Node
  shapes (`$ref`/`$each`/`$cond`/`$field`), event action names, and binding types are frozen on
  publish.
- **The npm public API** (`ViewRenderer` props, adapter interface, registry type).
- **The package name** `@batthewz/response-ui-renderer`.

**Known collision, carried to the deliverable rather than resolved silently:** the request says
"including theme variables based on response-ui-css". Per-view *scoped* theming cannot work with
the package's built-in themes, because they are authored `:root[data-theme="…"]` — matching
`<html>` only. ui-on-demand's local fork uses a **bare** `[data-theme="…"]`, which is the sole
reason its scoped `<div data-theme>` works today. This is an upstream property of a package the
user owns, so I will not silently pick a winner: ship both modes, make the limitation explicit
in types + docs, and surface the one-line upstream fix as a question.

---

# EVIDENCE (executed, not asserted)

```
bun run typecheck   → tsc --noEmit: PASS · eslint src: PASS
bun test            → 7 files, 267 tests, 267 passed
bun run build       → built in 2.04s (ESM, preserveModules, .d.ts + .d.ts.map + styles.css)
```

| ID | Result | Evidence |
|----|--------|----------|
| C1 | PASS | Registry derived from the live barrel: 97 components + 60 compound parts + `Icon`. Coverage test rewritten after review — it now enumerates the barrel with a **broader** rule than the predicate under test, so a predicate that wrongly drops a component fails it. Falsified: dropping `Button` from the predicate → 3 red. |
| C2 | PASS | No entry resolves to `undefined`; `Table.Caption` correctly absent; `StatCard.Sparkline` picked up for free. Falsified: injecting a phantom `.Caption` → 2 red. |
| C3 | PASS **after 3 bugs found by review** | `themeOverrides` → real inline custom properties. Root-mode rewritten: a themeless view makes no claim; claims are a stack (last-in wins, last-out restores the host); the competition warning is instance-keyed so same-theme collisions warn. Falsified all three independently → 1, 3 and 2 red respectively. |
| C4 | PASS | `dependencies` absent entirely; `zod` optional peer. Traced the **built** graph: `dist/index.js` (16 modules) → only `@batthewz/response-ui-react-components`, `react`, `react/jsx-runtime`. `dist/spec/index.js` → nothing. Falsified: adding a dependency → red. |
| C5 | PASS | No hex, no `rgb()/hsl()`, no `<style>`, no `@keyframes` in JS. Added after review: every `var(--…)` in `styles.css` is cross-checked against `response-ui-css/src`, and a contrast-contract test forbids fill tokens as ink. `.rui-view-loading` moved off `--C-ACCENT` onto `--C-TEXT-SECONDARY`. Falsified: hex + bogus token + fill-as-ink → 3 red. |
| C6 | PASS | 41 hostile documents in the review pass, 0 throws: prototype-named components, `$each` aliases of `__proto__`/`constructor`, 5000-level nesting, cyclic data, malformed props/children, `java\tscript:` URLs. Falsified: removing the prop filter and URL guard → 2 red. |
| C7 | PASS | All 5 `examples/*.viewspec.json` byte-identical (sha256) to ui-on-demand's, rendering with zero `Unknown component` / `Render error`, plus content assertions (`"Contact Us"`, every `team-directory` member name). |
| C8 | PASS | Import-precise checks: no router, no `/api/` literal, no `connectionId`. `source` + `resolveSource` verified as a strict generalisation of the dropped `connection` binding. |
| C9 | PASS | Zero suppressions anywhere in `src/`, tests included. The URL sanitiser was rewritten from a regex to code-point ranges rather than disabling `no-control-regex`. |
| C10 | PASS **after the claim was narrowed** | Review found 7 documents the two validators disagreed on. Fixed the two real gaps (`api.method`/`headers` untyped; `title` bound advisory on one side), then gave issues a `severity` so `ok` means conformance on both sides — and pinned the *deliberate* divergence (open `props` record) as its own test block. The false "cannot drift" claim in `zod.ts` and `AGENTS.md` was rewritten to the real, narrower guarantee. Falsified: drifting the schema → 3 red. |
| RSC | ADDED after review | `"use client"` on the six interactive modules, neutral on barrels and pure modules — matching the sibling's selective policy. Enforced by a test mirroring its `verify-directives` script. Verified surviving the bundle in `dist/`. |

**Scan beyond the diff:** all 7 test files were re-read for checks that cannot fail. Two were
found and fixed — the circular coverage assertion (C1) and `handAccepts` folding
`issues.length === 0` into conformance (C10), which hid the fatal/advisory asymmetry. Two
early form tests were passing vacuously (uncontrolled inputs accept typing regardless of
binding); caught by an `initialValue` assertion and fixed by correcting the `$field` spelling.
