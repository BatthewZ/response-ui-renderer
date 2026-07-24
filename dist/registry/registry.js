import { Icon } from "./Icon.js";
import { createRegistryFromModule, extendRegistry } from "./types.js";
import * as ResponseUI from "@batthewz/response-ui-react-components";
//#region src/registry/registry.ts
/**
* Every component `@batthewz/response-ui-react-components` exports, plus `Icon`.
*
* Built by reading the library's own barrel at runtime, so this file never
* needs editing when the library gains a component — and cannot claim a
* component or compound part that does not exist.
*/
var defaultRegistry = extendRegistry(createRegistryFromModule(ResponseUI), { Icon });
/** Sorted names addressable from JSON, including `Parent.Child` parts. */
function listComponentNames(registry) {
	const names = [];
	for (const [name, entry] of Object.entries(registry)) {
		names.push(name);
		if (entry.subComponents) for (const sub of Object.keys(entry.subComponents)) names.push(`${name}.${sub}`);
	}
	return names.sort((a, b) => a.localeCompare(b));
}
//#endregion
export { defaultRegistry, listComponentNames };

//# sourceMappingURL=registry.js.map