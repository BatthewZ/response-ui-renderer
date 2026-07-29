# @batthewz/response-ui-renderer

Render declarative JSON as [`@batthewz/response-ui-react-components`](https://github.com/BatthewZ/response-ui-react-components).

The machine-authorable layer of the response-ui design system: an LLM (or any producer)
emits a **ViewSpec** document, you mount `<ViewRenderer spec={json} />`, and you get a
themed, interactive page built from real design-system components — no per-component glue.

```tsx
import { ViewRenderer } from "@batthewz/response-ui-renderer";

<ViewRenderer spec={await res.json()} />;
```

- **Every component the library exports is addressable, and proven to render.** 98 components
  and 66 compound parts, derived from the library's own barrel at runtime — not a hand-copied
  list — and a coverage corpus renders every one of them. 7 need host code; they are named,
  with the reason, in [VIEWSPEC.md](VIEWSPEC.md).
- **Zero runtime dependencies.** React and response-ui are peers; nothing else ships.
- **Host-agnostic.** No router, no server routes, no auth model. Navigation, network and
  toasts are injected.
- **Hardened for machine-generated input.** Per-node error boundaries, prototype-safe
  lookups, forbidden-prop stripping, URL-scheme filtering, depth limits.

---

## Install

```bash
bun add @batthewz/response-ui-renderer @batthewz/response-ui-react-components \
  @batthewz/response-ui-css react react-dom @floating-ui/react lucide-react
```

Three CSS imports, in this order:

```css
@import "@batthewz/response-ui-css";                      /* tokens, scales, `default` theme */
@import "@batthewz/response-ui-react-components/styles";  /* component CSS */
@import "@batthewz/response-ui-renderer/styles";          /* renderer diagnostics */
```

Order matters — each layer reads `var(--…)` from the one before it. Tailwind v4 must be in
your build.

---

## The ViewSpec format

**[VIEWSPEC.md](VIEWSPEC.md) is the terse reference to hand a model** — the whole format plus
every component, its compound parts and its props, generated from the live library.

```jsonc
{
  "version": 1,
  "title": "Team",
  "theme": "aurora",                            // optional — a theme your app defines
  "themeOverrides": { "--C-PRIMARY": "oklch(0.6 0.15 220)" },  // optional
  "data": { "members": { "type": "static", "value": [{ "name": "Ada" }] } },
  "forms": { "contact": { "fields": { "email": { "initialValue": "" } } } },
  "state": { "page": 1 },                       // optional — seeds `state.…` refs
  "root": { "component": "Stack", "children": ["Hello"] }
}
```

### Nodes

| Node | Shape | Renders |
| --- | --- | --- |
| Text | `"Hello"` | a text node |
| Component | `{ "component": "Card", "props": {…}, "children": [] }` | a registered component |
| Reference | `{ "$ref": "data.user.name" }` | the resolved value as text |
| Loop | `{ "$each": "data.rows", "as": "row", "node": {…} }` | `node` once per element |
| Conditional | `{ "$cond": "data.flag", "then": {…}, "else": {…} }` | one branch, by truthiness |

`component` accepts compound parts by dot path: `"Table.Row"`, `"Accordion.Item"`,
`"StatCard.Sparkline"`. Unknown names render an inline warning; the rest of the view is
unaffected.

### Reference paths

Resolved highest-precedence first:

1. `data.…` and `forms.…` — explicit namespaces
2. `$each` aliases (`row`, `rowIndex`) and `state.…` — an alias shadows a data key of the
   same name, so a loop body always reads its own item
3. bare data keys — `users.0.name` means `data.users[0].name`

Form values are `forms.<name>.values.<field>`; `forms.<name>.<field>` is accepted as
shorthand. Missing paths resolve to nothing rather than throwing, and prototype members
(`constructor`, `__proto__`, `toString`) never resolve.

### Props

A prop value may be a literal, or one of:

```jsonc
{ "$ref": "data.user.name" }                              // resolved value
{ "action": "showToast", "payload": { "message": "Hi" } } // event callback
{ "$node": { "component": "Badge", "children": ["New"] } }  // a ViewNode in a prop
```

`$ref`, `$node` and complete handler objects resolve **inside array and object props** too, so
`CommandPalette.items[].onSelect` and a `DataTable` column's `render` template work. Ordinary
data is left alone — a row that happens to carry an `action` string stays a row.

Two-way form binding uses a bare `$field` key, which wires `value`/`checked` and `onChange`
together:

```jsonc
{ "component": "Input", "props": { "$field": "contact.email" } }
{ "component": "Checkbox", "props": { "$field": "contact.subscribe" } }   // binds `checked`
```

The longhand `{ "value": { "$field": "contact.email" } }` is also accepted.

A string on an icon-shaped prop (`icon`, `leftIcon`, `trailingIcon`, …) becomes an icon —
see [Icons](#icons).

### Data bindings

| Type | Shape | Behaviour |
| --- | --- | --- |
| `static` | `{ "type": "static", "value": … }` | inlined, resolved synchronously |
| `api` | `{ "type": "api", "endpoint": "/x", "method": "GET", "headers": {}, "body": … }` | fetched on mount via `adapters.fetch` |
| `source` | `{ "type": "source", "source": "crm", "params": {} }` | delegated to `adapters.resolveSource` |

`api` URLs are **not rewritten**. By default only relative or same-origin URLs are
requested — override with `adapters.allowUrl`. `source` is the escape hatch for
host-specific access (credentialed proxies, RPC, in-memory stores), so no host's server
contract has to live in the wire format.

### Events

`submitForm`, `resetForm`, `navigate`, `showToast`, `apiCall`, `openDialog`, `closeDialog`,
`setState`. Payloads are `$ref`-resolved before dispatch (except `apiCall.endpoint` and
`setState.key`, read literally so state shape can't depend on data). Handler chains
(`onSuccess`/`onError`/`onSubmit`) stop at depth 5.

Inside a payload, **`event` names the callback's arguments** — `event.value` for the first one
(DOM events unwrapped), `event.args.N` for the rest. Without it a controlled component could
never report anything back, so `Pagination` — controlled-only, with no `defaultPage` — could
not move at all:

```jsonc
"onPageChange": { "action": "setState",
                  "payload": { "key": "page", "value": { "$ref": "event.value" } } }
```

`event` resolves to nothing outside a handler. Prefer an uncontrolled seed (`defaultValue`,
`defaultOpen`) where the component has one.

```jsonc
{
  "component": "Button",
  "props": { "onClick": { "action": "submitForm", "payload": { "form": "contact" } } },
  "children": ["Send"]
}
```

### Forms

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

Rules: `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `message`. `min`/`max`
apply to numeric **strings** too, so they work on a plain text input. `submitForm` validates
first and only then runs `onSubmit`. `Field` and `FieldError` accept
`"name": "contact.email"` to surface the live error.

---

## Adapters

Nothing about your host is assumed. Supply only what your documents use.

```tsx
import { useNavigate } from "react-router-dom";
import { useToast } from "@batthewz/response-ui-react-components";

const navigate = useNavigate();
const { toast } = useToast();

<ViewRenderer
  spec={spec}
  adapters={{
    navigate,
    toast,
    fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
    resolveSource: async (binding, signal) =>
      (await fetch(`/api/proxy/${binding.source}`, { signal })).json(),
    allowUrl: (url) => url.startsWith("/"),
  }}
/>;
```

| Adapter | Default | Used by |
| --- | --- | --- |
| `navigate` | warns | `navigate` |
| `toast` | warns | `showToast`, request failures |
| `fetch` | `globalThis.fetch` | `api` bindings, `apiCall` |
| `resolveSource` | reports a diagnostic | `source` bindings |
| `allowUrl` | relative or same-origin | every request |

`toast` is injected rather than read from `useToast()` internally, because the library's
hook throws without a `ToastProvider` — the renderer must stay mountable anywhere.

---

## Theming

`themeOverrides` sets CSS custom properties inline on the view's wrapper. They cascade to
descendants, so **this always works and is always scoped to the view**:

```jsonc
"themeOverrides": { "--C-PRIMARY": "oklch(0.6 0.15 220)", "--RADIUS-MD": "1rem" }
```

Keys must start with `--`; anything else is ignored. See the
[theme contract](https://github.com/BatthewZ/response-ui-css/blob/main/docs/theme-contract.md)
for the full token list.

### `theme` and the `:root` caveat

A `theme` name refers to a theme **your application defines** — writing your own is the
normal case. `response-ui-css` defines only `default` (which is `:root` itself); the
`events` / `grimdark` / `tech` themes it ships are opt-in worked examples, not a built-in
set, and nothing imports them for you.

⚠️ **A theme authored `:root[data-theme="…"]` matches `<html>` and nothing else.** A theme
name therefore cannot be scoped to a subtree if it is written that way — the attribute has
to be on the document element or the rule matches nothing. The worked examples, and the
theme template most themes start from, are written that way.

`themeMode` makes the trade-off explicit:

| `themeMode` | Writes `data-theme` to | Works with a `:root[data-theme]` theme | Scope |
| --- | --- | --- | --- |
| `"root"` *(default)* | `<html>` | ✅ yes | whole document |
| `"scoped"` | the view's wrapper | ❌ no — needs a bare `[data-theme]` theme | the view only |

A view that declares no theme makes no claim at all, so it never strips the host's theme.
`"root"` claims are a stack — the most recently mounted wins, releasing one falls back to
the next, and the last one out restores the host's own value — and it warns whenever more
than one view is claiming `<html>`. For genuinely independent per-view themes, either author your themes with
a bare `[data-theme="…"]` selector and use `"scoped"`, or express the theme as
`themeOverrides`.

---

## Icons

response-ui exports no `Icon` component, but many of its components take `icon` props typed
`ReactNode` — which JSON cannot express. This package adds an `Icon` node and coerces
string-valued icon props, given an icon set:

```tsx
import { lucideIcons } from "@batthewz/response-ui-renderer/icons";

<ViewRenderer spec={spec} icons={lucideIcons} />;
```

```jsonc
{ "component": "Icon", "props": { "name": "Check", "size": 16 } }
{ "component": "Timeline.Item", "props": { "icon": "Check" } }
```

The full lucide set is a **separate entry point** because it is ~1600 modules and the core
must not make you pay for it. For a smaller bundle, pass a curated map:

```tsx
import { Check, TrendingUp, X } from "lucide-react";
<ViewRenderer spec={spec} icons={{ Check, TrendingUp, X }} />;
```

Names are matched leniently — `"trending-up"`, `"trending_up"` and `"TrendingUp"` all
resolve. An unresolved name renders a placeholder that holds its slot rather than throwing.

---

## Validation

The core validator is dependency-free:

```ts
import { validateViewSpec } from "@batthewz/response-ui-renderer/spec";

const result = validateViewSpec(json);
if (!result.ok) return renderErrors(result.issues);
for (const issue of result.issues) console.warn(issue.path, issue.message);
```

Every issue carries a `severity`:

- `"error"` — the document does not conform; `ok` is `false`. Use `errorsOf(issues)`.
- `"warning"` — it conforms, but names something the renderer will drop at render time: a
  forbidden prop, a `javascript:` URL, an unknown action inside a prop, a theme override
  that is not a custom property, nesting past the depth cap. Use `warningsOf(issues)`.

`ViewRenderer` never consults this — it degrades per node regardless — so validation is a
gate you choose to put in front of it.

### Zod (optional)

`zod` is an **optional peer**; importing this subpath is opt-in and the core never pulls it
in.

```ts
import { viewSpecSchema, viewSpecJsonSchema } from "@batthewz/response-ui-renderer/zod";

viewSpecSchema.safeParse(json);           // server-side gate
const schema = viewSpecJsonSchema();      // JSON Schema for LLM structured output
```

`viewSpecJsonSchema()` is the more interesting one: hand it to a model as a tool /
structured-output schema and shape generation into valid documents, rather than repairing
them afterwards. The node types are mutually recursive, so the output uses `$ref` cycles —
check your provider accepts them.

The two agree on **conformance** (`ok`), and a test suite fails if they ever diverge. They
deliberately differ below that: Zod types `props` as an open record, so the warning tier
above has no Zod counterpart. Validate with `validateViewSpec` if you want those.

---

## Hardening

Documents are assumed untrusted, because a generator wrote them.

| Risk | Handling |
| --- | --- |
| A component throws | per-node error boundary; siblings keep rendering |
| Unknown component | inline warning in place |
| `dangerouslySetInnerHTML`, `ref`, `key`, `__proto__` | dropped before `createElement` |
| `javascript:` / `vbscript:` / `data:text/html` URLs | dropped, including `java\tscript:` |
| `"component": "__proto__"` | own-property lookups only; resolves to nothing |
| `$ref` into `constructor` / `__proto__` | own-property walks only |
| Runaway nesting | capped at 50 levels |
| Handler recursion | capped at 5 |
| Cross-origin requests | blocked unless `allowUrl` says otherwise |

This is defence in depth, not a sanitiser: a component given hostile *content* still
renders that content as text.

---

A `className` on a component node is passed through untouched. It still collapses correctly
— every response-ui component merges its own `className` through `cn()` internally, so
`"p-r3 p-r5"` resolves to `p-r5` without the renderer doing anything.

---

## Custom components

```tsx
import { defaultRegistry, extendRegistry } from "@batthewz/response-ui-renderer";

const registry = extendRegistry(defaultRegistry, { BarChart, Widget: { component: W, subComponents: { Item } } });
<ViewRenderer spec={spec} registry={registry} />;
```

`listComponentNames(registry)` returns every addressable name including compound parts —
useful for generating the catalogue you give a model.

---

## API

`ViewRenderer` · `NodeRenderer` · `NodeErrorBoundary` · `ViewThemeScope` · `ViewDataProvider`
· `ViewContextExtender` · `useViewData` · `defaultRegistry` · `extendRegistry` ·
`createRegistryFromModule` · `lookupComponent` · `listComponentNames` · `Icon` ·
`IconSetProvider` · `useIconSet` · `useFormsState` · `createEventCallback` · `validateField`
· `validateForm` · `resolveRef` · `resolveDeep` · `validateViewSpec` · `isViewSpec` — plus
every type.

Subpaths: `/spec` (types + validator, no React) · `/icons` (lucide set) · `/zod` (schemas) ·
`/styles` (CSS).

## License

MIT
