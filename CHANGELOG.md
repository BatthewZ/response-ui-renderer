# Changelog

## Unreleased

### Peer range

- Peer now `@batthewz/response-ui-react-components@^0.14.0`, which adds `Markdown` — see below —
  and a `glyph` slot on `Stepper.Step`.
- Peer bumped to `@batthewz/response-ui-react-components@^0.12.0` (dev dep on
  `@batthewz/response-ui-css@^0.13.0`), which redefines the surface ramp: rung 0 is now the raised
  sheet in every theme and `--C-CANVAS` sits between rungs 1 and 2. Nothing in the renderer paints
  a surface rung, so no ViewSpec or registry change follows — but a document rendered against the
  new versions looks different by design: cards, dialogs and panels are the lightest surface and
  the page behind them is a step darker. `Card`, `StatCard` and `Timeline.Card` are the visible
  cases.

### Tracking react-components 0.12.0

The registry derives every name from the barrel, so the renames arrived addressable on their own;
what did not was everything expressed in JSON, which no compiler reads.

- **Renamed parts.** `Breadcrumbs.Separator` → `.Divider` (still not addressable — the root
  identity-checks it), `DropdownMenu.Label` / `ContextMenu.Label` → `.GroupHeader`. The corpus was
  naming the old menu parts, and because a menu panel is closed on mount those nodes never rendered
  and no diagnostic ever appeared.
- **Deleted props, silently.** `Skeleton`'s `width`/`height` are gone (geometry is `className`,
  both axes), `MasonryGrid`'s `gap` takes a spacing token rather than a CSS length, and
  `MediaCard.Image`'s `<img>`-only attributes moved to `imgProps`. Each of these lands as a DOM
  attribute now and does nothing. Every occurrence in the corpus is fixed.
- **A verbatim specimen was migrated.** `product-landing` carried `"gap": "var(--spacing-r4)"` —
  a real generator reaching for a CSS length — which 0.12.0 made inert. Changed to `"r4"` and
  nothing else. It is the reason for the value-set validation below.
- **Curated notes corrected.** `Skeleton`'s said to size with props and that classes were inert,
  which is now exactly backwards; `Sparkline`'s told you to pass `min: 0` for bars, which the
  library now does itself; `VirtualizedDataTable`'s said it takes no `className`, which it does.

### Children a component calls

- **`children` on `MultiSelect` and `CommandPalette`.** Both type `children` as a function they
  call with their own filtered data, so nodes handed over as nodes were invoked and the component
  died whole. The renderer now renders those nodes inside the call with the arguments bound as
  reference names — `$each` over `selected` and `options`, `$ref` to `item.label` — so `options` /
  `items` stays the single writer of the data and the document becomes the single writer of the
  presentation. Omit `children` and the default tree is untouched. The seven new compound parts are
  addressable rather than excused, and a part addressed with data the root did not hand it renders
  a diagnostic naming the mistake. `contracts.test.ts` fails if the library gains or loses a
  function `children`, or renames one of its arguments.
### Children a component parses

- **`children` on `Markdown`.** 0.14.0 added the first component that types `children` as a
  `string` it parses rather than nodes it places. A document's children arrive as React elements,
  so the parser died on the first `.replace` and took the whole subtree with it — the component was
  addressable in name only. The renderer now resolves those children to text before handing them
  over: `$ref`, `$cond` and `$each` all resolve, concatenated **verbatim** so the document owns its
  own whitespace, and `props.children` remains the spelling for a single fetched source. A composed
  child has no text to contribute and is dropped with a validation warning rather than silently,
  and a root given no source by either spelling is warned about too. `contracts.test.ts` fails if
  the library gains or loses a string `children`, mirroring the function-children gate.

### Values a prop will not accept

- **A value outside a prop's set is a validation warning.** `gap`, `variant`, `size` and 54 others
  are bounded unions upstream; a document that misses gets a component rendered as if the prop were
  unset — no error, no fallback, nothing in the DOM. The sets are generated from the library's
  shipped declarations into `src/spec/prop-enums.json` and into VIEWSPEC.md, so the reference a
  model authors from and the check it is validated against are one artifact. Exported as
  `PROP_ENUMS` / `enumeratedValues` for prompt and schema building. `ok` is unchanged, so the Zod
  mirror still agrees on conformance.
### What the reference now carries

- **Slot keys are in the reference.** 0.12.0 gave 51 components a `classNames` map, and it is the
  override route for everything a `className` cannot reach. The keys are generated per component
  into their own table rather than into the Props column, where the union both truncated mid-list
  and pushed real props out of view.
- **The reference says when a utility will not work.** Tailwind generates utilities by scanning
  source at build time and a document arrives at runtime, so a class a document invents is absent
  from the app's CSS unless something else already used it — a silent failure the docs had never
  mentioned. VIEWSPEC.md and the README now say so, and name the `@source` fix for hosts with a
  stored document store. The dev playground scans the committed documents for exactly this reason.

### Gaps the upgrade exposed

- **Components declared outside a file named after them had no props in the reference.** The
  generator looked declarations up by file basename, so `AvatarGroup`, the four `EmptyState*`
  parts and everything else co-located with a sibling showed an empty Props column. It now
  resolves by type name, and understands the three props-type conventions upstream uses
  (`XProps`, `XOwnProps`, and an unprefixed `PartProps`). `Tooltip`, `ProgressBar`, `Combobox`,
  `DropdownMenu`, `ContextMenu` and `Portal` gain their props — including `Tooltip`'s **required**
  `content`, which the reference had never listed.
- **The corpus gate could not see a diagnostic inside an overlay.** It scanned the container
  `render()` returns; every overlay portals to `document.body`. A dialog, menu or listbox that
  failed to render reported nothing. Both corpus gates now scan from the body.
- **Four excuses in the not-addressable table were double-encoded**, and rendered into
  VIEWSPEC.md as `â` where an em dash belonged.

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

- **Slot keys hidden behind a type alias were silently absent from the reference.** The generator
  matched `classNames?: SlotClassNames<…>` literally, so a component declaring `classNames?: Slots`
  contributed nothing — and `--check` still passed, because it compares a generation against
  itself. `Calendar`, `RangeCalendar` and `Markdown` were missing all of their keys, 41 in total.
  The alias is now resolved at either position.
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
