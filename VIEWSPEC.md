# ViewSpec Agent Reference

Version: 1. Output format: JSON. Rendered by `@batthewz/response-ui-renderer`.

Component names, compound parts and prop types below are **generated from the live library** — run `bun run docs:viewspec` after upgrading it. Prose is hand-written.

## Root Schema

```jsonc
{
  "version": 1,                    // REQUIRED. Always 1.
  "title": string,                 // REQUIRED. 1–200 chars.
  "description"?: string,
  "theme"?: string,                // A theme YOUR APP defines. See Theming.
  "themeOverrides"?: { "--C-PRIMARY": "oklch(0.6 0.15 220)" },
  "data"?: Record<string, DataBinding>,
  "forms"?: Record<string, FormDef>,
  "state"?: Record<string, unknown>,   // Seeds `state.…` refs.
  "root": ViewNode                 // REQUIRED.
}
```

## ViewNode Types

A ViewNode is one of 5 things.

| # | Shape | Renders |
| --- | --- | --- |
| 1 | `"Hello"` | text |
| 2 | `{ "component": "Card", "props": {…}, "children": [ViewNode…] }` | a component |
| 3 | `{ "$ref": "data.user.name" }` | the resolved value as text |
| 4 | `{ "$each": "data.rows", "as": "row", "node": ViewNode }` | `node` once per element |
| 5 | `{ "$cond": "data.flag", "then": ViewNode, "else"?: ViewNode }` | one branch, by JS truthiness |

`component` accepts compound parts by dot path: `"Table.Row"`, `"Tabs.Panel"`. An unknown name renders an inline warning; the rest of the view is unaffected.

`$each` exposes `<as>` and `<as>Index` inside `node`, and nests.

## Reference Paths

Resolved highest-precedence first:

1. `data.…` and `forms.…` — explicit namespaces
2. `$each` aliases, `state.…`, and `event.…` (inside a handler only)
3. bare data keys — `users.0.name` means `data.users[0].name`

Form values are `forms.<name>.values.<field>`; `forms.<name>.<field>` is accepted shorthand, and `forms.<name>.errors.<field>` reads the live error. A missing path resolves to nothing rather than throwing, and prototype members never resolve.

## Prop Value Types

Inside `props`, a value is a literal or one of:

```jsonc
{ "$ref": "data.user.name" }                              // resolved value
{ "action": "showToast", "payload": { "message": "Hi" } } // event callback
{ "$field": "contact.email" }                             // two-way form binding
{ "$node": { "component": "Badge", "children": ["New"] } }  // a ViewNode in a prop
```

- **`$field`** is a **bare prop key** — `props: { "$field": "contact.email" }` — which wires `value`/`checked` **and** the change handler from one declaration. The longhand `{ "value": { "$field": … } }` also works, except on `Radio`, whose `value` is the option's own identity.
- **`$node`** fills a prop the library types `ReactNode` (`Wizard.steps[].content`, `DataTable` column `render`, `RequireAuth` fallbacks).
- **`$ref`**, **`$node`** and complete `{ "action", "payload" }` objects are also resolved **inside array and object props** — that is how `CommandPalette.items[].onSelect` works. Ordinary data is left alone: a row carrying an `action` string stays a row.
- A **string on an icon-shaped prop** (`icon`, `statusIcon`, `leftIcon`, …) becomes an icon. This applies at the top level only; nested icon slots use `$node`.
- A prop whose type is a **fixed set of strings** takes one of them exactly. The set is in the Props column below; `validateViewSpec` warns on anything else, because the component looks up the value in a table and a miss draws nothing at all rather than failing.

## Styling

Two props, and the difference matters:

- **`className`** styles the element the component renders **itself** — its outermost one.
- **`classNames`** styles the elements it renders **inside** itself, keyed by slot: `{ "classNames": { "control": "border-dashed" } }`. Keys are per component and listed under Slot keys; an unknown key does nothing.

Both beat the component's own classes, so `"className": "flex-row bg-surface-2"` works on anything. Prefer a real prop where one exists (`variant`, `size`, `gap`) — it is the part of the contract this reference can describe.

⚠️ **A utility class only works if it is already in the app's compiled CSS.** Tailwind generates utilities by scanning source files at build time, and a document arrives at runtime — long after. Common utilities the library itself uses are present; an arbitrary one (`w-[37%]`, `text-[13px]`) usually is not, and it fails **silently**. Stay near the scale (`gap-r4`, `p-r3`, `w-full`, `text-body-2`) — the Utility columns of the token tables under Theming are the vocabulary to draw from — or ask the host to add its document store to Tailwind's `@source` list.

