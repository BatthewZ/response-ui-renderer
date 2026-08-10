import { IDENTITY_CHECKED_PARENTS } from "../registry/child-introspection";
import { defaultContracts } from "../registry/default-contracts";
import {
  closestName,
  type ComponentContract,
  type ComponentContracts,
  componentNamesOf,
  contractFor,
  DIALOG_COMPONENTS,
  ownProp,
  PROP_ENUMS,
  type RegistryLike,
} from "./contracts";
import {
  type DataBinding,
  EVENT_ACTION_NAMES,
  type EventAction,
  type EventHandlerSpec,
  type FormDef,
  isNodeValue,
  type ViewNode,
  type ViewSpec,
} from "./types";

/**
 * Dependency-free validation.
 *
 * `@batthewz/response-ui-react-components` states that consumers bring their own
 * validator and the library must not depend on one. This package honours that:
 * zero runtime dependencies, so a Zod/Valibot/ArkType consumer never ends up
 * with a second validator in their bundle.
 */

/**
 * `"error"` — the document does not conform to the format. `ok` is false.
 * `"warning"` — it conforms, but names something the renderer will refuse at
 * render time: a forbidden prop, a script-bearing URL, an unknown action inside
 * a prop, a theme override that is not a custom property, nesting past the
 * depth cap. The document still renders; the offending piece is dropped.
 *
 * The split exists so `ok` means exactly one thing — conformance — and can be
 * mirrored precisely by the optional Zod schema, which is single-tier.
 */
export type IssueSeverity = "error" | "warning";

export type ValidationIssue = {
  path: string;
  message: string;
  severity: IssueSeverity;
};

export type ValidationResult =
  | { ok: true; spec: ViewSpec; issues: ValidationIssue[] }
  | { ok: false; issues: ValidationIssue[] };

/** Issues that make a document non-conforming. */
export const errorsOf = (issues: readonly ValidationIssue[]): ValidationIssue[] =>
  issues.filter((issue) => issue.severity === "error");

/** Issues the renderer acts on without refusing the document. */
export const warningsOf = (issues: readonly ValidationIssue[]): ValidationIssue[] =>
  issues.filter((issue) => issue.severity === "warning");

/**
 * Bounds recursion so a hostile or runaway document cannot exhaust the stack.
 * Matches the render-time guard in NodeRenderer, which renders a diagnostic at
 * the cap rather than refusing — hence a warning, not an error.
 */
export const MAX_NODE_DEPTH = 50;

/** Every action the renderer dispatches. Shared so nothing re-lists them. */
export const EVENT_ACTIONS: ReadonlySet<string> = new Set<EventAction>(EVENT_ACTION_NAMES);

const BINDING_TYPES: ReadonlySet<string> = new Set(["static", "api", "source"]);

/**
 * Re-exported from `./contracts`, where they moved so that `defaultContracts`
 * can fold them in without a cycle. They are part of this module's long-
 * standing surface and the shape a prompt builder wants, so they stay reachable
 * from here.
 */
export { DIALOG_COMPONENTS, PROP_ENUMS };

/**
 * The values this prop accepts, if it is bounded to a fixed set.
 *
 * Reads the same contracts the validator does, and defaults to the same ones —
 * so it answers for a host's own components too, and cannot disagree with the
 * warning `validateViewSpec` would raise for the very same prop. Reading
 * `PROP_ENUMS` directly instead would make this exported helper and the
 * validator two sources of truth for one fact.
 */
export function enumeratedValues(
  component: string,
  prop: string,
  contracts: ComponentContracts = defaultContracts,
): readonly string[] | undefined {
  return ownProp(contractFor(contracts, component).propEnums, prop);
}

/**
 * Keys that must never reach `createElement`, whatever the document says.
 *
 * `srcDoc` sits here rather than among the URL props because it is not a URL:
 * it is a whole HTML document as an attribute value, and an `<iframe srcdoc>`
 * runs in the embedder's own origin. It is `dangerouslySetInnerHTML` spelled as
 * a plain DOM attribute, so it gets the same answer. Both casings are named —
 * React canonicalises `srcDoc`, but passes an unrecognised lowercase `srcdoc`
 * through to `setAttribute` verbatim, where the HTML parser reads it just the
 * same.
 */
export const FORBIDDEN_PROPS: ReadonlySet<string> = new Set([
  "dangerouslySetInnerHTML",
  "ref",
  "key",
  "__proto__",
  "constructor",
  "prototype",
  "srcDoc",
  "srcdoc",
]);

/**
 * DOM attributes whose value a browser resolves as a URL and then fetches or
 * navigates to.
 *
 * `ping`, `cite`, `manifest` and `xlinkHref` were absent while the rest were
 * listed, which is the failure this whole set invites: it is an inventory of
 * places to look, and an inventory is only ever as good as the last person to
 * extend it. The bag scoping and the per-component table below narrow the
 * ways one can be missed; `contracts.test.ts` is what catches a new one.
 */
