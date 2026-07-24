import type { ElementType } from "react";

export type RegistryEntry = {
  component: ElementType;
  /** Compound parts addressable as `Parent.Child` from JSON. */
  subComponents?: Readonly<Record<string, ElementType>>;
};

/**
 * Null-prototype so a document naming `__proto__`, `constructor` or `toString`
 * as a component cannot reach `Object.prototype` members.
 */
export type ComponentRegistry = Record<string, RegistryEntry>;

const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");

function isComponentLike(value: unknown): value is ElementType {
  if (typeof value === "function") return true;
  if (typeof value === "object" && value !== null && "$$typeof" in value) {
    const tag = (value).$$typeof;
    return tag === FORWARD_REF || tag === MEMO;
  }
  return false;
}

/**
 * A React component by convention: PascalCase name + renderable value. Excludes
 * the barrel's hooks (`useTheme`), utilities (`cn`, `addDays`) and constants
 * (`THEMES`) without needing a hand-maintained deny list that could drift.
 */
export function isExportedComponent(name: string, value: unknown): value is ElementType {
  return /^[A-Z]/.test(name) && isComponentLike(value);
}

/** Compound parts attached via `Object.assign(Root, { Item })`. */
function collectSubComponents(component: ElementType): Record<string, ElementType> | undefined {
  if (typeof component !== "function" && typeof component !== "object") return undefined;
  const subs: Record<string, ElementType> = Object.create(null) as Record<string, ElementType>;
  let found = false;
  for (const key of Object.keys(component)) {
    const value = (component as unknown as Record<string, unknown>)[key];
    if (isExportedComponent(key, value)) {
      subs[key] = value;
      found = true;
    }
  }
  return found ? subs : undefined;
}

/**
 * Derives the registry from a module namespace at runtime.
 *
 * Deriving rather than hand-listing is the point: the source of truth is the
 * library's own barrel, so a component added upstream is addressable from JSON
 * with no edit here, and a `subComponents` entry can never name something that
 * does not exist. The alternative — a literal map — is what drifts.
 */
export function createRegistryFromModule(
  namespace: Readonly<Record<string, unknown>>,
): ComponentRegistry {
  const registry: ComponentRegistry = Object.create(null) as ComponentRegistry;
  for (const [name, value] of Object.entries(namespace)) {
    if (!isExportedComponent(name, value)) continue;
    registry[name] = {
      component: value,
      subComponents: collectSubComponents(value),
    };
  }
  return registry;
}

/** Adds or replaces entries without mutating `base`. */
export function extendRegistry(
  base: ComponentRegistry,
  extra: Readonly<Record<string, RegistryEntry | ElementType>>,
): ComponentRegistry {
  const next: ComponentRegistry = Object.create(null) as ComponentRegistry;
  for (const [name, entry] of Object.entries(base)) next[name] = entry;
  for (const [name, entry] of Object.entries(extra)) {
    next[name] = isComponentLike(entry)
      ? { component: entry, subComponents: collectSubComponents(entry) }
      : (entry);
  }
  return next;
}

/**
 * Resolves `"Card"` or `"Table.Row"`. Own-property checks only — a document
 * naming `"toString"` or `"__proto__"` resolves to nothing rather than to an
 * inherited member.
 */
export function lookupComponent(
  registry: ComponentRegistry,
  name: string,
): ElementType | null {
  const dot = name.indexOf(".");
  if (dot === -1) {
    return Object.hasOwn(registry, name) ? registry[name].component : null;
  }
  const parent = name.slice(0, dot);
  const child = name.slice(dot + 1);
  if (!Object.hasOwn(registry, parent)) return null;
  const subs = registry[parent].subComponents;
  if (!subs || !Object.hasOwn(subs, child)) return null;
  return subs[child];
}
