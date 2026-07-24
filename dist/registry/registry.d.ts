import { ComponentRegistry } from './types';
/**
 * Every component `@batthewz/response-ui-react-components` exports, plus `Icon`.
 *
 * Built by reading the library's own barrel at runtime, so this file never
 * needs editing when the library gains a component — and cannot claim a
 * component or compound part that does not exist.
 */
export declare const defaultRegistry: ComponentRegistry;
/** Sorted names addressable from JSON, including `Parent.Child` parts. */
export declare function listComponentNames(registry: ComponentRegistry): string[];
//# sourceMappingURL=registry.d.ts.map