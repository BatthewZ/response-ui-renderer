# @batthewz/response-ui-renderer

**Let a model build a page inside your app, without shipping code it wrote.**

A producer — an LLM, a CMS, your own backend — emits a **ViewSpec**: plain JSON describing a view. You mount it. What renders is a themed, interactive page assembled from [`@batthewz/response-ui-react-components`](https://github.com/BatthewZ/response-ui-react-components), your own component library, with no per-component glue and no generated code in your users' browsers.

```tsx
import { ViewRenderer } from "@batthewz/response-ui-renderer";

<ViewRenderer spec={await res.json()} />;
```

**[Try it in the playground →](https://batthewz.github.io/response-ui-renderer/)** — edit a document, watch it render, retheme it from its own JSON. Nothing to install.

- **Every component the library exports is addressable, and proven to render.** 101 components and 73 compound parts, derived from the library's own barrel at runtime — not a hand-copied list — and a coverage corpus renders every one of them. 7 need host code; they are named, with the reason, in [VIEWSPEC.md](VIEWSPEC.md).
- **Zero runtime dependencies.** React and response-ui are peers; nothing else ships.
- **Host-agnostic.** No router, no server routes, no auth model. Navigation, network and toasts are injected.
- **Extensible to your own components.** Register them, declare a contract, and the renderer translates their props, the validator checks them and the reference documents them — through the same code that serves the library's own, not a parallel path.
- **Hardened for machine-generated input.** Per-node error boundaries, prototype-safe lookups, forbidden-prop stripping, URL-scheme filtering, depth limits.

---

## Why a document, and not model-written HTML?

A model can emit HTML directly, so it is fair to ask what the JSON detour buys. The difference is categorical: generated HTML+JS is a **program** you have to trust, sandbox and freeze, while a ViewSpec is **data** you can validate against a contract. Everything this package offers follows from that. (The underlying pattern is server-driven UI — the architecture Airbnb, Lyft and Shopify run natively — with a model as one possible author.)

**Safety is structural, not best-effort.** A document cannot do anything the renderer does not allow: there is no script to inject, events come from a fixed action vocabulary, and you decide what `navigate`, `fetch` and `resolveSource` actually do. Model-authored HTML is arbitrary code running in your users' browsers, mitigable only with sandboxed iframes — and the sandbox that makes it safe also cuts it off from your app's navigation, state and toasts, which a document reaches through adapters.

**The data never passes through the model.** An `api` or `source` binding means the model designs the *shape* of a view while the client fetches the numbers — with the user's own credentials, at render time. The model needs no access to the data it is presenting, a cached document stays live, and one document serves every tenant. Generated HTML either bakes stale data into the markup or ships model-written fetch code you then have to trust.

**Consistency and accessibility come from the components.** Every view is assembled from your themed, focus-managed, ARIA-correct component library, so it lands looking native to your app and follows its theme — including one it has never seen. Model-authored markup reliably gets both wrong, and no prompt fully fixes that.

**A document has a lifecycle a blob does not.** JSON can be validated before render (and regenerated on failure), diffed, patched — "make that a bar chart" is a small edit, not a regeneration — stored, and re-rendered better later: upgrade the component library and every stored document picks up the improvement. An HTML blob is frozen at generation time. A ViewSpec is also a fraction of the tokens of the equivalent HTML+CSS+JS, which compounds when generation happens per request rather than once.

**What it costs.** Expressiveness is bounded by the registry: a document composes what is registered, and while [custom components](#custom-components) raise the ceiling, a genuinely novel visualization or bespoke interaction is outside the format on purpose. For a one-off, self-contained artifact that will never live inside your app — a shareable page, a throwaway prototype — letting the model write HTML is the better tool. This package is for UI that lives inside a product: matching its design language, bound to live authenticated data, interactive without shipping code, generated repeatedly, cached.

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

Order matters — each layer reads `var(--…)` from the one before it. Tailwind v4 must be in your build.

### Your first document

The document. Nothing here is special-cased — `Card`, `Text` and `Button` are ordinary exports of the component library, addressed by name:

```json
{
  "version": 1,
  "title": "Hello",
  "root": {
    "component": "Card",
    "props": { "padding": "r4" },
    "children": [
      { "component": "Text", "props": { "variant": "h3" }, "children": ["It renders."] },
      {
        "component": "Button",
        "props": { "onClick": { "action": "showToast", "payload": { "message": "Hi" } } },
        "children": ["Say hello"]
      }
    ]
  }
}
```

The host — the only code you write:

```tsx
import { ViewRenderer } from "@batthewz/response-ui-renderer";

import spec from "./hello.json";

export default () => <ViewRenderer spec={spec} adapters={{ toast: console.log }} />;
```

You should see a themed card with an `<h3>` and a working button; clicking it logs `Hi`, because `toast` is a host adapter and you decided what it does. Change `"h3"` to `"h1"` and the heading grows. Change `"Card"` to `"Alert"` and the shell changes. That is the whole loop: the document says *what*, your library decides *how*, and the host decides what an action means.

Misspell `"Card"` and you get an inline warning in that node's place while the rest of the page still renders — documents are assumed to be machine-written, so a bad one degrades instead of throwing.

---

## The ViewSpec format

**[VIEWSPEC.md](VIEWSPEC.md) is the terse reference to hand a model** — the whole format plus every component, its compound parts and its props, generated from the live library.

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

`component` accepts compound parts by dot path: `"Table.Row"`, `"Accordion.Item"`, `"StatCard.Sparkline"`. Unknown names render an inline warning; the rest of the view is unaffected.

### Reference paths

Resolved highest-precedence first:

1. `data.…` and `forms.…` — explicit namespaces
2. `$each` aliases (`row`, `rowIndex`) and `state.…` — an alias shadows a data key of the same name, so a loop body always reads its own item
3. bare data keys — `users.0.name` means `data.users[0].name`

Form values are `forms.<name>.values.<field>`; `forms.<name>.<field>` is accepted as shorthand. Missing paths resolve to nothing rather than throwing, and prototype members (`constructor`, `__proto__`, `toString`) never resolve.

### Props

A prop value may be a literal, or one of:

```jsonc
{ "$ref": "data.user.name" }                              // resolved value
{ "action": "showToast", "payload": { "message": "Hi" } } // event callback
{ "$node": { "component": "Badge", "children": ["New"] } }  // a ViewNode in a prop
```

`$ref`, `$node` and complete handler objects resolve **inside array and object props** too, so `CommandPalette.items[].onSelect` and a `DataTable` column's `render` template work. Ordinary data is left alone — a row that happens to carry an `action` string stays a row.

Two-way form binding uses a bare `$field` key, which wires `value`/`checked` and `onChange` together:

```jsonc
{ "component": "Input", "props": { "$field": "contact.email" } }
{ "component": "Checkbox", "props": { "$field": "contact.subscribe" } }   // binds `checked`
```

The longhand `{ "value": { "$field": "contact.email" } }` is also accepted.

A string on an icon-shaped prop (`icon`, `leftIcon`, `trailingIcon`, …) becomes an icon — see [Icons](#icons).

### Data bindings

| Type | Shape | Behaviour |
| --- | --- | --- |
| `static` | `{ "type": "static", "value": … }` | inlined, resolved synchronously |
| `api` | `{ "type": "api", "endpoint": "/x", "method": "GET", "headers": {}, "body": … }` | fetched on mount via `adapters.fetch` |
| `source` | `{ "type": "source", "source": "crm", "params": {} }` | delegated to `adapters.resolveSource` |

`api` URLs are **not rewritten**. By default only relative or same-origin URLs are requested — override with `adapters.allowUrl`. `source` is the escape hatch for host-specific access (credentialed proxies, RPC, in-memory stores), so no host's server contract has to live in the wire format.

### Events

`submitForm`, `resetForm`, `navigate`, `showToast`, `apiCall`, `openDialog`, `closeDialog`, `setState`. Payloads are `$ref`-resolved before dispatch (except `apiCall.endpoint` and `setState.key`, read literally so state shape can't depend on data). Handler chains (`onSuccess`/`onError`/`onSubmit`) stop at depth 5.

Inside a payload, **`event` names the callback's arguments** — `event.value` for the first one (DOM events unwrapped), `event.args.N` for the rest. Without it a controlled component could never report anything back, so `Pagination` — controlled-only, with no `defaultPage` — could not move at all:

```jsonc
"onPageChange": { "action": "setState",
                  "payload": { "key": "page", "value": { "$ref": "event.value" } } }
```

`event` resolves to nothing outside a handler. Prefer an uncontrolled seed (`defaultValue`, `defaultOpen`) where the component has one.

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

Rules: `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `message`. `min`/`max` apply to numeric **strings** too, so they work on a plain text input. `submitForm` validates first and only then runs `onSubmit`. `Field` and `FieldError` accept `"name": "contact.email"` to surface the live error.

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

`toast` is injected rather than read from `useToast()` internally, because the library's hook throws without a `ToastProvider` — the renderer must stay mountable anywhere.

---

## Theming

`themeOverrides` sets CSS custom properties inline on the view's wrapper. They cascade to descendants, so **this always works and is always scoped to the view**:

```jsonc
"themeOverrides": { "--C-PRIMARY": "oklch(0.6 0.15 220)", "--RADIUS-MD": "1rem" }
```

Keys must start with `--`; anything else is ignored. See the [theme contract](https://github.com/BatthewZ/response-ui-css/blob/main/docs/theme-contract.md) for the full token list.

"Cascade to descendants" is the whole rule, and portalled content is the case where it bites: a `Portal`, and any floating panel opened outside an overlay, is appended to `<body>` and keeps the host's tokens. Open that same panel inside a `Dialog`, `Drawer` or `CommandPalette` and it portals into the overlay — still a descendant of the wrapper, so it inherits the overrides.

### `theme` and the `:root` caveat

A `theme` name refers to a theme **your application defines** — writing your own is the normal case. `response-ui-css` defines only `default` (which is `:root` itself); the `events` / `grimdark` / `tech` themes it ships are opt-in worked examples, not a built-in set, and nothing imports them for you.

⚠️ **A theme authored `:root[data-theme="…"]` matches `<html>` and nothing else.** A theme name therefore cannot be scoped to a subtree if it is written that way — the attribute has to be on the document element or the rule matches nothing. The worked examples, and the theme template most themes start from, are written that way.

`themeMode` makes the trade-off explicit:

| `themeMode` | Writes `data-theme` to | Works with a `:root[data-theme]` theme | Scope |
| --- | --- | --- | --- |
| `"root"` *(default)* | `<html>` | ✅ yes | whole document |
| `"scoped"` | the view's wrapper | ❌ no — needs a bare `[data-theme]` theme | the view only |

A view that declares no theme makes no claim at all, so it never strips the host's theme. `"root"` claims are a stack — the most recently mounted wins, releasing one falls back to the next, and the last one out restores the host's own value — and it warns whenever more than one view is claiming `<html>`. For genuinely independent per-view themes, either author your themes with a bare `[data-theme="…"]` selector and use `"scoped"`, or express the theme as `themeOverrides`.

---

## Several documents on one page

A page that mounts one `ViewRenderer` per document — a transcript rendering a view per turn, say — puts every document into one DOM id namespace. Author-supplied ids pass through verbatim, which is what lets a document wire its own `Label` to its own control, so two documents naming a control the same thing collide silently:

- **Radio groups merge.** `name` is how the browser groups radios, and that grouping is per page. Two documents each rendering a `name: "confidence"` group become *one* group, and choosing in the second clears the first.
- **Labels retarget.** `htmlFor` resolves to the **first** matching id on the page, so clicking the second document's label activates the first document's control.

`idScope` namespaces them:

```tsx
{turns.map((turn) => (
  <ViewRenderer key={turn.id} spec={turn.view} idScope />
))}
```

| `idScope` | Prefix | For |
| --- | --- | --- |
| omitted *(default)* | none — ids pass through | a single document on the page |
| `true` | derived, unique per instance | a host composing a list |
| `"turn-7"` | exactly that | an id you must construct from outside — a deep link, a test, an `aria-labelledby` pointing in |

It rewrites `id`, `htmlFor`, `list`, `form`, the ARIA id references and `DateRangePicker`'s `startInputId` / `endInputId`, on the **resolved** value — so an id that arrives through a `$ref`, or out of an `api` binding that had not loaded yet, is scoped like any other. Strings and numbers both, because a row id pulled out of data is usually a number.

`name` is rewritten only where it is a **DOM form-control name** — `Input`, `Radio`, `Checkbox`, `Select`, `Textarea` and the rest of the form controls. Components that spend `name` on something else keep it verbatim: an `Icon`'s identity, an `Avatar`'s display name, a `Field` / `FieldError` form path, a `Repeater`'s field-array path, a `ViewTransition`'s CSS `view-transition-name`. A component the renderer does not know about — including one you register yourself through `extendRegistry` — is left alone, so a custom component's `name` is never rewritten behind your back. Say `nameProp: "dom"` in its [contract](#custom-components) when it *is* a form control and you want it scoped.

It never touches `$field` paths, the names in `spec.forms`, `$ref` / `state` keys, or the `dialogId` an `openDialog` action names: those are already scoped to the renderer instance, so a document's actions go on naming the ids the document wrote. Components build their own internal ARIA wiring with React's per-instance id hook, which is unique already.

**What it cannot do for you:**

- **References that point out of the document.** Scoping rewrites every id a document writes, so `aria-labelledby` naming a heading in your page chrome, or `form` naming a host `<form>`, will point at nothing. Use the string form and prefix those ids yourself, or keep the reference inside the document.
- **Fragment links.** `href="#section"` is not scoped — `href` goes through the URL filter — so an in-page anchor to a scoped `id` will not resolve. Give the link an explicit scoped target.
- **`$each` over a literal `id`.** Repeating a node that carries a literal `id` duplicates ids *within* one document; there is one scope per renderer, so this cannot separate them. Derive the id from the row instead.
- **Separate render passes.** `true` is unique per component instance within a render pass. If you server-render each document in its own pass, every one derives the same prefix — pass a string you control instead.

---

## Icons

response-ui exports no `Icon` component, but many of its components take `icon` props typed `ReactNode` — which JSON cannot express. This package adds an `Icon` node and coerces string-valued icon props, given an icon set:

```tsx
import { lucideIcons } from "@batthewz/response-ui-renderer/icons";

<ViewRenderer spec={spec} icons={lucideIcons} />;
```

```jsonc
{ "component": "Icon", "props": { "name": "Check", "size": 16 } }
{ "component": "Timeline.Item", "props": { "icon": "Check" } }
```

The full lucide set is a **separate entry point** because it is ~1600 modules and the core must not make you pay for it. For a smaller bundle, pass a curated map:

```tsx
import { Check, TrendingUp, X } from "lucide-react";
<ViewRenderer spec={spec} icons={{ Check, TrendingUp, X }} />;
```

Names are matched leniently — `"trending-up"`, `"trending_up"` and `"TrendingUp"` all resolve. An unresolved name renders a placeholder that holds its slot rather than throwing.

---

## Validation

The core validator is dependency-free:

```ts
import { defaultRegistry } from "@batthewz/response-ui-renderer";
import { validateViewSpec } from "@batthewz/response-ui-renderer/spec";

const result = validateViewSpec(json, { registry: defaultRegistry });
if (!result.ok) return renderErrors(result.issues);
for (const issue of result.issues) console.warn(issue.path, issue.message);
```

**Pass the registry and it checks the names.** Without it the validator has no way to tell a typo from a component it was never told about, so it judges no name at all and `"Cadr"` passes clean — surfacing only as an inline warning once the page has already drawn. With it:

```
root.children[2].component
unknown component "Cadr"; the node renders an inline warning in its place — did you mean "Card"?
```

`registry` also takes a plain list of names, which is what `listComponentNames(registry)` returns — the form that survives being sent to a validation service with no React in it. Per-component checks (bounded prop values, dialogs that need an `id`, roots that parse their children as text) come from `contracts`, and cover [your own components](#custom-components) as readily as the library's.

Every issue carries a `severity`:

- `"error"` — the document does not conform; `ok` is `false`. Use `errorsOf(issues)`.
- `"warning"` — it conforms, but names something that will not do what it looks like: a forbidden prop, a `javascript:` URL, an unknown action inside a prop, a theme override that is not a custom property, nesting past the depth cap, or a value outside the set a prop accepts. Use `warningsOf(issues)`.

That last one is the difference between a document that fails and one that quietly underdelivers. Props like `gap`, `variant` and `size` are looked up in a table of classes; a miss returns nothing, so the component renders with that dimension absent and nothing in the DOM to notice. The accepted values are read out of the library's own declarations, so the reference a model authors from and the check it is validated against are one artifact.

`ViewRenderer` never consults this — it degrades per node regardless — so validation is a gate you choose to put in front of it.

### Zod (optional)

`zod` is an **optional peer**; importing this subpath is opt-in and the core never pulls it in.

```ts
import { viewSpecSchema, viewSpecJsonSchema } from "@batthewz/response-ui-renderer/zod";

viewSpecSchema.safeParse(json);           // server-side gate
const schema = viewSpecJsonSchema();      // JSON Schema for LLM structured output
```

`viewSpecJsonSchema()` is the more interesting one: hand it to a model as a tool / structured-output schema and shape generation into valid documents, rather than repairing them afterwards. The node types are mutually recursive, so the output uses `$ref` cycles — check your provider accepts them.

The two agree on **conformance** (`ok`), and a test suite fails if they ever diverge. They deliberately differ below that: Zod types `props` as an open record, so the warning tier above has no Zod counterpart. Validate with `validateViewSpec` if you want those.

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

This is defence in depth, not a sanitiser: a component given hostile *content* still renders that content as text.

---

## Styling from a document

`className` reaches the element a component renders itself; `classNames` reaches the ones it renders inside itself, keyed by slot. Both are passed through untouched and both still collapse correctly — every response-ui component merges them through `cn()` internally, so `"p-r3 p-r5"` resolves to `p-r5` without the renderer doing anything. The slot keys for every component are listed in [VIEWSPEC.md](VIEWSPEC.md).

⚠️ **Tailwind generates utilities by scanning source at build time, and a document arrives at runtime.** A class a document invents is therefore not in your CSS unless something else already used it. If your documents are stored rather than streamed, point Tailwind at them:

```css
@source "./content/views/**/*.json";
```

Otherwise keep documents to the scale (`gap-r4`, `p-r3`, `w-full`) and prefer real props — which is what the reference tells a model to do, and what `validateViewSpec` checks.

---

## Custom components

Registering a component makes it *renderable*. A **contract** tells the renderer, the validator and the reference generator everything else they know about a component — the same record, read by the same code, for your components and the library's alike.

```tsx
import { defaultRegistry, extendRegistry } from "@batthewz/response-ui-renderer";

const registry = extendRegistry(defaultRegistry, { BarChart, Widget: { component: W, subComponents: { Item } } });
<ViewRenderer spec={spec} registry={registry} />;
```

`listComponentNames(registry)` returns every addressable name including compound parts — useful for generating the catalogue you give a model.

### Contracts

Everything this package knows about a component beyond how to construct it lives in one record per addressable name, and `extendContracts` merges yours in:

```tsx
import { defaultContracts, extendContracts } from "@batthewz/response-ui-renderer";

const contracts = extendContracts(defaultContracts, {
  BarChart: {
    category: "Charts",
    note: "Bind `series` to a `data` key; `orientation` defaults to vertical.",
    propEnums: { orientation: ["horizontal", "vertical"] },
    coercions: { since: "isoDate", rowKey: "keyAccessor" },
  },
  "Widget.Item": { propEnums: { tone: ["muted", "loud"] } },
});

<ViewRenderer spec={spec} registry={registry} contracts={contracts} />;
```

Merging is **per field**, so naming a component that already has a record adds to it — you can attach a note to `Card` without knowing what else `Card`'s record holds. A field you supply replaces that field whole. Nothing is registered globally and nothing mutates: contracts are a value you pass, so two renderers on one page can hold different ones and a test cannot leak into the next.

| Field | What it does |
| --- | --- |
| `category` · `note` | Where the component appears in a generated reference, and the one thing an author would otherwise get wrong |
| `propEnums` | Props bounded to a fixed set of strings. `validateViewSpec` warns on anything else — the component would look the value up in a table of classes and draw nothing |
| `coercions` | `isoDate` · `isoDateRange` · `keyAccessor` · `columnDefs` — props typed with something JSON cannot express |
| `functionChildren` | `children` is a function the component calls. `args` are the names a document may `$ref` inside them — the keys of the single options object your component passes, or, if it passes positional arguments, the names they bind to in order |
| `textChildren` | `children` is source text the component parses, not nodes it places |
| `dialog` | The renderer owns its open state, so `openDialog` / `closeDialog` can target it |
| `childInspection` | It clones or reads its own children, so no error boundary may sit between them. `"asChild"` to apply only when the node sets `asChild` |
| `iconComponentProps` | Icon slots typed as a component rather than a node — handing one an element throws instead of degrading. Only consulted for props the renderer already treats as icons: named `icon`, or ending in `Icon` |
| `nameProp` | `"dom"` when `name` reaches a real form element, so `idScope` namespaces it |
| `props` · `slots` | Reference only: the props table and `classNames` slot keys |

Omit the whole thing and a registered component still renders — it simply gets none of the above, which is what it got before contracts existed.

**What a contract cannot express.** Two validator rules stay specific to the peer library: `Radio`'s bare-form `$field` spelling, and the handful of parents whose child *identity* checks (`child.type === Avatar`) cannot survive a renderer. Both turn on per-component structure — which child, which prop — rather than on data, so a contract field would have to be a predicate, and a warning that fires when an author can do nothing about it is a warning they learn to ignore. `enumeratedValues(component, prop, contracts)` reads your contracts too, so it never disagrees with the warning the validator would raise.

### A reference for your registry

`VIEWSPEC.md` is generated by calling the same function this package exports, so a reference covering your components is one call rather than a fork of a build script:

```ts
import {
  DEFAULT_CATEGORIES,
  defaultReferenceContracts,
  extendContracts,
  renderComponentReference,
} from "@batthewz/response-ui-renderer/reference";

const { components, slots } = renderComponentReference(
  extendContracts(defaultReferenceContracts, contracts),
  { categories: [...DEFAULT_CATEGORIES, { name: "Charts", blurb: "Rendered from live data." }] },
);
```

`defaultReferenceContracts` is `defaultContracts` plus everything only a reference reads: the prop tables, the slot keys, **and the library's curated category and note**. That is 60-odd kilobytes of documentation nothing reads at render or validate time, which is why it sits behind its own entry point rather than in the core — and why `defaultContracts` alone carries no category, so generating a reference from it would describe nothing. It throws rather than hand you an empty table. Compound parts are read off the names themselves: register `"Widget.Item"` and it appears in `Widget`'s Parts column.

The **derivation** does not ship, only the rendering. The library's prop tables and slot keys were machine-extracted from its `.d.ts` by a script that stays in this repo; for your own components you write `props` and `slots` yourself, or their columns read `—`.

Categories are yours to name, and a component categorised under a heading you did not list **throws** rather than being quietly dropped — the failure mode that once cost `VIEWSPEC.md` its entire Action section while every check still passed.

Prose is not generated: this returns the table regions, and the words around them stay yours.

### A reference scoped to what you actually author

Most producers use a fraction of the library. A tutoring app that emits a lesson as a document might author 17 component names, over and over — and pay ~12k tokens per request to find them among the 96 the reference documents. Narrow the contracts and the reference narrows with them:

```ts
import { renderViewSpecReference } from "@batthewz/response-ui-renderer/reference";

const reference = renderViewSpecReference({
  include: NAMES_MY_APP_AUTHORS,
  propLimit: false,
});
```

`renderViewSpecReference` returns `VIEWSPEC.md` as a string — prose and all. With no options it *is* the shipped file, byte for byte; given a scope it is the same document describing only those components. For the 17-name vocabulary above: **47,848 → 26,148 bytes, a 45.4% saving** on every request that carries it. Generate it once at startup and cache the string.

Pass `contracts: extendContracts(defaultReferenceContracts, yours)` to have components you registered documented alongside the library's, or compose `scopeContracts` yourself when you want the same narrowed set for something else — feeding `validateViewSpec` a registry of exactly the names your prompt describes, for instance.

**`propLimit: false` is about accuracy, not size.** The full reference caps each row at seven props because 96 components have to fit one readable file — a cap that hides props on 20 of those rows. A hidden prop is one an author invents instead, and nothing catches that: value checking cannot fire on a prop name that was never declared. A narrow scope has no size problem, so it can carry the complete list. For the 17 names above it happens to change nothing — none of them is truncated — and it is worth passing anyway, because which of your components sits near the cap is not a thing you should have to track.

Three things the scope deliberately leaves alone, and one honest limit.

- A compound part **travels with its root in both directions**, so `Stepper` brings `Stepper.Step`, and `AppShell.Navbar` brings `AppShell` *and its seven other parts* — a part cannot render anywhere else, and a root advertising some of its parts is a subtler lie than one advertising none.
- The **prose and the worked examples stay whole**, and the scope *names what that costs*. After scoping to those 17 names, 8 of the document's 11 example component names sit outside it — the `MultiSelect` block and the `Pagination` one. Those components still render, so a model copying an example gets no error, just no prop table to author against. Rather than tag prose by component set (a mis-tag silently deletes advice, which is worse), the components region opens with a generated line naming every one of them, and a table a scope leaves empty says so instead of showing a bare header.
- The **not-addressable table stays whole** (1,813 bytes of the 26,148), because it is advice about absence — filtering it would remove the line that stops an author reaching for `FileUpload` in the one document where nothing else mentions it. Scoping it too would land at ~24,300 bytes, a 49% saving; that is the trade.
- The tables describe the component library **as of this package's release**, not as of the copy in your `node_modules` — they are derived at build time from its declarations. Regenerating cannot drift past this package; within one `^` range, it can lag its peer.

A name no contract holds **throws**, with the nearest match. That is the point of generating rather than keeping a hand-copied subset: when the library moves, the scope tells you.

---

## API

`ViewRenderer` · `NodeRenderer` · `NodeErrorBoundary` · `ViewThemeScope` · `ViewDataProvider` · `ViewContextExtender` · `useViewData` · `defaultRegistry` · `extendRegistry` · `createRegistryFromModule` · `lookupComponent` · `listComponentNames` · `defaultContracts` · `extendContracts` · `contractFor` · `componentNamesOf` · `Icon` · `IconSetProvider` · `useIconSet` · `useFormsState` · `createEventCallback` · `validateField` · `validateForm` · `resolveRef` · `resolveDeep` · `validateViewSpec` · `isViewSpec` · `PROP_ENUMS` / `enumeratedValues` · `FUNCTION_CHILDREN` · `TEXT_CHILDREN` · `COMPONENT_TYPED_ICON_SLOTS` · `COMPONENT_NOTES` · `PROP_COERCIONS` — plus every type.

That last group is there for prompt and schema building: the accepted values of every bounded prop, the components whose `children` is a function of their own data, and the ones whose `children` is source text they parse. `COMPONENT_TYPED_ICON_SLOTS` is the odd one — *most* icon slots take a name (see [VIEWSPEC.md](VIEWSPEC.md)); this is the exception that wants a component type rather than an element, invisible from a document and useful to a schema builder.

Subpaths: `/spec` (types + validator + contracts, no React) · `/reference` (reference generation and scoping) · `/icons` (lucide set) · `/zod` (schemas) · `/styles` (CSS).

## License

MIT
