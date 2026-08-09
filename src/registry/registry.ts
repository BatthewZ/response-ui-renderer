import * as ResponseUI from "@batthewz/response-ui-react-components";

import { componentNamesOf } from "../spec/contracts";
import { Icon } from "./Icon";
import {
  type ComponentRegistry,
  createRegistryFromModule,
  extendRegistry,
} from "./types";

/**
 * Every component `@batthewz/response-ui-react-components` exports, plus `Icon`.
 *
 * Built by reading the library's own barrel at runtime, so this file never
 * needs editing when the library gains a component — and cannot claim a
 * component or compound part that does not exist.
 */
export const defaultRegistry: ComponentRegistry = extendRegistry(
  createRegistryFromModule(ResponseUI),
  { Icon },
);

/**
 * Sorted names addressable from JSON, including `Parent.Child` parts.
 *
 * Hand this to `validateViewSpec` — as `{ registry }` or as this list — and a
 * document naming something the registry does not hold is reported at the gate
 * rather than as an inline warning in a user's browser.
 */
export function listComponentNames(registry: ComponentRegistry): string[] {
  return [...componentNamesOf(registry)].sort((a, b) => a.localeCompare(b));
}
