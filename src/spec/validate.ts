import { IDENTITY_CHECKED_PARENTS } from "../registry/child-introspection";
import { defaultContracts } from "../registry/default-contracts";
import {
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

/** Keys that must never reach `createElement`, whatever the document says. */
export const FORBIDDEN_PROPS: ReadonlySet<string> = new Set([
  "dangerouslySetInnerHTML",
  "ref",
  "key",
  "__proto__",
  "constructor",
  "prototype",
]);

/** Props whose value is a URL, and so can smuggle script execution. */
const URL_PROPS: ReadonlySet<string> = new Set([
  "href",
  "src",
  "action",
  "formAction",
  "poster",
  "data",
  "srcSet",
  "background",
]);

const DANGEROUS_SCHEME = /^(?:javascript|vbscript|data:text\/html)/i;

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

/** True when a URL string would execute script if the browser followed it. */
export function isDangerousUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return DANGEROUS_SCHEME.test(stripSchemeNoise(value));
}

export function isUrlProp(key: string): boolean {
  return URL_PROPS.has(key);
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
 * Optimal string alignment distance — Levenshtein, plus **transposition of two
 * adjacent characters as a single edit**.
 *
 * Exists so an unknown name is *actionable*: "unknown component" alone leaves an
 * author re-reading a 100-name catalogue to find the one they meant. The
 * transposition case is not a refinement — `"Cadr"` for `"Card"` is two
 * substitutions under plain Levenshtein, so the commonest typo of all would be
 * the one shape that got no suggestion.
 */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let twoAgo: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoAgo[j - 2] + 1);
      }
      current[j] = value;
    }
    twoAgo = previous;
    previous = current;
  }
  return previous[b.length];
}

/** How many leading characters two already-lower-cased names share. */
function sharedPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

/** The registered name a misspelling most likely meant, if one is close enough. */
function closestName(name: string, names: Iterable<string>): string | undefined {
  const limit = name.length <= 4 ? 1 : 2;
  // Compared lower-cased, so a wrong capital costs nothing. A generator that
  // writes `"cadr"` has made one mistake, not two, and charging it for the case
  // pushed the commonest pair of slips past every sane threshold at once.
  const target = name.toLowerCase();

  let best: string | undefined;
  let bestDistance = limit + 1;
  let bestRank = -1;
  const dotted = name.includes(".");
  for (const candidate of names) {
    // Asymmetric on purpose. A root is no fix for a misspelled part — `"Card"`
    // for `"Table.Rw"` sends an author to a component that cannot go where they
    // put it. But a *part* is very often the fix for a dotless name: dropping
    // the dot is the likeliest slip anyone carrying a PascalCase mental model
    // makes, and `"AccordionItem"` is one edit from a real, renderable name.
    if (dotted && !candidate.includes(".")) continue;
    const lower = dotted ? candidate.toLowerCase() : candidate.toLowerCase().replace(/\./g, "");
    const distance = editDistance(target, lower, limit);
    if (distance > limit || distance > bestDistance) continue;
    // A transposition and a substitution both cost 1, so ties are common and
    // the first candidate seen is not the likelier word: `"Tabel"` tied `Label`
    // with `Table` and, in registry order, sent the author to the wrong one.
    // Prefer the longer shared opening, then the closer length.
    const rank = sharedPrefix(target, lower) * 100 - Math.abs(target.length - lower.length);
    if (distance < bestDistance || rank > bestRank) {
      bestDistance = distance;
      bestRank = rank;
      best = candidate;
    }
  }
  return best;
}

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

function checkProps(
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

  for (const [key, value] of Object.entries(props)) {
    if (FORBIDDEN_PROPS.has(key)) {
      at.warn(`${path}.${key}`, `prop "${key}" is not allowed and will be dropped`);
    }
    if (isUrlProp(key) && isDangerousUrl(value)) {
      at.warn(`${path}.${key}`, "URL scheme is not allowed and will be dropped");
    }
    if (isPlainObject(value) && "action" in value) {
      checkEventHandler(value, `${path}.${key}`, at, "warning");
    }
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
      checkProps(props, `${path}.props`, depth, at);
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