export const URL_PROPS: ReadonlySet<string> = new Set([
  "href",
  "src",
  "action",
  "formAction",
  "poster",
  "srcSet",
  "background",
  "ping",
  "cite",
  "manifest",
  "xlinkHref",
]);

/**
 * `data` is deliberately absent, and it used to be here.
 *
 * It is a URL on exactly one element, `<object>`, which a document can no
 * longer name — `ALLOWED_AS_ELEMENTS` refuses it and no library component
 * renders one. So the entry guards nothing, while `data` is the prop name
 * `DataTable` and `VirtualizedDataTable` take their rows under. Listing it cost
 * a real payload: `data: ["Revenue: 4"]` reads as the scheme `Revenue:` and the
 * whole prop was dropped, silently.
 *
 * A host component that really does render `<object data={…}>` declares it with
 * `urlProps` on its contract, which is what that field is for.
 */

/**
 * The DOM lowercases attribute names, so these comparisons must too.
 *
 * `HREF` is not a React prop, so React hands it to `setAttribute`, where an
 * HTML document lowercases it into the real `href`. A case-sensitive set let
 * `{"as": "a", "HREF": "javascript:…"}` render a live link, measured in
 * Chrome and clicking through to execution — the reported defect over again, on
 * the universal names themselves, and with no browser backstop this time.
 *
 * Renamed props are matched exactly by contrast: those are read by the
 * component's own destructuring, which is case-sensitive, so a mis-cased one
 * never reaches an element at all.
 */
const lowerSet = (keys: Iterable<string>): ReadonlySet<string> =>
  new Set([...keys].map((key) => key.toLowerCase()));

const URL_PROPS_LOWER = lowerSet(URL_PROPS);

/**
 * The forbidden keys that are DOM attributes rather than React or JS spellings,
 * and so need the same case-insensitivity. `ref`, `key`, `constructor` and
 * `prototype` are read by React or by the language, both case-sensitive;
 * `SRCDOC` is read by the HTML parser, which is not.
 */
const FORBIDDEN_ATTRS_LOWER = lowerSet(["srcDoc", "dangerouslySetInnerHTML"]);

/**
 * Props the library spreads wholesale onto an element — `imgProps`,
 * `tableProps`, `viewAllProps`. Their keys are DOM attributes, so `srcSet` one
 * level down is the same attribute as `srcSet` at the top.
 *
 * The suffix is the whole test, and it is the library's own convention: all
 * sixteen of its spread bags are named `…Props`, which `contracts.test.ts`
 * asserts. Scoping the nested check this way rather than applying it to every
 * nested key is not a shortcut — it is the difference between filtering
 * attributes and filtering *data*. `action`, `cite` and `src` are ordinary field
 * names and ordinary prose parses as a scheme, so an unscoped check emptied
 * `DataTable` cells holding `"Approve: pending review"` and `"s3://bucket/key"`.
 */
export function isAttributeBagProp(key: string): boolean {
  return key.length > "Props".length && key.endsWith("Props");
}

/** A DOM attribute name, at any depth inside a spread bag. */
export function isNestedUrlKey(key: string): boolean {
  return URL_PROPS_LOWER.has(key.toLowerCase());
}

/**
 * Keys refused inside a spread bag.
 *
 * `__proto__` is here and `ref`/`key` are not: those two are ordinary field
 * names on a data row, and dropping them would corrupt a legitimate row to no
 * benefit. `constructor` and `prototype` cannot be reached by assignment the
 * way `__proto__` can.
 */
export function isNestedForbiddenKey(key: string): boolean {
  return key === "__proto__" || FORBIDDEN_ATTRS_LOWER.has(key.toLowerCase());
}

/**
 * Schemes a document may put in an attribute that navigates or loads.
 *
 * An allowlist, not a denylist. This was three dangerous schemes, and every
 * measured bypass of it was a fourth: `data:image/svg+xml` (SVG is a document
 * and carries `onload`), `data:application/xhtml+xml`, `blob:`, `view-source:`.
 * `markdown-parse.ts` in the component library reached the same conclusion for
 * the same reason and states it plainly — enumerating what is dangerous is a
 * registry that keeps growing; enumerating what is safe is not. This mirrors
 * that decision deliberately, and `contracts.test.ts` holds the two to it.
 */
const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * The `data:` types that cannot carry script. `image/svg+xml` is deliberately
 * absent: SVG is a document, not a bitmap, and it holds `<script>` and
 * `onload=`.
 */
const SAFE_DATA_TYPE = /^data:image\/(?:png|jpeg|jpg|gif|webp|avif)[;,]/i;

/**
 * True for characters a browser ignores while parsing a URL scheme: C0/C1
 * controls, spaces, and zero-width marks. `java\tscript:` and `java\nscript:`
 * both navigate, so these are stripped before the scheme is compared — testing
 * the raw string alone is trivially bypassed.
 *
 * Expressed as code-point ranges rather than a regex character class, because a
 * regex containing control characters is itself a lint error, escaped or not.
 */
