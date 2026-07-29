# Changelog

## Unreleased

### Component parity

The registry has always derived every name from the library's barrel, so naming a component
was never the problem. Rendering one was: only about thirty of a hundred and sixty-five
addressable names had ever been exercised, and an audit of all 91 of the library's component
pages found several that **crashed or silently died** when a document did the documented thing.

- **`$field` threw a TypeError on nine controls.** The binding assumed a DOM `ChangeEvent`, but
  `Slider`, `RangeSlider`, `NumberInput`, `TagInput`, `SearchInput`, `MultiSelect`, `OTPInput`,
  `ColorPicker` and `DatePicker` re-type `onChange` to `(value) => void` and call it with a bare
  string, number or array. Reading `target` on those threw inside the handler, outside any error
  boundary. Now guarded, and shared with the `event` namespace so both routes agree.
- **`$field` on a `Switch` was silently one-way.** `SwitchProps` declares `onChange?: never` and
  destructures it away; it reports through `onCheckedChange`, which the binding now uses.
- **`Tooltip` never opened.** It injects its handlers by cloning its child, and the renderer
  wrapped every child in a `NodeErrorBoundary`, so the clone landed on the boundary. Nothing
  threw — the tooltip just did nothing. Clone-based parents now render their child without that
  boundary, and `NodeRenderer` forwards whatever was injected onto the real element. Fixes the
  `asChild` triggers of `DropdownMenu`, `Popover` and `HoverCard` at the same time. The forward
  carries through a `$cond`, which resolves to one node and so is still a single element to
  clone; and because the parent computes what to inject from the *renderer's* props rather than
  the document's, an injected `undefined` no longer erases a document value and an injected
  IDREF is appended to `aria-describedby` rather than replacing it.
- **A single child now arrives as one element, not an array of one**, matching JSX. Components
  typed `children: ReactElement` rejected the array and rendered nothing.
- **`Pagination` was completely inert.** It is controlled-only with no `defaultPage`, and
  handlers discarded their arguments, so the page it reported could never reach state.

### Wire-format additions

Made now, before publication, because they are one-way doors afterwards.

- **`event` ref namespace.** Inside a handler payload, `event.value` is the callback's first
  argument (DOM events unwrapped) and `event.args.N` the raw positionals. This is the only way a
  controlled component can report a value back. It resolves to nothing outside a handler and is
  not carried into `onSuccess`/`onError`.
- **`spec.state`** seeds `state.…` refs. Without a seed a controlled component renders empty on
  first paint, so the `event` namespace was only half a feature.
- **`$node`** puts a ViewNode in a prop the library types `ReactNode` — `Wizard.steps[].content`
  (the only thing that blocked `Wizard`), a `DataTable` column's `render` template, `RequireAuth`
  fallbacks. Explicitly marked rather than sniffed for `{ component }`, so a prop can still take
  a literal object.
- **`$ref`, `$node` and complete handler objects now resolve inside array and object props**, so
  `CommandPalette.items[].onSelect` works. A nested handler must be *exactly* handler-shaped —
  data that merely carries an `action` string stays data.

### Props JSON could not express

- ISO `YYYY-MM-DD` strings are parsed to local `Date`s for `Calendar`, `DatePicker`,
  `RangeCalendar` and `DateRangePicker` (local calendar fields, not UTC — the library's own
  inputs emit local dates). An impossible date is left untouched rather than rolled forward.
- `rowKey` accepts a column name as a string. It is **required** and a function, so without this
  neither `DataTable` nor `VirtualizedDataTable` could be instantiated from a document at all.

### Told, not silently dropped

Some things a renderer genuinely cannot do. `validateViewSpec` now warns instead of leaving a
dead node: a `Dialog`/`Drawer`/`CommandPalette` with no literal `id` (nothing can open it), a
`$field` longhand on a `Radio` (whose `value` is the option's own identity), and the five
components that decide something by comparing a child's element type — `Hero`, `AvatarGroup`,
`Table.Body`, `Breadcrumbs` and `Combobox.Content`. That comparison can **never** match through a
renderer, at any depth, so each warning names the explicit prop to set instead. The warnings only
fire when the document is actually relying on the inference.

### Parity is now a contract, not a claim

- A coverage corpus under `src/examples/coverage/` renders every addressable name — 165 of them —
  with zero unknown components and zero render errors, and with the validator raising nothing.
- A test enumerates the live registry and fails on any name that is neither exercised there nor
  listed in `not-addressable.json` **with a reason**. A component added upstream fails the suite
  until someone decides which side it is on.
- Every hand-maintained table (dialogs, child-inspecting parents, prop coercions, icon slots) is
  gated against the installed library's own source.

### VIEWSPEC.md

A terse reference for an agent *authoring* documents — the format, then every component with its
compound parts and props. Names and parts come from the live barrel, prop types from the
library's shipped declarations; only the category and one authoring note per component are
curated. A test fails if the checked-in file differs from a fresh generation, and another fails
if any component lacks a category. Run `bun run docs:viewspec` after upgrading the library.

### Fixed docs

- `AGENTS.md` said to test with `bun test`, which runs Bun's own runner against a vitest suite
  and fails about sixty of them. It is `bun run test`.
- The `ApiBinding` docblock named an `adapters.fetchData` that does not exist; the adapter is
  `adapters.fetch`.
- `test-setup.ts` now stubs `Element.scrollIntoView` and the `<dialog>` methods, which jsdom
  omits. Without them **no test could prove a dialog ever opened**.

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
