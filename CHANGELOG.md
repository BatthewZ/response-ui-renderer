# Changelog

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