function isIgnoredInScheme(code: number): boolean {
  return (
    code <= 0x20 ||
    (code >= 0x7f && code <= 0xa0) ||
    (code >= 0x200b && code <= 0x200d) ||
    code === 0xfeff
  );
}

function stripSchemeNoise(value: string): string {
  let out = "";
  for (const char of value) {
    if (!isIgnoredInScheme(char.codePointAt(0) ?? 0)) out += char;
  }
  return out;
}

/**
 * The scheme, or null when the URL is relative. The pattern is anchored and its
 * alphabet is the scheme grammar itself, so `./a:b` and `/path?x=a:b` simply
 * fail to match.
 */
function schemeOf(url: string): string | null {
  const match = /^[a-z][a-z0-9+.-]*:/i.exec(url);
  return match ? match[0].toLowerCase() : null;
}

/**
 * What React will put in the attribute.
 *
 * Not `typeof value === "string"`. React stringifies whatever it is given, so
 * `href: ["vbscript:msgbox(1)"]` reached the DOM as that exact string while a
 * string-only guard read the array and returned "not a URL" — the shortest
 * bypass in the whole surface, and one that defeated the check on a prop it
 * already knew to inspect. `null`/`undefined` make React omit the attribute
 * entirely, so those alone are exempt.
 */
function asAttributeValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  // React joins an array with commas, so every element is a candidate scheme.
  // A non-primitive element stringifies to something inert, and `""` for it
  // keeps the commas — and so the positions — intact.
  if (Array.isArray(value)) {
    return value.map((item) => asAttributeValue(item) ?? "").join(",");
  }
  return undefined;
}

/**
 * True unless the value is one this package will vouch for as an attribute a
 * browser resolves.
 *
 * Named for the answer it gives the caller, which is "drop this". The bar is
 * *not* provable danger — it is provable safety, so an unrecognised scheme is
 * refused rather than waved through.
 *
 * The value is judged whole, including for the two list-valued attributes:
 * `srcSet` and `ping` hold several URLs, and only the first one's scheme is
 * read here. That is deliberate rather than overlooked — neither attribute
 * executes what it fetches, so the scheme is not the thing that matters about
 * them, and splitting on the separator would reject an ordinary `https:` URL
 * whose query happens to carry a comma and a colon.
 */
export function isDangerousUrl(value: unknown): boolean {
  const raw = asAttributeValue(value);
  if (raw === undefined) return false;
  // A URL carrying tab/LF/CR is refused rather than parsed: browsers delete
  // those before reading it, so the string judged here and the string the
  // browser follows would not be the same string.
  if (/[\t\n\r]/.test(raw)) return true;
  const scheme = schemeOf(stripSchemeNoise(raw));
  if (scheme === null) return false;
  if (ALLOWED_SCHEMES.has(scheme)) return false;
  return !(scheme === "data:" && SAFE_DATA_TYPE.test(stripSchemeNoise(raw)));
}

/**
 * Whether a prop's value lands in an attribute a browser resolves as a URL.
 *
 * `contract` carries the props a component renames on the way in —
 * `Swimlane.viewAllHref` and `AppShell.SidebarLink.to` are both an `href` by
 * the time they reach the DOM, and a check keyed only on the universal DOM
 * names never looked at either. Passing no contract keeps the universal answer,
 * which is what an unregistered or host-supplied component gets.
 */
export function isUrlProp(key: string, contract?: ComponentContract): boolean {
  // A component's own declaration wins both ways: `contentProps` says this name
  // is a slot here even though it is an attribute elsewhere, and `urlProps`
  // says this name is a destination even though it looks like nothing.
  if (contract?.contentProps?.includes(key)) return false;
  return URL_PROPS_LOWER.has(key.toLowerCase()) || (contract?.urlProps?.includes(key) ?? false);
}

/** Forbidden as a top-level prop, case-insensitively for the DOM spellings. */
export function isForbiddenProp(key: string): boolean {
  return FORBIDDEN_PROPS.has(key) || FORBIDDEN_ATTRS_LOWER.has(key.toLowerCase());
}

/**
 * Host elements a document may name through a polymorphic `as`.
 *
 * `as` is unconstrained upstream — it is `ElementType`, and the library is
 * right to leave it there, because in React the caller is the developer. Here
 * the caller is the document, and `as: "script"` with text children, or
 * `as: "iframe"` with `srcDoc`, is script execution that no URL filter can
 * reach: there is no URL in either.
 *
 * The rule, stated so the list can be checked against it: **every HTML element
 * that presents or structures content is here, and an element is left off only
 * because it loads, executes, or reinterprets what it is given.** That is
 * `script`, `iframe`, `object`, `embed`, `style`, `link`, `base`, `meta`,
 * `template` and `slot`, plus the foreign-content roots `svg` and `math`, whose
 * children follow different parsing rules than the ones every check here
 * assumes. Form controls, media and the text-level elements are all present:
 * refusing `as: "input"` or `as: "search"` would be a silent break for no
 * safety, and an earlier draft of this list did exactly that.
 */