<!-- GENERATED:slots -->
| Component | `classNames` keys |
| --- | --- |
| `Accordion.Content` | `body` |
| `Accordion.Trigger` | `heading` `triggerText` `chevron` |
| `ActivityFeed.Item` | `sentence` `actor` `action` `target` `timestamp` `body` |
| `Alert` | `icon` |
| `AppShell.Sidebar` | `scrim` |
| `AppShell.SidebarLink` | `itemIcon` `itemLabel` |
| `AppShell.SidebarSection` | `groupHeader` |
| `Avatar` | `frame` `image` `status` |
| `AvatarGroup` | `itemRing` `overflow` |
| `Breadcrumbs` | `list` `ellipsis` |
| `Breadcrumbs.Item` | `current` `link` `text` |
| `Calendar` | `header` `labelButton` `months` `footer` `todayButton` `pickerGrid` `pickerCell` `month` `caption` `grid` `weekdays` `weekday` `row` `cell` `day` |
| `Carousel` | `title` `viewport` `prev` `next` |
| `CodeBlock` | `header` `filename` `language` `pre` `code` `line` |
| `ColorPicker` | `trigger` `swatch` `value` `panel` `plane` `thumb` `hue` `hex` `presets` `preset` |
| `Combobox.Content` | `loading` |
| `Combobox.Input` | `toggle` |
| `CommandPalette` | `search` `input` `list` `group` `groupHeader` `empty` `itemIcon` `itemLabel` `itemShortcut` |
| `DataTable` | `expandToggle` `expandedCell` `expandedBody` |
| `DatePicker` | `control` `actions` `panel` |
| `DateRangePicker` | `control` `panel` |
| `Hero` | `overlay` |
| `HoverCard.Content` | `arrow` |
| `Markdown` | `heading` `paragraph` `list` `listItem` `blockquote` `code` `codeBlock` `link` `image` `table` `hr` |
| `MultiSelect` | `control` `list` `input` `chevron` |
| `NumberInput` | `control` `chevron` |
| `OTPInput` | `box` |
| `Pagination` | `list` `first` `prev` `next` `last` `page` `ellipsis` `info` |
| `Popover.Content` | `arrow` |
| `ProgressBar` | `fill` |
| `ProgressRing` | `svg` `track` `indicator` `center` |
| `RangeCalendar` | `header` `labelButton` `months` `footer` `todayButton` `pickerGrid` `pickerCell` `month` `caption` `grid` `weekdays` `weekday` `row` `cell` `day` |
| `RangeSlider` | `track` `fill` `input` |
| `SearchInput` | `icon` `input` `clear` |
| `Select` | `control` `chevron` |
| `StatCard.Trend` | `trendIcon` |
| `Stepper.Step` | `indicator` `glyph` `itemBody` `title` `description` `connector` |
| `Swimlane` | `header` `titleGroup` `title` `description` `body` |
| `Switch` | `thumb` |
| `Table.HeaderCell` | `sortButton` `sortIcon` |
| `Tabs.List` | `indicator` |
| `TagInput` | `control` `input` `tagRemove` |
| `ThemeSwitcher` | `item` |
| `Timeline.Item` | `icon` `card` `timestamp` `title` `body` |
| `Toast` | `icon` `body` `title` `dismiss` |
| `Tooltip` | `arrow` |
| `Wizard` | `body` `footer` |
<!-- /GENERATED:slots -->

## Children a component calls

Most components place the `children` a document gives them. These two **call** theirs, once per thing they are composing, and hand it their own already-filtered data — so a document maps what it is given rather than authoring rows itself. Write `children` exactly as anywhere else; the names below are in scope inside them, alongside everything already visible.

<!-- GENERATED:function-children -->
| Component | Called | In scope inside `children` |
| --- | --- | --- |
| `MultiSelect` | Called **once**, with the root's filtered list and its resolved selection: `$each` over `selected` for the chips, over `options` for the rows. | `options` · `selected` |
| `CommandPalette` | Called **once per row** of the root's filtered, grouped list. Return one `CommandPalette.Item` — it carries the row's id, role and select handler. | `item` · `index` · `active` |
<!-- /GENERATED:function-children -->

```jsonc
{ "component": "MultiSelect",
  "props": { "options": { "$ref": "data.tools" }, "$field": "profile.tools" },
  "children": [
    { "$each": "selected", "as": "chip",
      "node": { "component": "MultiSelect.Tag",
                "props": { "index": { "$ref": "chipIndex" } },
                "children": [{ "$ref": "chip.label" }, { "component": "MultiSelect.TagRemove" }] } },
    { "component": "MultiSelect.Content",
      "children": [
        { "$cond": "options.0",
          "then": { "$each": "options", "as": "tool",
                    "node": { "component": "MultiSelect.Item",
                              "props": { "option": { "$ref": "tool" } },
                              "children": [{ "component": "MultiSelect.ItemIndicator" },
                                           { "$ref": "tool.label" }] } },
          "else": { "component": "MultiSelect.Empty", "children": ["No match."] } }
      ] }
  ] }
```

Omit `children` and the component renders its own default tree, which is the same composition — so there is nothing to keep in step. A part addressed with data the root did not hand it (an invented `option`, an `index` outside the selection) renders a diagnostic naming the mistake.

## Children a component parses

These roots take `children` as **source text**, not as nodes. Give them strings — or anything that resolves to one — and the component does the composing.

<!-- GENERATED:text-children -->
| Component | `children` is |
| --- | --- |
| `Markdown` | Concatenated **verbatim**, so the document owns its own whitespace — write one string with real `\n\n` between blocks rather than one child per line. `$ref`, `$cond` and `$each` resolve to their text; a component child has no text to contribute and is dropped. |
<!-- /GENERATED:text-children -->

```jsonc
{ "component": "Markdown",
  "children": ["## ", { "$ref": "data.report.title" }, "\n\nShipped **", { "$ref": "data.report.count" }, "** changes.\n\n- one\n- two\n"] }
```

One string is the normal case; the array exists so a value can be interpolated into it. `props.children` is the other spelling and takes a `$ref` of its own — `{ "props": { "children": { "$ref": "data.article" } } }` — which is what a document should use when the whole source is a single fetched value.

## Event Actions

`{ "action": "name", "payload": { … } }`. Payloads are `$ref`-resolved before dispatch, except for four keys read literally so that fetched data cannot decide what the app does: `setState.key` (state shape would depend on data), `apiCall.endpoint` (where a request goes), and `apiCall.onSuccess` / `apiCall.onError` (what runs next). Handler chains stop at depth 5.

| Action | Payload | Effect |
| --- | --- | --- |
| `showToast` | `message`, `variant`?, `title`? | notification via the host's toast adapter |
| `navigate` | `path` | host's navigate adapter |
| `submitForm` | `form` | validate, then run the form's `onSubmit` |
| `resetForm` | `form` | back to `initialValue`, errors cleared |
| `apiCall` | `endpoint`, `method`?, `body`?, `onSuccess`?, `onError`? | request via the host's fetch adapter |
| `openDialog` / `closeDialog` | `dialogId` | matches a `Dialog`/`Drawer`/`CommandPalette` `id` |
| `setState` | `key`, `value` | writes runtime state, read back via `state.…` |

### Reading the value a component reports

Inside a handler payload, `event` names the callback's arguments:

- `event.value` — the first argument, with DOM events unwrapped to their value
- `event.args.0`, `event.args.1`, … — raw positionals

This is the only way to get a controlled component's new value back:

```jsonc
{ "component": "Pagination",
  "props": {
    "page": { "$ref": "state.page" },
    "totalPages": 9,
    "aria-label": "Results",
    "onPageChange": { "action": "setState",
                      "payload": { "key": "page", "value": { "$ref": "event.value" } } } } }
```

