import { ElementType } from 'react';
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
/**
 * A React component by convention: PascalCase name + renderable value. Excludes
 * the barrel's hooks (`useTheme`), utilities (`cn`, `addDays`) and constants
 * (`THEMES`) without needing a hand-maintained deny list that could drift.
 */
export declare function isExportedComponent(name: string, value: unknown): value is ElementType;
/**
 * Derives the registry from a module namespace at runtime.
 *
 * Deriving rather than hand-listing is the point: the source of truth is the
 * library's own barrel, so a component added upstream is addressable from JSON
 * with no edit here, and a `subComponents` entry can never name something that
 * does not exist. The alternative — a literal map — is what drifts.
 */
export declare function createRegistryFromModule(namespace: Readonly<Record<string, unknown>>): ComponentRegistry;
/** Adds or replaces entries without mutating `base`. */
export declare function extendRegistry(base: ComponentRegistry, extra: Readonly<Record<string, RegistryEntry | ElementType>>): ComponentRegistry;
/**
 * Resolves `"Card"` or `"Table.Row"`. Own-property checks only — a document
 * naming `"toString"` or `"__proto__"` resolves to nothing rather than to an
 * inherited member.
 */
export declare function lookupComponent(registry: ComponentRegistry, name: string): ElementType | null;
//# sourceMappingURL=types.d.ts.map