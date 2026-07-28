# Changelog

## Unreleased

- **The example themes are no longer presented as a built-in set.** `response-ui-css` defines
  exactly one theme name, `default`, which IS `:root`; `events`, `grimdark` and `tech` moved
  to `@batthewz/response-ui-css/examples/themes/<name>` as opt-in worked examples that no
  entry point imports. This package's docs, the `ThemeMode` docblock that ships into
  `dist/*.d.ts`, and the theming test fixtures all said or implied otherwise. A `theme` name
  now reads as "a theme your app defines" — which is the normal case — and every example uses
  an invented name.
- **The `:root` constraint is unchanged and still the point.** A theme authored
  `:root[data-theme="…"]` matches `<html>` and nothing else, so `themeMode="scoped"` cannot
  apply one; the worked examples, and the theme template most themes start from, are written
  that way. The root-claim stack, the warning when more than one view claims `<html>`, and
  the `--*`-keys-only rule for `themeOverrides` are untouched — only the wording changed.
- **The dev playground opts into the example themes explicitly.** Its theme picker reads
  `EXAMPLE_THEMES` from the components package rather than redeclaring the list, and
  `dev/app.css` now imports each example theme file plus
  `@batthewz/response-ui-react-components/examples/theme-tuning` by hand, because the
  `@batthewz/response-ui-css` entry no longer brings them along. The dev dependency on
  `@batthewz/response-ui-css` moves to `^0.11.0` for the same reason: `examples/themes/*` is
  where those files live from 0.11.0 onward (0.10.1 still exported `./themes/*`). The peer range on
  `@batthewz/response-ui-react-components` is unchanged at `^0.9.0`.

## 0.1.0

Initial release. JSON (ViewSpec) → `@batthewz/response-ui-react-components`.

- **Derived registry.** Every component and compound part the library exports is addressable
  from JSON, read from its barrel at runtime rather than hand-listed — 97 components, 60
  compound parts, no drift by construction.
- **Zero runtime dependencies.** React and response-ui are peers. `zod` is an optional peer
  used only by the `/zod` subpath; `lucide-react` only by `/icons`.
- **Host-agnostic.** Navigation, toasts, network and named data sources arrive through
  `RendererAdapters`. No router import, no server route, no auth model in the wire format.
- **`Icon`.** The library exports none, but its components take `ReactNode` icon props that
  JSON cannot express. Resolved from an injected icon set; the full lucide map is a separate
  entry point.
- **Theming.** `themeOverrides` as inline custom properties (always scoped), plus a
  `themeMode` prop that makes the `:root[data-theme]` scoping constraint explicit instead of
  silently no-op.
- **Hardened for machine-generated input.** Per-node error boundaries, prototype-safe
  registry and `$ref` lookups, forbidden-prop stripping, URL-scheme filtering, node-depth and
  handler-recursion caps, same-origin request gate.
- **Two validators, one contract.** A dependency-free `validateViewSpec` plus an optional Zod
  schema and `viewSpecJsonSchema()` for constraining LLM generation, held in step by a
  cross-check suite.
- **Targets `@batthewz/response-ui-react-components` 0.9.0.** The peer range is `^0.9.0`, up
  from `^0.8.2`; the dev dependencies on the components package and on
  `@batthewz/response-ui-css` move to `^0.9.0` alongside it, so `build`, `typecheck` and
  `test` run against the same pair a consumer installs. Under npm's 0.x caret rule `^0.8.2`
  resolves `>=0.8.2 <0.9.0`, so 0.9.0 does not satisfy the old range — this release does not
  work against components 0.8.x, and that components release carries a breaking change of its
  own (buttons now default to `type="button"`).