export const ALLOWED_AS_ELEMENTS: ReadonlySet<string> = new Set([
  "a", "abbr", "address", "area", "article", "aside", "audio", "b", "bdi",
  "bdo", "blockquote", "br", "button", "canvas", "caption", "cite", "code",
  "col", "colgroup", "data", "datalist", "dd", "del", "details", "dfn",
  "dialog", "div", "dl", "dt", "em", "fieldset", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup",
  "hr", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main",
  "map", "mark", "menu", "meter", "nav", "ol", "optgroup", "option", "output",
  "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp",
  "search", "section", "select", "small", "source", "span", "strong", "sub",
  "summary", "sup", "table", "tbody", "td", "textarea", "tfoot", "th", "thead",
  "time", "tr", "track", "u", "ul", "var", "video", "wbr",
]);

/**
 * True for an `as` value the renderer will refuse to turn into an element.
 *
 * A non-string is refused too. Not `typeof value === "string" && !allowed` —
 * that is the very shape this change condemns two docblocks up, and it let a
 * non-string fall through untested. Absent is not refused: React treats a
 * missing `as` as "use the component's default", which is the same outcome a
 * refusal produces.
 */
export function isForbiddenAsElement(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return typeof value !== "string" || !ALLOWED_AS_ELEMENTS.has(value);
}

/** The universal name for the host element to render. */
export function isElementProp(key: string, contract?: ComponentContract): boolean {
  return key === "as" || (contract?.elementProps?.includes(key) ?? false);
}

/**
 * Props whose value is interpolated *into* a tag name rather than being one —
 * `Accordion.headingLevel` becomes `` `h${level}` ``.
 *
 * A separate field from `elementProps` because the value is a fragment, so the
 * element allowlist cannot judge it: `3` is legitimate and is not a tag. The
 * `h` prefix caps the damage at heading-shaped tags, so this is not script
 * execution — but `headingLevel: "eader"` rendered a `<header>` and
 * `headingLevel: "1><img src=x onerror=…>"` rendered a document-triggerable
 * error box, which is document control of the element either way.
 */
const HEADING_LEVELS: ReadonlySet<string> = new Set(["1", "2", "3", "4", "5", "6"]);

export function isForbiddenHeadingLevel(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return !HEADING_LEVELS.has(String(value));
  return typeof value !== "string" || !HEADING_LEVELS.has(value);
}