with `"state": { "page": 1 }` at the root. `event` resolves to nothing outside a handler, and is not carried into `onSuccess`/`onError`.

Prefer an uncontrolled seed (`defaultValue`, `defaultOpen`, `defaultChecked`) when the component has one — it needs no state at all.

## Data Bindings

```jsonc
{ "type": "static", "value": … }                       // inlined
{ "type": "api", "endpoint": "/x", "method"?, "headers"?, "body"? }   // fetched on mount
{ "type": "source", "source": "crm", "params"? }       // delegated to the host
```

URLs are **not** rewritten, and only relative or same-origin ones are requested unless the host says otherwise. `source` is the escape hatch for host-specific access, so no server contract lives in the wire format.

## Forms

```jsonc
"forms": {
  "contact": {
    "fields": {
      "email": { "initialValue": "", "validation": { "required": true, "minLength": 3 } }
    },
    "onSubmit": { "action": "showToast", "payload": { "message": "Sent" } }
  }
}
```

Rules: `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `message`. `min`/`max` apply to numeric **strings** too. `submitForm` validates before running `onSubmit`. `Field` and `FieldError` accept `"name": "contact.email"` to surface the live error.

## Components

<!-- GENERATED:components -->
### Layout

Structure and spacing. The `r1`–`r6` scale is **inverted** — `r1` is the largest step.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Card` | — | `padding?`: "r1"\|"r2"\|"r3"\|"r4"\|"r5"\|"r6" · `shadow?`: "sm"\|"md"\|"lg" |  |
| `Center` | — | — |  |
| `Container` | — | `size?`: "sm"\|"md"\|"lg"\|"xl"\|"full" | Always a `<div>` — use `Stack as="section"` when you need the landmark. |
| `Divider` | — | `orientation?`: "horizontal"\|"vertical" | A vertical divider renders nothing outside a flex/grid parent with a cross-axis height. |
| `Grid` | — | `columns?`: ColumnBreakpoints<GridColumnCount>\|GridColumnCount · `gap?`: "r1"\|"r2"\|"r3"\|"r4"\|"r5"\|"r6" · `as?`: T | 1–6 columns only; anything else silently falls back to one. |
| `Hero` | `.Background` `.Content` | `size?`: "sm"\|"md"\|"lg"\|"full" · `overlay?`: boolean · `align?`: "start"\|"center"\|"end" | `Hero.Background` takes no children. Put anything that must stay legible in `Hero.Content`. |
| `MasonryGrid` | `.Item` | `columns?`: ColumnBreakpoints<ColumnCount>\|ColumnCount · `gap?`: "r1"\|"r2"\|"r3"\|"r4"\|"r5"\|"r6" · `animate?`: boolean · `animation?`: "fade-up"\|"fade-in"\|"fade-left"\|"fade-right"\|"scale" | Pass `animate: false` unless a viewport observer will run — items start at `opacity: 0`. |
| `Portal` | — | `container?`: Element\|null | Renders to `document.body`. `themeOverrides` scoped to the view do not reach it. |
| `Row` | — | `gap?`: "r1"\|"r2"\|"r3"\|"r4"\|"r5"\|"r6" · `align?`: keyof typeof alignMap · `justify?`: keyof typeof justifyMap · `wrap?`: boolean · `as?`: T | `align` defaults to `center`, not `stretch`. |
| `Spacer` | — | — |  |
| `Stack` | — | `gap?`: "r1"\|"r2"\|"r3"\|"r4"\|"r5"\|"r6" · `as?`: T | `as` is a document's only route to a raw HTML tag (`"section"`, `"ul"`, `"form"`). |
| `Swimlane` | — | `title`: ReactNode · `titleAs?`: "h1"\|"h2"\|"h3"\|"h4"\|"h5"\|"h6" · `subtitle?`: ReactNode · `viewAllHref?`: string · `viewAllLabel?`: ReactNode · `viewAllProps?`: Omit<ComponentPropsWithRef<"a">, "href"\|"children"> · `animation?`: "fade-up"\|"fade-in"\|"fade-left"\|"fade-right"\|"scale" · +2 more | Requires `title`. It does **not** scroll despite the name; nest a `Carousel` or an overflow `Row`. |

### Typography

Text and inline marks.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Badge` | — | `variant?`: "default"\|"success"\|"warning"\|"error"\|"info" · `statusLabel?`: string · `statusIcon?`: ReactNode | `statusIcon` accepts an icon-name string. A `<span>` — never make it clickable. |
| `CodeBlock` | — | `code`: string · `language?`: string · `filename?`: string · `showLineNumbers?`: boolean · `copyable?`: boolean · `copyButtonProps?`: Omit<ComponentPropsWithRef<typeof CopyButton>, "value"> | Takes a `code` string and no children. No syntax highlighting. |
| `Icon` | — | — | Added by this package, not the library. `name` is resolved from the injected icon set. |
| `Kbd` | — | — |  |
| `Markdown` | — | `codeBlockProps?`: Omit<ComponentPropsWithRef<typeof CodeBlock>, "code"\|"language"> | `children` is source **text**, concatenated verbatim — not nodes. Fenced blocks become `CodeBlock`s and pipe tables become `Table`s, so reach for it instead of hand-composing prose. |
| `Text` | — | `variant?`: "h1"\|"h2"\|"h3"\|"h4"\|"h5"\|"h6"\|"body-1"\|"body-2"\|"body-3" · `weight?`: "semibold"\|"bold" · `color?`: "primary"\|"secondary"\|"muted"\|"inverse"\|"on-primary" · `as?`: T | A heading `variant` emits a real heading element — pass `as: "p"` for heading-sized body text. |

### Action

Buttons and triggers. `Button` defaults to `type: "button"` — a submit control must say so explicitly.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Button` | — | `variant?`: "primary"\|"secondary"\|"ghost"\|"ghost-inverse"\|"danger"\|"link" · `size?`: "sm"\|"md"\|"lg" · `as?`: T | Defaults to `type="button"` — a submit button must say so explicitly. |
| `CopyButton` | — | `value`: string · `timeout?`: number · `copiedLabel?`: string · `onCopyError?`: (error: Error) => void | Requires `value`. Silently no-ops outside a secure context. |
| `IconButton` | — | — | Requires `aria-label`. The glyph is a **child** `Icon` node, not an `icon` prop. |

