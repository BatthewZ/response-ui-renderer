# AGENTS — @batthewz/response-ui-renderer

Machine-readable reference for AI assistants **using** this package. Concise, exact, opinionated.

## What this is

The fourth layer of the response-ui system: JSON → rendered `@batthewz/response-ui-react-components`.
`response-ui-css` is the foundation, `response-ui-tw-merge` the merge bridge,
`response-ui-react-components` the React layer, and this makes that layer addressable by a
machine. Optional — nothing below it depends on it.

## Hard requirements

- React 19+. Peers: `@batthewz/response-ui-react-components`, `react`, `react-dom`,
  `@floating-ui/react`, `lucide-react`. **`zod` is an OPTIONAL peer** — only the `/zod`
  subpath touches it.
- **Zero runtime dependencies.** Enforced by `src/contracts.test.ts`. Do not add one.
- Three CSS imports, in order:
  ```css
  @import "@batthewz/response-ui-css";
  @import "@batthewz/response-ui-react-components/styles";
  @import "@batthewz/response-ui-renderer/styles";
  ```
- Tailwind v4 in the consumer's build.

## Public surface

```
ViewRenderer + type ViewRendererProps
NodeRenderer, NodeErrorBoundary, ViewThemeScope + type ThemeMode + DEFAULT_THEME
ViewDataProvider, ViewContextExtender, useViewData + type ViewContext
defaultRegistry, extendRegistry, createRegistryFromModule, lookupComponent,
  isExportedComponent, listComponentNames + types ComponentRegistry / RegistryEntry
Icon, IconSetProvider, useIconSet, lookupIcon, normalizeIconName + types IconSet / IconProps
useFormsState, toFormRefState + type FormState
createEventCallback + type EventHandlerContext, validateField, validateForm
resolveRef, resolveDeep, refToText, EMPTY_REF_CONTEXT + types RefContext / FormRefState
validateViewSpec, isViewSpec, MAX_NODE_DEPTH, FORBIDDEN_PROPS, isDangerousUrl, isUrlProp
ALLOWED_HTTP_METHODS, METHODS_WITH_BODY, normalizeMethod, defaultAllowUrl
type RendererAdapters, ToastOptions, ViewSpec, ViewNode, DataBinding, FormDef, …
```

Subpaths: `/spec` (types + validator, React-free) · `/icons` (`lucideIcons`) · `/zod`
(`viewSpecSchema`, `viewSpecJsonSchema`) · `/styles`.

## Design points an AI should not violate

- **The registry is DERIVED, never listed.** `createRegistryFromModule` reads the library's
  barrel at runtime. Never replace it with a literal map — that is precisely the drift this
  package exists to remove (its predecessor shipped five hand-maintained component lists
  and a `Table.Caption` entry for a component that no longer existed).
- **No host coupling in the wire format.** No router import, no `/api/...` string, no
  `connectionId`. Host behaviour arrives through `RendererAdapters`. Enforced by tests.
- **No CSS-in-JS, no raw hex.** Diagnostics are classes in `src/styles.css` built from
  tokens. Enforced by tests.
- **No suppressions.** No `eslint-disable`, `@ts-expect-error`, `@ts-ignore` anywhere,
  tests included. Enforced by a test. Fix the cause.
- **Two validators, one CONFORMANCE contract.** `validateViewSpec` (zero-dep) and
  `viewSpecSchema` (Zod) must agree on `result.ok`; `src/zod.test.ts` proves it over a
  shared corpus. They deliberately do NOT agree below that: `validateViewSpec` is two-tier
  (`severity: "error" | "warning"`), and the warning tier — forbidden props, dangerous URLs,
  unknown actions inside props, non-token theme overrides, depth overrun, a value outside a
  bounded prop's set — has no Zod counterpart because Zod types `props` as an open record. Do
  not "fix" that by making them errors; it would mean rejecting documents the renderer
  renders fine.