export function isHeadingLevelProp(key: string, contract?: ComponentContract): boolean {
  return contract?.headingLevelProps?.includes(key) ?? false;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

type Collector = {
  error: (path: string, message: string) => void;
  warn: (path: string, message: string) => void;
};

/** A collector plus what the caller told us the renderer will be holding. */
type Checker = Collector & {
  contracts: ComponentContracts;
  /** Absent when no registry was supplied — then no name can be judged unknown. */
  names?: ReadonlySet<string>;
};

/**
 * A component name the registry does not hold.
 *
 * A **warning**, not an error, and deliberately: `ok` means conformance and
 * nothing else, so that the Zod mirror — which cannot know a registry — can
 * agree with it exactly. The renderer already degrades here, rendering an
 * inline warning in the node's place, so this reports the same fact one stage
 * earlier, where a generator can still be asked for another document.
 */
function checkComponentName(component: string, path: string, at: Checker): void {
  if (at.names === undefined || at.names.has(component)) return;

  const dot = component.indexOf(".");
  const suggestion = closestName(component, at.names);
  const hint = suggestion === undefined ? "" : ` — did you mean "${suggestion}"?`;
  const outcome = `; the node renders an inline warning in its place${hint}`;

  if (dot !== -1 && at.names.has(component.slice(0, dot))) {
    at.warn(
      `${path}.component`,
      `"${component.slice(0, dot)}" has no compound part "${component.slice(dot + 1)}"${outcome}`,
    );
    return;
  }
  at.warn(`${path}.component`, `unknown component "${component}"${outcome}`);
}

function checkEventHandler(value: unknown, path: string, at: Collector, severity: IssueSeverity): void {
  const report = severity === "error" ? at.error : at.warn;

  if (!isPlainObject(value)) {
    report(path, "event handler must be an object");
    return;
  }
  const action = value.action;
  if (typeof action !== "string") {
    report(`${path}.action`, "action must be a string");
    return;
  }
  if (!EVENT_ACTIONS.has(action)) {
    report(
      `${path}.action`,
      `unknown action "${action}" (expected one of: ${[...EVENT_ACTIONS].join(", ")})`,
    );
  }
  if (value.payload !== undefined && !isPlainObject(value.payload)) {
    report(`${path}.payload`, "payload must be an object");
  }
}

/**
 * Checks that depend on the component rather than on any prop being present —
 * so they still fire on a node that declares no props at all. Takes the node's
 * own path: what it reports is a fact about the node, and only some of those
 * facts are addressable at a prop.
 */
function checkComponentContract(
  component: string,
  contract: ComponentContract,
  props: Record<string, unknown>,
  children: readonly unknown[],
  path: string,
  at: Collector,
): void {
  // A radio's `value` is the option's identity, so it cannot also carry the
  // binding — the two spellings collide on one key. The bare form is the only
  // one that can express both.
  if (component === "Radio" && isPlainObject(props.value) && "$field" in props.value) {
    at.warn(
      `${path}.props.value`,
      'Radio needs its own "value"; bind it with the bare form — props: { "value": "…", "$field": "form.field" }',
    );
  }

  if (contract.dialog && typeof props.id !== "string") {
    at.warn(
      `${path}.props.id`,
      `${component} needs a literal string "id" for openDialog/closeDialog to target it; without one nothing can open it`,
    );
  }

  // A prop the library types as a fixed set of strings is read by looking the
  // value up in a table of classes. A miss returns nothing, so the component
  // renders with that dimension simply absent — no error, no fallback, and
  // nothing in the DOM to notice. JSON has no compiler to catch it, so this is.
  for (const [key, value] of Object.entries(props)) {
    if (typeof value !== "string") continue;
    const allowed = ownProp(contract.propEnums, key);
    if (allowed && !allowed.includes(value)) {
      at.warn(
        `${path}.props.${key}`,
        `"${value}" is not one of ${component}.${key}'s values (${allowed.join(", ")}); the component will render as if it were unset`,
      );
    }
  }

  // This root parses its children as source text, so a composed child has
  // nothing to contribute and is dropped — and a document that has none at all,
  // by either spelling, hands the parser nothing to parse.
  if (contract.textChildren !== undefined) {
    const composed = children.flatMap((child) => composedChildNames(child, 0));
    if (composed.length > 0) {
      at.warn(
        `${path}.children`,
        `${component} parses its children as text; ${composed.join(", ")} contributes none and will be dropped — put the source in a string, or in props.children`,
      );
    } else if (children.length === 0 && props.children === undefined) {
      at.warn(
        `${path}.children`,
        `${component} needs its source text, as children or as props.children; without it there is nothing to parse`,
      );
    }
  }

  // These decide something by comparing a child's element type, which can never
  // match through the renderer — the child's type is always the renderer's own
  // node component. The feature is not broken, it just has to be stated rather
  // than inferred, so say so instead of leaving it silently absent.
  const hint = ownProp(IDENTITY_CHECKED_PARENTS, component);
  if (hint !== undefined && identityCheckWillFail(component, props, children)) {
    at.warn(path, `${component}: ${hint}`);
  }
}

const childComponent = (child: unknown): string | undefined =>
  isPlainObject(child) && typeof child.component === "string" ? child.component : undefined;

/**
 * Component names a text-children root would end up holding, seen through the
 * wrappers that produce text.
 *
 * `childrenToText` resolves `$ref`, `$cond` and `$each` to *their* text, so a
 * component nested inside one contributes nothing exactly as a direct component
 * child does — and `children-text.ts` says in as many words that the validator
 * names this instead of inventing text for it. Reading `child.component` off the
 * child alone kept that promise only for the unwrapped spelling, so a `$each`
 * over component nodes rendered an empty string with nothing reported anywhere.
 */
function composedChildNames(child: unknown, depth: number): string[] {
  if (depth > MAX_PROP_DEPTH || !isPlainObject(child)) return [];
  const direct = childComponent(child);
  if (direct !== undefined) return [direct];
  if ("$each" in child) return composedChildNames(child.node, depth + 1);
  if ("$cond" in child) {
    return [
      ...composedChildNames(child.then, depth + 1),
      ...composedChildNames(child.else, depth + 1),
    ];
  }
  return [];
}

const childProps = (child: unknown): Record<string, unknown> =>
  isPlainObject(child) && isPlainObject(child.props) ? child.props : {};

/**
 * Only warns when the document is actually relying on the inference — a `Table`
 * with no `striped` never needed the row numbering, and a warning it cannot act
 * on teaches an author to ignore warnings.
 */
function identityCheckWillFail(
  component: string,
  props: Record<string, unknown>,
  children: readonly unknown[],
): boolean {
  const named = (name: string) => children.some((child) => childComponent(child) === name);
  const missingProp = (name: string, prop: string) =>
    children.some((child) => childComponent(child) === name && childProps(child)[prop] === undefined);

  switch (component) {
    case "Hero":
      return props.overlay === undefined && named("Hero.Background");
    case "AvatarGroup":
      return props.size !== undefined && missingProp("Avatar", "size");
    case "Table.Body":
      return missingProp("Table.Row", "index");
    case "Breadcrumbs":
      return named("Breadcrumbs.Divider");
    case "Combobox.Content":
      return missingProp("Combobox.Item", "index");
    default:
      return false;
  }
}

/**
 * Props are validated as policy, not structure: the Zod mirror types `props` as
 * an open record, so flagging these as errors would make the two validators
 * disagree about conformance. The renderer drops each offending prop.
 */
/**
 * Bounds every walk through a value rather than a node — a prop's contents, and
 * the wrappers under a text-children root. Both mirror the renderer's own cap.
 */
const MAX_PROP_DEPTH = 20;

/**
 * `$node` puts a whole ViewNode in a prop position, and the renderer renders it
 * through the very same path it renders a child — so it has to be checked the
 * same way. Skipped, a misspelled component in a `DataTable` column's `render`
 * template or a `Wizard` step's `content` validated clean and surfaced only as
 * an inline warning once the page had drawn, which is the exact failure
 * validation exists to pre-empt.
 *
 * Only the `$node` marker is followed. The `$` prefix is reserved by the wire
 * format, so finding one inside an array is unambiguous, while everything else
 * in a prop is ordinary data and must stay data — a row that happens to carry
 * a `component` key is a row.
 */
function checkNodeValues(
  value: unknown,
  path: string,
  depth: number,
  valueDepth: number,
  /** Already demoted by `checkProps` — see the note there. */
  at: Checker,
): void {
  if (valueDepth > MAX_PROP_DEPTH) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      checkNodeValues(item, `${path}[${index}]`, depth, valueDepth + 1, at),
    );
    return;
  }
  if (!isPlainObject(value)) return;
  if (isNodeValue(value)) {
    checkNode(value.$node, `${path}.$node`, depth + 1, at);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    checkNodeValues(item, `${path}.${key}`, depth, valueDepth + 1, at);
  }
}