### Feedback

Status, progress and loading.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Alert` | — | `variant?`: "success"\|"warning"\|"error"\|"info" · `statusLabel?`: string · `statusIcon?`: ReactNode | `statusIcon` accepts an icon-name string; `statusIcon: null` drops the glyph. |
| `EmptyState` | — | `size?`: "sm"\|"md"\|"lg" | Its four parts are flat exports (`EmptyStateIcon`, **not** `EmptyState.Icon`) but must nest inside this root. |
| `EmptyStateActions` | — | — |  |
| `EmptyStateDescription` | — | — |  |
| `EmptyStateIcon` | — | — |  |
| `EmptyStateTitle` | — | `as?`: T |  |
| `Meter` | — | `value`: number · `min?`: number · `max?`: number · `segments?`: number · `warningAt?`: number · `criticalAt?`: number · `statusLabels?`: Partial<Record<MeterStatus, string>> · +1 more | Requires `value` and `aria-label`. Thresholds compare the raw value, not a fraction. |
| `ProgressBar` | `.Label` `.Value` | — | Takes no children: `.Label` and `.Value` are **siblings** of the bar. Needs `value` and a name. |
| `ProgressRing` | — | `value`: number · `max?`: number · `size?`: number · `thickness?`: number · `color?`: "accent"\|"success"\|"warning"\|"error" | No default accessible name — pass `aria-label`. The centre slot is decorative. |
| `Skeleton` | — | `variant?`: "text"\|"circular"\|"rectangular"\|"rounded" | Sized by `className` on both axes (`w-[40%] h-3`); it has no `width`/`height` props. A `circular` one needs one axis only. |
| `Spinner` | — | `size?`: "sm"\|"md"\|"lg" |  |
| `Toast` | — | `variant?`: "success"\|"warning"\|"error"\|"info" · `title?`: string · `dismissing?`: boolean · `statusLabel?`: string · `statusIcon?`: ReactNode · `dismissLabel?`: string | Prefer the `showToast` action. Rendered by hand it needs `onDismiss` and its own `$cond` to unmount. |

### Data

Tables, metrics and lists driven by `data` + `$each`.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `ActivityFeed` | `.Item` | — | `.Item` must be a direct child. `avatar` short-circuits `icon`. |
| `Avatar` | — | `src?`: string\|null · `alt?`: string · `name?`: string · `size?`: "xs"\|"sm"\|"md"\|"lg"\|"xl" · `status?`: "online"\|"offline"\|"away" · `statusLabel?`: string | Falls back to initials from `name`. `AvatarGroup`'s `size` does not reach children through the renderer — set it per avatar. |
| `AvatarGroup` | — | `max?`: number · `size?`: "xs"\|"sm"\|"md"\|"lg"\|"xl" |  |
| `DataTable` | — | `data`: T[] · `columns`: ColumnDef<T>[] · `sort?`: SortState\|null · `defaultSort?`: SortState\|null · `onSortChange?`: (sort: SortState\|null) => void · `sortComparator?`: (a: T, b: T, columnKey: string, direction: "asc"\|"desc") => number · `selectable?`: boolean · +21 more | `rowKey` is required: pass the **column name as a string**. A column may carry a `render` cell template as `{"$node": …}`, bound to `row`/`rowIndex`. |
| `DescriptionList` | `.Term` `.Detail` | `layout?`: "horizontal"\|"vertical" |  |
| `Pagination` | — | `page`: number · `totalPages`: number · `siblingCount?`: number · `showEdges?`: boolean · `variant?`: "full"\|"compact" · `compactBelow?`: number\|string | Controlled-only — no `defaultPage`. Seed `spec.state` and feed `onPageChange` from `event.value`. |
| `Rating` | — | `value?`: number · `defaultValue?`: number · `onValueChange?`: (v: number) => void · `max?`: number · `allowHalf?`: boolean · `readOnly?`: boolean · `disabled?`: boolean · +2 more | Requires `aria-label`. Not a form control; `readOnly` is the JSON-native shape. |
| `Sparkline` | — | `values`: number[] · `variant?`: "line"\|"area"\|"bar" · `width?`: number · `height?`: number · `strokeWidth?`: number · `min?`: number · `max?`: number | Requires `values`. `bar` measures from zero already; `line`/`area` frame to the data, so pass `min`/`max` to fix the scale. |
| `StatCard` | `.Value` `.Label` `.Trend` `.Icon` `.Sparkline` | — | `.Trend` needs `value` and `direction` and takes no children. `.Sparkline` needs `values`. |
| `Table` | `.Head` `.Body` `.Row` `.HeaderCell` `.Cell` | `density?`: "dense"\|"comfortable"\|"spacious" · `striped?`: boolean · `stickyHeader?`: boolean · `maxHeight?`: number\|string · `tableProps?`: ComponentPropsWithRef<"table"> | Presentational only — it sorts nothing. Rest props land on a wrapper; name it via `tableProps`. |
| `Timeline` | `.Item` | `animate?`: boolean · `align?`: "left"\|"center"\|"right" · `density?`: "dense"\|"comfortable"\|"spacious" · `card?`: boolean | `.Item` requires `title`. Pass `animate: false` — every item otherwise builds its own observer. |
| `VirtualizedDataTable` | — | `data`: T[] · `columns`: ColumnDef<T>[] · `rowHeight`: number · `sort?`: SortState\|null · `defaultSort?`: SortState\|null · `onSortChange?`: (sort: SortState\|null) => void · `sortComparator?`: (a: T, b: T, columnKey: string, direction: "asc"\|"desc") => number · +15 more | As `DataTable`, plus a numeric `rowHeight` and `height`. |

### Form

Bind every control with `$field`; declare the field in `spec.forms` first.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Calendar` | — | `value?`: Date\|null · `defaultValue?`: Date · `onValueChange?`: (d: Date) => void · `month?`: Date · `defaultMonth?`: Date · `onMonthChange?`: (m: Date) => void · `numberOfMonths?`: number · +10 more | Date props accept ISO `YYYY-MM-DD` strings. `isDateDisabled` and `renderDay` are functions and unreachable. |
| `Checkbox` | — | `error?`: boolean | `$field` binds `checked`. |
| `ColorPicker` | — | `value?`: string · `defaultValue?`: string · `onValueChange?`: (hex: string) => void · `onChange?`: (hex: string) => void · `presets?`: string[] · `placement?`: Placement · `error?`: boolean · +7 more | Hex only; anything else silently becomes `#000000`. Submits nothing. |
| `Combobox` | `.Input` `.Content` `.Item` `.Empty` | `value?`: string\|null · `defaultValue?`: string · `onValueChange?`: (value: string\|null) => void · `inputValue?`: string · `defaultInputValue?`: string · `onInputValueChange?`: (value: string) => void · `open?`: boolean · +4 more | Owns no data: every `.Item` needs a gapless `index` and a `value`. Filtering is the author's job. |
| `DatePicker` | — | `value?`: Date\|null · `defaultValue?`: Date · `onValueChange?`: (d: Date\|null) => void · `onChange?`: (d: Date\|null) => void · `min?`: Date · `max?`: Date · `isDateDisabled?`: (date: Date) => boolean · +12 more | ISO date strings on `value`/`defaultValue`/`min`/`max`. Pass `name` or nothing is submitted. |
| `DateRangePicker` | — | `value?`: DateRange · `defaultValue?`: DateRange · `onValueChange?`: (range: DateRange) => void · `onChange?`: (range: DateRange) => void · `defaultMonth?`: Date · `min?`: Date · `max?`: Date · +15 more | `value`/`defaultValue` are `{ start, end }` of ISO strings. Rest props land on the wrapper. |
| `Field` | — | `name?`: string · `error?`: ReactNode | `name: "form.field"` surfaces the live error. It does **not** wire `Label`/control ids — do that yourself. |
| `FieldError` | — | — | `name: "form.field"`. Renders nothing when there is no error, so it is safe to always include. |
| `FormActions` | — | — |  |
| `Input` | — | `error?`: boolean | The first-class `$field` target. |
| `Label` | — | — | No automatic association — pair `htmlFor` with the control's `id`. |
| `MultiSelect` | `.Content` `.Item` `.ItemIndicator` `.Empty` `.Tag` `.TagRemove` | `options`: MultiSelectItem[] · `value?`: string[] · `defaultValue?`: string[] · `onValueChange?`: (value: string[]) => void · `onChange?`: (value: string[]) => void · `placeholder?`: string · `open?`: boolean · +7 more | Requires `options`. Give it `aria-label` — it derives no name and posts nothing natively. Children compose the chips and listbox; see Children a component calls. |
| `NumberInput` | — | `value?`: number\|null · `defaultValue?`: number · `onValueChange?`: (value: number\|null) => void · `onChange?`: (value: number\|null) => void · `min?`: number · `max?`: number · `step?`: number · +2 more | Submits raw text — `min`/`max`/`step` are advisory only. |
| `OTPInput` | — | `length?`: number · `value?`: string · `defaultValue?`: string · `onValueChange?`: (v: string) => void · `onChange?`: (v: string) => void · `onComplete?`: (v: string) => void · `mode?`: "numeric"\|"alphanumeric" · +3 more | Name it with `aria-labelledby` — a `<div>` cannot be a `Label` target. |
| `Radio` | — | — | `value` is the option's identity, so use the **bare** binding: `{ "value": "…", "$field": "…" }`. |
| `RangeCalendar` | — | `value?`: DateRange · `defaultValue?`: DateRange · `onValueChange?`: (range: DateRange) => void · `month?`: Date · `defaultMonth?`: Date · `onMonthChange?`: (m: Date) => void · `numberOfMonths?`: number · +10 more | `value`/`defaultValue` are `{ start, end }` of ISO strings. |
| `RangeSlider` | — | `value?`: [number, number] · `defaultValue?`: [number, number] · `onValueChange?`: (value: RangeSliderValue) => void · `onChange?`: (value: RangeSliderValue) => void · `min?`: number · `max?`: number · `step?`: number · +6 more | `defaultValue` is a two-number array. No native form participation. |
| `SearchInput` | — | `value`: string · `onClear?`: () => void · `size?`: "sm"\|"md" · `clearLabel?`: string · `defaultValue?`: never | Controlled-only: bind it with `$field` or it cannot be typed in. |
| `Select` | — | `error?`: boolean | Takes an `options` array; the renderer turns it into `<option>` children. |
| `Slider` | — | `value?`: number · `defaultValue?`: number · `onValueChange?`: (value: number) => void · `onChange?`: (value: number) => void · `min?`: number · `max?`: number · `step?`: number · +1 more | Pass `aria-label`, and `aria-valuetext` on any non-percentage scale. |
| `Switch` | — | `checked?`: boolean · `defaultChecked?`: boolean · `onCheckedChange?`: (checked: boolean) => void · `size?`: "sm"\|"md" · `error?`: boolean · `name?`: string · `value?`: string · +1 more | `$field` binds `checked` and writes back through `onCheckedChange`. Needs `aria-label`. |
| `TagInput` | — | `value?`: string[] · `defaultValue?`: string[] · `onValueChange?`: (tags: string[]) => void · `onChange?`: (tags: string[]) => void · `maxTags?`: number · `validateTag?`: (tag: string) => boolean\|string · `delimiter?`: RegExp · +7 more | Values are plain strings; `$field` stores an array. `className` is the whole control — the bordered box is `classNames.control`. |
| `Textarea` | — | `error?`: boolean |  |

