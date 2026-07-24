//#region src/registry/types.ts
var FORWARD_REF = Symbol.for("react.forward_ref");
var MEMO = Symbol.for("react.memo");
function isComponentLike(value) {
	if (typeof value === "function") return true;
	if (typeof value === "object" && value !== null && "$$typeof" in value) {
		const tag = value.$$typeof;
		return tag === FORWARD_REF || tag === MEMO;
	}
	return false;
}
/**
* A React component by convention: PascalCase name + renderable value. Excludes
* the barrel's hooks (`useTheme`), utilities (`cn`, `addDays`) and constants
* (`THEMES`) without needing a hand-maintained deny list that could drift.
*/
function isExportedComponent(name, value) {
	return /^[A-Z]/.test(name) && isComponentLike(value);
}
/** Compound parts attached via `Object.assign(Root, { Item })`. */
function collectSubComponents(component) {
	if (typeof component !== "function" && typeof component !== "object") return void 0;
	const subs = Object.create(null);
	let found = false;
	for (const key of Object.keys(component)) {
		const value = component[key];
		if (isExportedComponent(key, value)) {
			subs[key] = value;
			found = true;
		}
	}
	return found ? subs : void 0;
}
/**
* Derives the registry from a module namespace at runtime.
*
* Deriving rather than hand-listing is the point: the source of truth is the
* library's own barrel, so a component added upstream is addressable from JSON
* with no edit here, and a `subComponents` entry can never name something that
* does not exist. The alternative — a literal map — is what drifts.
*/
function createRegistryFromModule(namespace) {
	const registry = Object.create(null);
	for (const [name, value] of Object.entries(namespace)) {
		if (!isExportedComponent(name, value)) continue;
		registry[name] = {
			component: value,
			subComponents: collectSubComponents(value)
		};
	}
	return registry;
}
/** Adds or replaces entries without mutating `base`. */
function extendRegistry(base, extra) {
	const next = Object.create(null);
	for (const [name, entry] of Object.entries(base)) next[name] = entry;
	for (const [name, entry] of Object.entries(extra)) next[name] = isComponentLike(entry) ? {
		component: entry,
		subComponents: collectSubComponents(entry)
	} : entry;
	return next;
}
/**
* Resolves `"Card"` or `"Table.Row"`. Own-property checks only — a document
* naming `"toString"` or `"__proto__"` resolves to nothing rather than to an
* inherited member.
*/
function lookupComponent(registry, name) {
	const dot = name.indexOf(".");
	if (dot === -1) return Object.hasOwn(registry, name) ? registry[name].component : null;
	const parent = name.slice(0, dot);
	const child = name.slice(dot + 1);
	if (!Object.hasOwn(registry, parent)) return null;
	const subs = registry[parent].subComponents;
	if (!subs || !Object.hasOwn(subs, child)) return null;
	return subs[child];
}
//#endregion
export { createRegistryFromModule, extendRegistry, isExportedComponent, lookupComponent };

//# sourceMappingURL=types.js.map