/**
 * The nested half of the prop checks, mirroring `scrubBag` in the renderer.
 *
 * Entered only for a prop the component spreads onto an element, because only
 * there are the keys DOM attributes. Walking every nested key instead made this
 * warn about `DataTable` rows holding `"Approve: pending review"` — data, not a
 * URL — which is the same mistake as filtering them.
 */
function checkNestedSinks(value: unknown, path: string, valueDepth: number, at: Checker): void {
  // Capped like every other walk here. Uncapped, a deeply nested document made
  // `validateViewSpec` throw `RangeError: Maximum call stack size exceeded` —
  // in the one function whose job is to survive hostile input. The cap is the
  // renderer's, so the two agree on what they will and will not look at, and
  // this side never warns "will be dropped" about a value the renderer keeps.
  if (valueDepth > MAX_PROP_DEPTH) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      checkNestedSinks(item, `${path}[${index}]`, valueDepth + 1, at),
    );
    return;
  }
  if (!isPlainObject(value) || isNodeValue(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (isNestedForbiddenKey(key)) {
      at.warn(`${path}.${key}`, `"${key}" is not allowed and will be dropped`);
      continue;
    }
    if (isNestedUrlKey(key) && isDangerousUrl(item)) {
      at.warn(`${path}.${key}`, "URL scheme is not allowed and will be dropped");
      continue;
    }
    checkNestedSinks(item, `${path}.${key}`, valueDepth + 1, at);
  }
}

function checkProps(
  component: string,
  props: Record<string, unknown>,
  path: string,
  depth: number,
  at: Checker,
): void {
  // Everything found *inside* a prop is policy, not structure — including a
  // malformed `$node`, which the renderer degrades to a diagnostic exactly as
  // it degrades a malformed child. `checkNode` reports structure as errors, so
  // descending into a prop with it unchanged made `ok` false for documents the
  // Zod mirror accepts, breaking the one thing the two validators must agree
  // on. Demote before descending rather than teaching `checkNode` a severity:
  // the position decides the tier, not the check.
  const asPolicy: Checker = { ...at, error: at.warn };

  const contract = contractFor(at.contracts, component);

  for (const [key, value] of Object.entries(props)) {
    if (isForbiddenProp(key)) {
      at.warn(`${path}.${key}`, `prop "${key}" is not allowed and will be dropped`);
    }
    // The literal, not the resolved value — a `$ref` is an object here and this
    // side cannot resolve it. The renderer re-runs the same test on what the
    // reference produced, which is what actually stops an indirect URL; this
    // reports the ones a document states outright, one stage earlier.
    if (isUrlProp(key, contract) && isDangerousUrl(value)) {
      at.warn(`${path}.${key}`, "URL scheme is not allowed and will be dropped");
    }
    if (isElementProp(key, contract) && isForbiddenAsElement(value)) {
      at.warn(`${path}.${key}`, "element is not allowed and will be dropped");
    }
    if (isHeadingLevelProp(key, contract) && isForbiddenHeadingLevel(value)) {
      at.warn(`${path}.${key}`, "heading level must be 1-6 and will be dropped");
    }
    if (isPlainObject(value) && "action" in value) {
      checkEventHandler(value, `${path}.${key}`, at, "warning");
    }
    if (isAttributeBagProp(key)) checkNestedSinks(value, `${path}.${key}`, 0, at);
    checkNodeValues(value, `${path}.${key}`, depth, 0, asPolicy);
  }
}

