//#region src/render/resolve-ref.ts
var EMPTY_REF_CONTEXT = Object.freeze({
	data: Object.freeze({}),
	forms: Object.freeze({}),
	vars: Object.freeze({})
});
/**
* Walks a dot path. Own-property checks only: `data.__proto__.polluted` and
* `x.constructor` resolve to undefined rather than to prototype members.
* Array indices work because own-property checks succeed on them.
*/
function walk(segments, root) {
	let current = root;
	for (const segment of segments) {
		if (current == null) return void 0;
		if (typeof current !== "object" && typeof current !== "string") return void 0;
		if (typeof current === "string") {
			if (segment !== "length") return void 0;
			current = current.length;
			continue;
		}
		if (!Object.hasOwn(current, segment)) return void 0;
		current = current[segment];
	}
	return current;
}
/**
* `forms.<name>.values.<field>` / `.errors.<field>` are canonical.
* `forms.<name>.<field>` is accepted as shorthand for the value, so a document
* does not have to spell out `.values.` on every binding.
*/
function resolveForms(rest, forms) {
	if (rest.length === 0) return forms;
	const [name, ...tail] = rest;
	if (!Object.hasOwn(forms, name)) return void 0;
	const form = forms[name];
	if (tail.length === 0) return form;
	if (tail[0] === "values" || tail[0] === "errors") return walk(tail, form);
	return walk(tail, form.values);
}
/**
* Resolution order, highest first:
*  1. Explicit namespace — `data.…`, `forms.…`
*  2. Iterator and view-state variables (`$each` aliases, `state.…`)
*  3. Data-key shorthand — `users.0.name` → `data.users[0].name`
*
* Iterator variables beat data deliberately: inside `$each` the loop alias must
* win, otherwise a data key of the same name would silently capture the body.
*/
function resolveRef(path, context) {
	if (typeof path !== "string" || path.length === 0) return void 0;
	const dot = path.indexOf(".");
	const root = dot === -1 ? path : path.slice(0, dot);
	const rest = dot === -1 ? [] : path.slice(dot + 1).split(".");
	if (root === "data") return walk(rest, context.data);
	if (root === "forms") return resolveForms(rest, context.forms);
	if (Object.hasOwn(context.vars, root)) return walk(rest, context.vars[root]);
	if (Object.hasOwn(context.data, root)) return walk(rest, context.data[root]);
}
/** Replaces `{ $ref }` anywhere inside a payload, preserving structure. */
function resolveDeep(value, context, depth = 0) {
	if (depth > 20 || value == null || typeof value !== "object") return value;
	if (Object.hasOwn(value, "$ref")) {
		const ref = value.$ref;
		return typeof ref === "string" ? resolveRef(ref, context) : void 0;
	}
	if (Array.isArray(value)) return value.map((item) => resolveDeep(item, context, depth + 1));
	const out = {};
	for (const [key, item] of Object.entries(value)) out[key] = resolveDeep(item, context, depth + 1);
	return out;
}
/** Renders a resolved value as text. Objects are JSON, not `[object Object]`. */
function refToText(value) {
	if (value == null) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	try {
		return JSON.stringify(value) ?? null;
	} catch {
		return null;
	}
}
//#endregion
export { EMPTY_REF_CONTEXT, refToText, resolveDeep, resolveRef };

//# sourceMappingURL=resolve-ref.js.map