### Overlay

Floating surfaces. Dialogs need a literal `id` so an action can target them.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `CommandPalette` | `.Item` | `open`: boolean · `items`: CommandPaletteItem[] · `filter?`: (item: CommandPaletteItem, query: string) => boolean · `placeholder?`: string · `emptyMessage?`: ReactNode · `searchLabel?`: string · `listLabel?`: string · +1 more | Give it a literal `id`. `items[].onSelect` accepts a declarative handler object. Children compose one row; see Children a component calls. |
| `ContextMenu` | `.Trigger` `.Content` `.Item` `.Divider` `.GroupHeader` | `open?`: boolean · `onOpenChange?`: (open: boolean) => void · `defaultOpen?`: boolean | Every `.Item` needs a gapless `index`. `.Trigger` has no accessible name — give it one. Scope it to an object, never a page. |
| `Dialog` | — | `open`: boolean · `lightDismiss?`: boolean | Give it a literal `id` — the renderer owns `open`/`onClose` so `openDialog`/`closeDialog` can target it. No accessible name of its own: point `aria-labelledby` at your title. A close control comes from `DialogHeader`, not from the panel. |
| `DialogBody` | — | — | The only part of a panel that scrolls, and only beside `DialogHeader` — a panel of bare children distributes the shortfall across all of them and clips instead. Adds no padding of its own; the panel already has the gutter. |
| `DialogHeader` | — | `onClose?`: () => void · `closeLabel?`: string | The row that holds a panel's title and stays put. Renders a close control only when given `onClose` — wire it to `closeDialog` with the panel's `id`, and name it with `closeLabel`. Put it first: the panel opens focused on its first focusable descendant. |
| `Drawer` | — | `open`: boolean · `side?`: "left"\|"right"\|"top"\|"bottom" | As `Dialog`. Escape is the only built-in dismissal — render your own close control. |
| `DropdownMenu` | `.Trigger` `.Content` `.Item` `.Divider` `.GroupHeader` | `open?`: boolean · `onOpenChange?`: (open: boolean) => void · `defaultOpen?`: boolean · `placement?`: Placement | Every `.Item` needs a gapless `index`. `onSelect` takes a handler directly. Avoid `asChild`. |
| `ErrorBoundary` | — | — | Largely redundant: the renderer already wraps every node. Its `fallback` is unreachable from JSON. |
| `HoverCard` | `.Trigger` `.Content` | `open?`: boolean · `defaultOpen?`: boolean · `onOpenChange?`: (open: boolean) => void · `openDelay?`: number · `closeDelay?`: number · `placement?`: Placement | Never opens on touch and its content is unreachable by keyboard — never put unique information there. |
| `Popover` | `.Trigger` `.Content` | `open?`: boolean · `onOpenChange?`: (open: boolean) => void · `defaultOpen?`: boolean · `placement?`: Placement · `offset?`: number | `openDialog` does **not** reach it — use `defaultOpen` or its own trigger. Name `.Content`, which also takes `arrow: true`. |
| `RequireAuth` | — | `status`: "loading"\|"authenticated"\|"unauthenticated" · `redirect?`: string · `loadingFallback?`: ReactNode · `loadingLabel?`: string · `unauthenticatedFallback?`: ReactNode | `status` is a string, so `{"$ref": …}` drives it. Always supply `redirect` — otherwise `unauthenticated` renders nothing. |
| `Tooltip` | — | `content`: ReactNode · `placement?`: Placement · `delay?`: number · `offset?`: number · `container?`: HTMLElement\|null · `arrow?`: boolean | Takes `content` and exactly one child. `arrow: true` draws a pointer at the resolved side. |