function checkNode(node: unknown, path: string, depth: number, at: Checker): void {
  if (depth > MAX_NODE_DEPTH) {
    at.warn(path, `node nesting exceeds ${MAX_NODE_DEPTH} levels and will not render past it`);
    return;
  }
  if (typeof node === "string") return;
  if (!isPlainObject(node)) {
    at.error(path, "node must be a string or an object");
    return;
  }

  if ("$ref" in node) {
    if (typeof node.$ref !== "string") at.error(`${path}.$ref`, "$ref must be a string");
    return;
  }

  if ("$each" in node) {
    if (typeof node.$each !== "string") at.error(`${path}.$each`, "$each must be a string");
    if (typeof node.as !== "string" || node.as.length === 0) {
      at.error(`${path}.as`, "as must be a non-empty string");
    }
    if (node.node === undefined) at.error(`${path}.node`, "node is required");
    else checkNode(node.node, `${path}.node`, depth + 1, at);
    return;
  }

  if ("$cond" in node) {
    if (typeof node.$cond !== "string") at.error(`${path}.$cond`, "$cond must be a string");
    if (node.then === undefined) at.error(`${path}.then`, "then is required");
    else checkNode(node.then, `${path}.then`, depth + 1, at);
    if (node.else !== undefined) checkNode(node.else, `${path}.else`, depth + 1, at);
    return;
  }

  if ("component" in node) {
    if (typeof node.component !== "string" || node.component.length === 0) {
      at.error(`${path}.component`, "component must be a non-empty string");
    }
    const props = isPlainObject(node.props) ? node.props : undefined;
    if (node.props !== undefined && props === undefined) {
      at.error(`${path}.props`, "props must be an object");
    } else if (props) {
      checkProps(
        typeof node.component === "string" ? node.component : "",
        props,
        `${path}.props`,
        depth,
        at,
      );
    }
    if (typeof node.component === "string") {
      const children = Array.isArray(node.children) ? node.children : [];
      checkComponentName(node.component, path, at);
      checkComponentContract(
        node.component,
        contractFor(at.contracts, node.component),
        props ?? {},
        children,
        path,
        at,
      );
    }
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) at.error(`${path}.children`, "children must be an array");
      else {
        node.children.forEach((child, i) =>
          checkNode(child, `${path}.children[${i}]`, depth + 1, at),
        );
      }
    }
    return;
  }

  at.error(path, 'node must have one of: "component", "$ref", "$each", "$cond"');
}

function checkBinding(value: unknown, path: string, at: Collector): void {
  if (!isPlainObject(value)) {
    at.error(path, "data binding must be an object");
    return;
  }
  const type = value.type;
  if (typeof type !== "string" || !BINDING_TYPES.has(type)) {
    at.error(`${path}.type`, `binding type must be one of: ${[...BINDING_TYPES].join(", ")}`);
    return;
  }
  if (type === "static" && !("value" in value)) {
    at.error(`${path}.value`, "static binding requires value");
  }
  if (type === "api") {
    if (typeof value.endpoint !== "string") {
      at.error(`${path}.endpoint`, "api binding requires endpoint");
    }
    if (value.method !== undefined && typeof value.method !== "string") {
      at.error(`${path}.method`, "method must be a string");
    }
    if (value.headers !== undefined) {
      if (!isPlainObject(value.headers)) {
        at.error(`${path}.headers`, "headers must be an object");
      } else {
        for (const [name, header] of Object.entries(value.headers)) {
          if (typeof header !== "string") {
            at.error(`${path}.headers.${name}`, "header must be a string");
          }
        }
      }
    }
  }
  if (type === "source") {
    if (typeof value.source !== "string") {
      at.error(`${path}.source`, "source binding requires source");
    }
    if (value.params !== undefined && !isPlainObject(value.params)) {
      at.error(`${path}.params`, "params must be an object");
    }
  }
}

function checkForm(value: unknown, path: string, at: Collector): void {
  if (!isPlainObject(value)) {
    at.error(path, "form must be an object");
    return;
  }
  if (!isPlainObject(value.fields)) {
    at.error(`${path}.fields`, "fields must be an object");
  } else {
    for (const [name, field] of Object.entries(value.fields)) {
      if (!isPlainObject(field)) {
        at.error(`${path}.fields.${name}`, "field must be an object");
        continue;
      }
      if (!("initialValue" in field)) {
        at.error(`${path}.fields.${name}.initialValue`, "initialValue is required");
      }
      if (field.validation !== undefined && !isPlainObject(field.validation)) {
        at.error(`${path}.fields.${name}.validation`, "validation must be an object");
      }
    }
  }
  // Declared handlers are structural: the Zod mirror types them with an enum.
  if (value.onSubmit !== undefined) {
    checkEventHandler(value.onSubmit, `${path}.onSubmit`, at, "error");
  }
}