- **Do NOT wrap a document's `className` in `cn()`.** It looks like the design system's
  "always wrap classNames with cn()" rule applies here, but every response-ui component
  already merges its own `className` prop through `cn()` — verified: `Card.tsx`, `Text.tsx`
  et al. all do `className={cn(..., className)}`. Adding a call in the renderer collapses
  nothing extra and cannot be covered by a test that fails, which is worse than nothing.
- **Degrade, never throw.** A bad node renders a diagnostic in place. The renderer's input
  is machine-generated, so malformed input is an expected condition.

## The wire format

Frozen on publish — third parties author against it. Nodes: text · `{component,props,children}`
· `{$ref}` · `{$each,as,node}` · `{$cond,then,else}`. Bindings: `static` · `api` · `source`.
Actions: `submitForm` · `resetForm` · `navigate` · `showToast` · `apiCall` · `openDialog` ·
`closeDialog` · `setState`. Field binding: `props: { $field: "form.field" }`.

Ref precedence: explicit `data.`/`forms.` → `$each` aliases and `state.` → bare data key.

A few roots CALL their `children` rather than placing them (`src/registry/function-children.json`,
gated against the library). Their children are written normally; the renderer renders them
inside the call with the root's own arguments bound as reference names, so a document maps
data the component already owns instead of authoring rows.

## Theming — the one real gotcha

A `theme` name is whatever the host app defines. `response-ui-css` defines only `default`
(which IS `:root`); its `events`/`grimdark`/`tech` themes are opt-in worked examples, not a
built-in set. Themes authored `:root[data-theme="…"]` — the worked examples, and the theme
template most themes start from — match `<html>` only. So:

- `themeMode="root"` (default) writes to `<html>`. Works with a `:root[data-theme]` theme;
  global. A view declaring NO theme makes no claim at all — it must never strip the host's
  theme. Claims are a stack: last mounted wins, releasing falls back to the next claim and
  finally to the host's own value, so overlapping views hand back in the right order.
- `themeMode="scoped"` writes to the view wrapper. Scoped; **a `:root[data-theme]` theme
  will not apply** — only themes authored with a bare `[data-theme="…"]` selector.
- `themeOverrides` are inline custom properties and always work, always scoped. Prefer them
  for per-view theming.

Do not "fix" scoped mode by duplicating theme values into this package.

## Icons

response-ui exports no `Icon`. This package adds one, resolved from an injected `icons` map
(`<ViewRenderer icons={…} />`). The full lucide set lives at `/icons` so the core stays free
of ~1600 modules — do not import `lucide-react` anywhere else.

Most icon slots are typed `ReactNode` and receive an element. `AppShell.SidebarLink.icon` is
typed `LucideIcon` and is invoked as a component — `src/registry/icon-slots.ts` lists those,
and a test asserts every entry still exists upstream.

## Don'ts

- Don't add a runtime dependency, including a validator.
- Don't import `zod` or `lucide-react` outside `src/zod.ts` / `src/icons.ts`.
- Don't hand-list components, or reintroduce per-component prop metadata that nothing reads.
  Metadata *generated* from the library and consumed by a check is fine — `prop-enums.json`
  is regenerated beside the reference and drives a validator warning. A hand-kept table
  restating the library is what this forbids.
- Don't import a router, or hardcode a server route.
- Don't write CSS-in-JS, raw hex, or Tailwind defaults (`p-4`, `text-sm`, `bg-blue-500`).
- Don't suppress a lint or type error.
- Don't make the renderer require a `ToastProvider` — `toast` is injected for that reason.

## Testing

`bun run test` (vitest, jsdom) — **not** `bun test`, which runs Bun's own runner against a
vitest suite and fails ~60 of them. jsdom lacks `matchMedia`, `ResizeObserver`,
`Element.scrollIntoView` and every `<dialog>` method, all of which response-ui uses;
`test-setup.ts` stubs them — without them any component honouring reduced motion
throws on mount and the error boundaries mask it as a render failure.

The corpus in `src/examples/` is real generator output, kept verbatim. Prefer adding to it
over inventing fixtures: synthetic ones drift towards what the renderer already handles.
