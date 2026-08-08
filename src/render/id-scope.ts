/**
 * Namespacing author-supplied DOM ids, so several documents can share one page.
 *
 * Mounting N `ViewRenderer`s puts N documents into one DOM id namespace. Author
 * ids pass through verbatim — correctly, since that is what lets a document wire
 * its own `Label` to its own control — so two documents naming a control the
 * same thing collide silently: `name` is how the browser groups radios, and
 * `htmlFor` resolves to the *first* matching id in document order.
 *
 * Every rule here is selected by a prop's KEY and applied to its RESOLVED value.
 * That is what makes this the renderer's job rather than a host pre-pass over
 * the spec: a document may write `{"$ref": …}` in any prop position, and an
 * `api` binding's value does not exist anywhere until the view mounts.
 *
 * Component-internal wiring needs none of this — the library builds its own
 * relationships with React's per-instance id hook, which is already unique.
 *
 * This module stays free of React so it can say so: it is pure, and the RSC
 * gate reads the token, not the meaning.
 */

/**
 * ARIA attributes typed as an ID reference *list* in ARIA 1.2: a parent may
 * append its own id to whatever the child already carried.
 *
 * `composeProp` merges on exactly this set. Scoping asks a different question
 * and uses its own set below — an attribute can hold one id and still need
 * prefixing, and conflating the two once cost `aria-details` its second token.
 */
export const ARIA_IDREF_LIST_PROPS: ReadonlySet<string> = new Set([
  "aria-controls",
  "aria-describedby",
  "aria-flowto",
  "aria-labelledby",
  "aria-owns",
]);

/**
 * Every prop whose value is one or more DOM ids, whatever the count.
 *
 * All of them are prefixed token-by-token. Splitting a single id on whitespace
 * yields that id back, so the uniform treatment costs nothing and removes the
 * question "is this one really a list?" — which ARIA 1.2 and 1.3 answer
 * differently for `aria-details` and `aria-errormessage`, and which produced
 * `"doc-a b"` (first token scoped, second orphaned) when they were treated as
 * single values.
 *
 * `startInputId` / `endInputId` are `DateRangePicker`'s author-supplied ids —
 * declared by the library precisely "so a `<Label htmlFor>` can name it". They
 * belong here or turning scoping ON *breaks* a label that worked with it off.
 *
 * `form` is the one to watch: `FormProvider` claims that key for a `FormApi`
 * object. Only strings and numbers are prefixed, so an object passes through.
 */
export const ID_REF_PROPS: ReadonlySet<string> = new Set([
  "id",
  "htmlFor",
  "list",
  "form",
  "startInputId",
  "endInputId",
  "aria-activedescendant",
  "aria-details",
  "aria-errormessage",
  ...ARIA_IDREF_LIST_PROPS,
]);

/**
 * Which components' `name` prop is a DOM form-control name.
 *
 * **`name` is left alone unless it is named `"dom"` here.** That direction is
 * the whole design: the two failure modes are not symmetric.
 *
 * - Missing a DOM name → that component's radios go on merging across
 *   documents. The pre-existing bug, which hosts already live with.
 * - Scoping a name that meant something else → silent corruption of a value the
 *   author wrote, in a component that worked before the flag was set.
 *
 * And the two populations differ in kind. The DOM-`name` set is **closed and
 * knowable**: the handful of library components that put `name` on an `<input>`,
 * `<select>`, `<textarea>` or a hidden submission input. The semantic-`name` set
 * is **open** — every component the library may add, plus every component a host
 * registers through `extendRegistry`, which no gate in this package can see.
 * Defaulting to "scope it" means enumerating the open set forever, across a
 * package boundary. Defaulting to "leave it" means enumerating the closed one.
 *
 * Getting this backwards is not hypothetical: it silently corrupted
 * `ViewTransition`, whose required `name` is a CSS `view-transition-name` that
 * only works when it *matches* a counterpart, and which this package's own
 * corpus renders.
 *
 * `"own"` entries change no behaviour; they are the record that a human read the
 * declaration and decided. `contracts.test.ts` fails when the library grows a
 * `name` prop this table does not classify.
 */
export const NAME_PROP_MEANING: Readonly<Record<string, "dom" | "own">> = {
  // DOM form-control names — `name` reaches a real form element.
  Checkbox: "dom",
  "Combobox.Input": "dom",
  DatePicker: "dom",
  DateRangePicker: "dom",
  Input: "dom",
  NumberInput: "dom",
  Radio: "dom",
  SearchInput: "dom",
  Select: "dom",
  Slider: "dom",
  Switch: "dom",
  TagInput: "dom",
  Textarea: "dom",

  // Anything else the library or this package gives its own meaning. Listed
  // rather than merely omitted, so the gate can tell "considered" from "unseen".
  Avatar: "own", // person's display name, rendered as initials
  AvatarUpload: "own", // ditto, forwarded to Avatar
  Field: "own", // form path the renderer resolves and deletes
  FieldError: "own", // ditto
  Icon: "own", // icon identity, resolved against the icon set
  Repeater: "own", // form-array path, e.g. `links.0`
  ViewTransition: "own", // CSS view-transition-name
};

/**
 * Resolves the `idScope` prop to a prefix, or `""` for no scoping.
 *
 * A host's own string is passed through as written. The whole point of naming
 * one is that the final id is constructible from outside, so rewriting it would
 * break the very lookup the host named it for — and stripping characters would
 * quietly collapse two distinct scopes (`turn/7` and `turn7`, or every
 * non-Latin key at once) into one.
 *
 * The generated prefix is normalised, because that decoration is React's rather
 * than anyone's intent, and across the `^19.0.0` peer range it has included
 * characters no CSS selector can address.
 */
export function normalizeIdScope(scope: boolean | string | undefined, generated: string): string {
  if (scope === undefined || scope === false) return "";
  return scope === true ? generated.replace(/[^A-Za-z0-9_-]+/g, "") : scope.trim();
}

/** True when this component's prop carries a DOM id that scoping must rewrite. */
export function isIdScopedProp(component: string, key: string): boolean {
  if (key === "name") return NAME_PROP_MEANING[component] === "dom";
  return ID_REF_PROPS.has(key);
}

/**
 * Prefixes a resolved id value, token by token.
 *
 * Numbers count: `$each` over rows with a numeric `id` pulled out by `$ref` is
 * the shape a generator actually emits, and skipping those would opt the
 * commonest case straight back out of the fix. Non-primitives do not — that is
 * what keeps `FormProvider`'s `FormApi` out of the rule's way.
 */
export function scopeIdValue(value: unknown, prefix: string): unknown {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string") return value;

  // No empty-string special case: `"".split(/\s+/).filter(Boolean)` is already
  // empty, and the guard below returns the value untouched.
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return value;
  return tokens.map((token) => `${prefix}-${token}`).join(" ");
}
