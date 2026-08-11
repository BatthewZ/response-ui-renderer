import {
  ALLOWED_AS_ELEMENTS,
  type ComponentContract,
  EVENT_ACTION_NAMES,
  HEADING_LEVELS,
  isElementProp,
  isForbiddenProp,
  isHeadingLevelProp,
  type PropDoc,
} from "../spec";
import { literalUnion } from "./catalog";

/**
 * What the inspector puts on screen for one prop.
 *
 * Chosen from the prop's own declared type and from the contracts, never from
 * its name — which is the only way a host's registered component gets the same
 * inspector the built-in library gets. A prop bounded to a set of values
 * becomes buttons; a boolean becomes a switch; a handler becomes an action
 * picker over the vocabulary the renderer actually dispatches.
 */
export type PropControl =
  | { kind: "enum"; values: readonly string[] }
  | { kind: "boolean" }
  | { kind: "number" }
  | { kind: "text" }
  /** Typed `ReactNode`: a string is a legal value and renders as its text. */
  | { kind: "node" }
  /** A handler. The document's spelling of one is `{ "action": … }`. */
  | { kind: "action"; actions: readonly string[] }
  /** Anything JSON can hold but no control can shape — column defs, option lists. */
  | { kind: "json"; type: string }
  /** Nothing a document may set at all. */
  | { kind: "forbidden"; reason: string };

const NUMBER = /^\s*number\s*$/;
const BOOLEAN = /^\s*boolean\s*$/;
const STRING = /^\s*string\s*$/;
const NODE = /\bReactNode\b/;
const HANDLER = /=>/;

export type PropControlOptions = {
  /** The component's own contract, for `propEnums` and the sink-prop tables. */
  contract?: ComponentContract;
  /** Values the contract bounds this prop to, if any. */
  values?: readonly string[];
};

/**
 * The control for a prop.
 *
 * Order matters. The contract's enumerated values win over the declared type,
 * because they are generated from the library's own declarations and the type
 * string is a rendering of them that may have been clipped. The element and
 * heading-level props come next: both are typed as unions upstream, but a
 * document has no compiler, and the renderer constrains them to an allowlist —
 * offering the allowlist is the difference between a control that agrees with
 * the validator and one that invites a warning.
 */
export function controlFor(prop: PropDoc, options: PropControlOptions = {}): PropControl {
  const { contract = {}, values = contract.propEnums?.[prop.key] } = options;

  if (isForbiddenProp(prop.key)) {
    return { kind: "forbidden", reason: "the renderer never passes this to an element" };
  }
  if (values && values.length > 0) return { kind: "enum", values };
  if (isElementProp(prop.key, contract)) return { kind: "enum", values: [...ALLOWED_AS_ELEMENTS] };
  if (isHeadingLevelProp(prop.key, contract)) return { kind: "enum", values: HEADING_LEVELS };

  const coercion = contract.coercions?.[prop.key];
  if (coercion !== undefined) return { kind: "json", type: prop.type };

  const literals = literalUnion(prop.type);
  if (literals) return { kind: "enum", values: literals };

  if (BOOLEAN.test(prop.type)) return { kind: "boolean" };
  if (NUMBER.test(prop.type)) return { kind: "number" };
  if (STRING.test(prop.type)) return { kind: "text" };
  if (HANDLER.test(prop.type)) return { kind: "action", actions: [...EVENT_ACTION_NAMES] };
  if (NODE.test(prop.type)) return { kind: "node" };

  return { kind: "json", type: prop.type || "unknown" };
}

/**
 * Whether a value came from somewhere the inspector must not overwrite.
 *
 * A document opened into the builder may bind a prop to `data`, to a form field
 * or to an action. Those are the parts of the format the builder does not
 * author, and a text field rendered over one would replace a binding with a
 * literal the moment it was focused and blurred. They are shown, and shown as
 * what they are.
 */
export function isBoundValue(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return "$ref" in value || "$field" in value || "action" in value || "$node" in value;
}

/** How a bound value reads in one line, where the control would have been. */
export function describeBinding(value: unknown): string {
  if (typeof value !== "object" || value === null) return String(value);
  const record = value as Record<string, unknown>;
  if (typeof record.$ref === "string") return `bound to ${record.$ref}`;
  if (typeof record.$field === "string") return `field ${record.$field}`;
  if (typeof record.action === "string") return `action ${record.action}`;
  if ("$node" in record) return "a nested node";
  return "a bound value";
}

/** Props worth showing before the reader asks for the rest. */
export function isPrimaryProp(prop: PropDoc, control: PropControl): boolean {
  if (!prop.optional) return true;
  return control.kind === "enum" || control.kind === "boolean";
}