### Navigation

Disclosure, tabs, wayfinding and app chrome.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Accordion` | `.Item` `.Trigger` `.Content` | `mode?`: "single"\|"multiple" · `defaultValue?`: string\|string[] · `value?`: string\|string[] · `onValueChange?`: (value: string\|string[]) => void · `headingLevel?`: 1\|2\|3\|4\|5\|6 | `.Item` needs `value`; open one with `defaultValue`. Wrap panel content in a single element. |
| `AppShell` | `.Navbar` `.Brand` `.NavbarActions` `.Toggle` `.Sidebar` `.SidebarSection` `.SidebarLink` `.Main` | `defaultOpen?`: boolean · `open?`: boolean · `onOpenChange?`: (open: boolean) => void · `defaultCollapsed?`: boolean · `collapsed?`: boolean · `onCollapsedChange?`: (collapsed: boolean) => void | `.SidebarLink` needs `to`; its `icon` takes an icon-name string. Router-aware links need a host adapter. |
| `Breadcrumbs` | `.Item` `.Divider` | `separator?`: ReactNode · `maxItems?`: number · `itemsBeforeCollapse?`: number · `itemsAfterCollapse?`: number | `aria-current` is manual — set `current: true` on the last crumb. |
| `Collapsible` | `.Trigger` `.Content` | `open?`: boolean · `defaultOpen?`: boolean · `onOpenChange?`: (open: boolean) => void · `disabled?`: boolean | Use `defaultOpen`. Never pass `id` to `.Trigger` or `.Content` — it breaks the aria wiring silently. |
| `Stepper` | `.Step` | `activeStep`: number · `orientation?`: "horizontal"\|"vertical" · `onStepClick?`: (index: number) => void · `isStepClickable?`: (index: number) => boolean · `statusLabels?`: Partial<Record<StepStatus, string>> | `activeStep` is required and fully controlled; it may equal the step count, meaning "all done". |
| `Tabs` | `.List` `.Tab` `.Panel` | `defaultValue`: string · `value?`: string · `onValueChange?`: (value: string) => void · `variant?`: "underline"\|"pill"\|"enclosed" | `defaultValue` is required, and every `.Tab`/`.Panel` `value` must match or the tab is dead. `.Panel` is a sibling of `.List`. |
| `ThemeSwitcher` | — | `themes?`: readonly string[] · `labels?`: Partial<Record<string, string>> | `themes` doubles as a filter, and persistence is write-only. It fights `spec.theme` over the same attribute. |
| `Wizard` | — | `steps`: WizardStep[] · `step?`: number · `defaultStep?`: number · `onStepChange?`: (step: number) => void · `onComplete?`: () => void · `orientation?`: "horizontal"\|"vertical" · `allowBackNavigation?`: boolean · +4 more | `steps[].content` is a ReactNode — express it as `{"$node": …}`. |

### Media

Images, rails and showcases.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `Carousel` | `.Track` `.Item` | `title?`: ReactNode · `prevLabel?`: string · `nextLabel?`: string | `.Track` is **not** optional — without it the arrows never appear. No autoplay. |
| `MediaCard` | `.Image` `.Overlay` `.Content` `.Badge` `.Action` | `orientation?`: "portrait"\|"landscape"\|"square" | `.Image` requires `alt`, and its `className` addresses the ratio box — `loading`, `srcSet`, `sizes` and friends belong in `imgProps`. The card is only as tall as its image and clips overflow. |
| `Spotlight` | `.Item` `.Image` `.Content` | `animate?`: boolean | `.Item`s must be flat children of the root. `.Image` requires `src`. Pass `animate: false`. |

### Animation

Presentational only. Pass `animate: false` when the content must be readable without a viewport observer.

| Component | Parts | Props | Notes |
| --- | --- | --- | --- |
| `AnimatePresence` | — | `show`: boolean · `enterClass?`: string · `exitClass?`: string | `show` is required. `setState` writes a literal, so use two controls rather than a toggle. |
| `Parallax` | — | `rate?`: number · `clamp?`: number | Moves outside its own layout box — clip on a parent. |
| `ScrollReveal` | — | `animation?`: "fade-up"\|"fade-in"\|"fade-left"\|"fade-right"\|"scale"\|"none" · `threshold?`: number · `delay?`: number · `once?`: boolean · `rootMargin?`: string · `animate?`: boolean · `as?`: ElementType | Starts at `opacity: 0`. Set `animate: false` wherever the text is the point; `animation: "none"` reveals with no entrance class. |
| `Stagger` | — | `staggerDelay?`: string · `as?`: ElementType | Ships no animation of its own; inert unless the host styles `.stagger-item`. |
| `ViewTransition` | — | `name`: string | `name` must be unique. Inert unless the host's navigate adapter wraps `startViewTransition`. |
<!-- /GENERATED:components -->

## Not addressable from a document

These need host code. Register a wrapper with `extendRegistry` if a document must reach one.

<!-- GENERATED:not-addressable -->
| Component | Why not, and what to do instead |
| --- | --- |
| `AvatarUpload` | `onUpload` must RETURN `{ url }` for the component to swap the preview in. A declarative handler returns nothing, so the component parks on a permanent error. Uploading is host work. |
| `Breadcrumbs.Divider` | Breadcrumbs pairs a caller's divider with the crumb it precedes by testing `child.type === BreadcrumbsDivider`. That comparison can never match through the renderer — the child's type is always the renderer's own node component — so the divider is counted as an extra crumb and the trail grows empty items. Set the root's own `separator` prop instead; it needs no identity check. |
| `FileUpload` | Needs live `File` objects. It stores none itself and has no `defaultFiles`, so `onFilesSelected` is the only channel and JSON cannot construct its argument. Register a host wrapper with `extendRegistry` instead. |
| `FormProvider` | `form` is a live `FormApi` handle from `useForm()`. Not needed: the renderer implements its own form layer — `spec.forms`, `$field`, and the `Field`/`FieldError` name binding — covering the same ground with no host code. |
| `Repeater` | Three of its four required props are host code: a `useForm` handle, a per-row render prop, and a row factory. The renderer's form model has no array-field concept for a binding to address either. `$each` over a `$ref` is the read-only approximation. |
| `RouterAdapterProvider` | `value.Link` is a component type and `value.usePathname` a hook. Mount it in the host app above `<ViewRenderer>`; documents navigate through the `navigate` action. |
| `ToastProvider` | The queue is imperative — `useToast().toast(…)` — which no document can call. Mount it in the host and use the `showToast` action, which routes through `adapters.toast`. |
<!-- /GENERATED:not-addressable -->

Props typed as a **predicate or formatter** (`isDateDisabled`, `formatValue`, `rejectMessage`, `sortComparator`, `filter`) are unreachable everywhere: a declarative handler returns nothing, so binding one is silently wrong rather than merely unsupported. Omit them.

## Spacing Scale

Gap, padding and size props take responsive tokens. The scale is **inverted**: `r1` is the largest step, `r6` the smallest. Never write raw pixels.

## Theming

Two optional levers. `theme` names a theme **your application defines**; `response-ui-css` defines only `default`, which *is* `:root`. A theme authored `:root[data-theme="…"]` matches `<html>` and nothing else, so it cannot be scoped to a subtree; the renderer's default `themeMode: "root"` writes there. For per-view theming prefer `themeOverrides`.

`themeOverrides` sets CSS custom properties inline on the view's wrapper — always scoped to the view, always works, and independent of `themeMode`. Only keys starting with `--` are applied; anything else is dropped, so a document can re-point design tokens but never restyle arbitrary CSS. Every token has a default, so override only what the design calls for. (`Portal` renders outside the wrapper and does not receive them.)

```jsonc
"themeOverrides": {
  "--C-PRIMARY": "oklch(0.55 0.2 275)",
  "--C-PRIMARY-HOVER": "oklch(0.5 0.2 275)",
  "--C-PRIMARY-ACTIVE": "oklch(0.45 0.2 275)",
  "--C-TEXT-ON-PRIMARY": "oklch(0.98 0.01 275)",
  "--RADIUS-MD": "0.25rem"
}
```

### Color tokens

All colors are OKLCH — write overrides in OKLCH. The Utility column is the class the token drives (each color also works behind the other prefixes: `bg-`, `text-`, `border-`, `ring-`).

| Token | Utility | Use |
| --- | --- | --- |
| `--C-CANVAS` | `bg-canvas` | Page background — the floor everything sits on |
| `--C-PRIMARY` / `-HOVER` / `-ACTIVE` | `bg-primary` / `-hover` / `-active` | Brand primary fill and its states |
| `--C-SECONDARY` / `-HOVER` | `bg-secondary` / `-hover` | Secondary fill |
| `--C-ACCENT` / `-HOVER` | `bg-accent` / `-hover` | Links, focus indicators |
| `--C-SURFACE-0` | `bg-surface-0` | The raised sheet — cards, dialogs, popovers, menus, resting input fills |
| `--C-SURFACE-1` | `bg-surface-1` | Still raised, one step less — panels nested in a sheet, table header rows |
| `--C-SURFACE-2` | `bg-surface-2` | Mildly recessed — hover washes, chips, badges, nested wells |
| `--C-SURFACE-3` | `bg-surface-3` | The deepest wells — progress and slider tracks, disabled fills |
| `--C-TEXT-PRIMARY` | `text-fg-primary` | Default body text |
| `--C-TEXT-SECONDARY` | `text-fg-secondary` | De-emphasized text (captions, helpers) |
| `--C-TEXT-MUTED` | `text-fg-muted` | Most-muted (placeholders, hints) |
| `--C-TEXT-INVERSE` | `text-fg-inverse` | Text on a dark surface in a light theme (and vice versa) |
| `--C-TEXT-ON-PRIMARY` | `text-fg-on-primary` | Text drawn on `--C-PRIMARY` fill |
| `--C-TEXT-ON-ACCENT` | `text-fg-on-accent` | Text drawn on `--C-ACCENT` fill |
| `--C-BORDER-DEFAULT` | `border-border-default` | Default border (cards, inputs) |
| `--C-BORDER-STRONG` | `border-border-strong` | Higher-contrast border |
| `--C-BORDER-FOCUS` | `ring-border-focus` | Focus ring color |
| `--C-STATUS-ERROR` / `-SUCCESS` / `-WARNING` / `-INFO` | `text-status-error` … | Status foregrounds |
| `--C-STATUS-ERROR-BG` / `-SUCCESS-BG` / `-WARNING-BG` / `-INFO-BG` | `bg-status-error-bg` … | Their tinted backgrounds |

**Surfaces.** The scale runs **raised → recessed**, and the lightness direction never flips: `--C-SURFACE-0` is the lightest of the four in a light theme *and* in a dark one. `--C-CANVAS` is not the end of the scale — it sits **between rungs 1 and 2**, with 0–1 raised above the page and 2–3 recessed into it. When overriding: keep that order, do not let the canvas collide with a rung, and do not pin the canvas at pure white or pure black (the recessed rungs then have nowhere to go). A rung is not an elevation — a dialog and a card both sit on rung 0 and are supposed to look alike; separate same-rung things with `--SHADOW-*` or `--C-BORDER-DEFAULT`, never by borrowing a neighbouring rung. Adjacent rungs are a deliberately **weak** cue — never hang meaning on a single step being visible.

**Pairs move together.** `--C-TEXT-ON-PRIMARY` is chosen to read on `--C-PRIMARY`, `--C-TEXT-ON-ACCENT` on `--C-ACCENT`, and each status foreground on its `-BG`. Re-tint one half of a pair and you must re-tint the other. The pairing guarantees legibility only against its own fill — a fill placed on a surface or over an image is your own contrast problem to check.

### Other tokens

| Token | Utility | Notes |
| --- | --- | --- |
| `--RADIUS-SM` / `-MD` / `-LG` / `-XL` / `-FULL` | `rounded-sm` … `rounded-full` | Defaults `0.25 / 0.5 / 0.75 / 1rem / 9999px` |
| `--SHADOW-SM` / `-MD` / `-LG` | `shadow-sm` … | Dark palettes want deeper, less-blurry shadows |
| `--DURATION-FAST` / `-NORMAL` / `-SLOW` | `duration-fast` … | Transition durations |
| `--HEADING-FONT` | — | Heading font-family |
| `--HEADING-LETTER-SPACING` | — | `normal` or a length like `0.06em` |
| `--HEADING-TEXT-TRANSFORM` | — | `none` / `uppercase` / `lowercase` |
| `--DEFAULT-FONT`, `--DEFAULT-MONO-FONT` | — | Body and mono font-families |
| `--OVERLAY-SCRIM-COLOR`, `--OVERLAY-GRADIENT-START` / `-END`, `--OVERLAY-BLUR` / `-HEAVY` | — | Spotlight, Carousel overlays, modal scrims |
| `--ASPECT-WIDE`, `--ASPECT-SQUARE` | `aspect-wide`, `aspect-square` | Default `16 / 9` and `1 / 1` |
| `--MOTION-DURATION-{ENTER,EXIT,SHIFT,PAGE}`, `--MOTION-EASE-{ENTER,EXIT,SHIFT,PAGE,BOUNCE}` | `duration-enter`, `ease-enter`, … | Motion primitives |
| `--MOTION-DISTANCE-{SM,MD,LG}`, `--MOTION-STAGGER-DELAY`, `--MOTION-SCALE-{HOVER,PRESS}` | — | Motion primitives |

A font-family override only takes effect if the host app already loads that font — a document cannot import font-faces, and an unloaded family falls back silently.

### What `themeOverrides` cannot do

- **Flip light ↔ dark.** `color-scheme` is a CSS property, not a custom property, so no `--` key reaches it — and form controls, scrollbars and the shipped shadow/status palette all follow it. Re-tint *within* the host's scheme; a real dark variant is an app-defined theme (`theme`), not an override set.
- **Responsive tokens.** `--H1`–`--H6`, `--BodyText-1..3` (each with a paired `*-line-height`), `--R-SIZE-1..6`, `--Semibold-Weight` and `--Bold-Weight` step up at a `40rem` media query. An inline override is one flat value at every width, which freezes that step — so leave the type, spacing and weight scales alone. If you must touch a size, override its `*-line-height` in the same breath or the leading will be wrong.
- **`@keyframes`.** `--MOTION-PAGE-TRANSITION-IN` / `-OUT` name keyframes a theme must also define; a document cannot define keyframes, so skip them.

## Rules

1. Component names are PascalCase; compound parts use dot notation (`StatCard.Value`).
2. A compound part must be nested inside its parent — most throw otherwise.
3. Max node depth 50; max handler chain 5.
4. `$each` must reference an array, or nothing renders.
5. `$field` needs the field declared in `spec.forms` first.
6. `Dialog`, `Drawer` and `CommandPalette` need a literal string `id`, or no action can open them.
7. Give every control an accessible name — most have none of their own.
8. Anything that reveals on scroll (`Timeline`, `MasonryGrid`, `Swimlane`, `Spotlight`, `ScrollReveal`, `Hero.Content`) starts invisible. Pass `animate: false` when the content matters more than the effect.
9. `dangerouslySetInnerHTML`, `ref`, `key` and `__proto__` are dropped; `javascript:` URLs are stripped. Do not rely on them.