export type ValidationOptions = {
  /**
   * What the renderer will be holding — a `ComponentRegistry`, or just the
   * addressable names out of one (`listComponentNames(registry)`), which is the
   * form that survives being sent to a validation service.
   *
   * **Supply it and a name the registry does not hold is reported**, with the
   * nearest registered name when there is one. Omit it and no name is judged:
   * the validator cannot tell a typo from a component it has never been told
   * about, and inventing warnings for a host's own components would be worse
   * than staying quiet.
   */
  registry?: Iterable<string> | RegistryLike;
  /**
   * Per-component facts to check against. Defaults to `defaultContracts` —
   * everything known about `@batthewz/response-ui-react-components`.
   *
   * Pass `extendContracts(defaultContracts, yours)` to keep those and add your
   * own; pass a bare object to check against only what it names.
   */
  contracts?: ComponentContracts;
};

/**
 * Validates an untrusted document.
 *
 * `ok: false` means the document does not conform and should be rejected.
 * `ok: true` with warnings means it renders, minus whatever each warning names.
 * The renderer itself never consults this — it degrades per node — so validation
 * is a gate you choose to put in front of it.
 *
 * The name check, every bounded prop value, the dialog-needs-an-id check and the
 * text-children checks all read `options`, so a host's own components are
 * checked the way the built-in ones are. Two rules are **not** reachable from a
 * contract and stay specific to the peer library: `Radio`'s bare-form `$field`
 * spelling, and the parents whose child identity checks cannot survive a
 * renderer. Both encode per-component structure rather than data — which child,
 * which prop — so expressing them as a contract field would mean shipping a
 * predicate, and a warning an author cannot act on teaches them to ignore
 * warnings.
 */
export function validateViewSpec(
  input: unknown,
  options: ValidationOptions = {},
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const at: Checker = {
    error: (path, message) => issues.push({ path, message, severity: "error" }),
    warn: (path, message) => issues.push({ path, message, severity: "warning" }),
    contracts: options.contracts ?? defaultContracts,
    names: options.registry === undefined ? undefined : componentNamesOf(options.registry),
  };

  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: [{ path: "", message: "spec must be an object", severity: "error" }],
    };
  }

  if (input.version !== 1) at.error("version", "version must be the number 1");
  if (typeof input.title !== "string" || input.title.length === 0) {
    at.error("title", "title must be a non-empty string");
  } else if (input.title.length > 200) {
    at.error("title", "title must be at most 200 characters");
  }
  if (input.description !== undefined && typeof input.description !== "string") {
    at.error("description", "description must be a string");
  }
  if (input.theme !== undefined && typeof input.theme !== "string") {
    at.error("theme", "theme must be a string");
  }

  if (input.themeOverrides !== undefined) {
    if (!isPlainObject(input.themeOverrides)) {
      at.error("themeOverrides", "themeOverrides must be an object");
    } else {
      for (const [key, value] of Object.entries(input.themeOverrides)) {
        if (typeof value !== "string") {
          at.error(`themeOverrides.${key}`, "value must be a string");
        } else if (!key.startsWith("--")) {
          at.warn(
            `themeOverrides.${key}`,
            "key must be a CSS custom property starting with '--'; it will be ignored",
          );
        }
      }
    }
  }

  if (input.data !== undefined) {
    if (!isPlainObject(input.data)) at.error("data", "data must be an object");
    else {
      for (const [key, binding] of Object.entries(input.data)) {
        checkBinding(binding, `data.${key}`, at);
      }
    }
  }

  if (input.forms !== undefined) {
    if (!isPlainObject(input.forms)) at.error("forms", "forms must be an object");
    else {
      for (const [key, form] of Object.entries(input.forms)) {
        checkForm(form, `forms.${key}`, at);
      }
    }
  }

  if (input.state !== undefined && !isPlainObject(input.state)) {
    at.error("state", "state must be an object");
  }

  if (input.root === undefined) at.error("root", "root is required");
  else checkNode(input.root, "root", 0, at);

  const ok = errorsOf(issues).length === 0;
  return ok ? { ok: true, spec: input as unknown as ViewSpec, issues } : { ok: false, issues };
}

/**
 * Narrowing helper for consumers that only need a yes/no.
 *
 * Takes no options, and cannot usefully: everything they add — an unknown
 * component name above all — lands in the warning tier by design, so none of it
 * can move this answer. Call `validateViewSpec` and read `issues` when you want
 * to know about a typo.
 */
export function isViewSpec(input: unknown): input is ViewSpec {
  return validateViewSpec(input).ok;
}

export type { DataBinding, EventHandlerSpec, FormDef, ViewNode, ViewSpec };
