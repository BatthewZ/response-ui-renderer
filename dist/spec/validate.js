//#region src/spec/validate.ts
/** Issues that make a document non-conforming. */
var errorsOf = (issues) => issues.filter((issue) => issue.severity === "error");
/** Issues the renderer acts on without refusing the document. */
var warningsOf = (issues) => issues.filter((issue) => issue.severity === "warning");
/**
* Bounds recursion so a hostile or runaway document cannot exhaust the stack.
* Matches the render-time guard in NodeRenderer, which renders a diagnostic at
* the cap rather than refusing — hence a warning, not an error.
*/
var MAX_NODE_DEPTH = 50;
var EVENT_ACTIONS = /* @__PURE__ */ new Set([
	"submitForm",
	"resetForm",
	"navigate",
	"showToast",
	"apiCall",
	"openDialog",
	"closeDialog",
	"setState"
]);
var BINDING_TYPES = /* @__PURE__ */ new Set([
	"static",
	"api",
	"source"
]);
/** Keys that must never reach `createElement`, whatever the document says. */
var FORBIDDEN_PROPS = /* @__PURE__ */ new Set([
	"dangerouslySetInnerHTML",
	"ref",
	"key",
	"__proto__",
	"constructor",
	"prototype"
]);
/** Props whose value is a URL, and so can smuggle script execution. */
var URL_PROPS = /* @__PURE__ */ new Set([
	"href",
	"src",
	"action",
	"formAction",
	"poster",
	"data",
	"srcSet",
	"background"
]);
var DANGEROUS_SCHEME = /^(?:javascript|vbscript|data:text\/html)/i;
/**
* True for characters a browser ignores while parsing a URL scheme: C0/C1
* controls, spaces, and zero-width marks. `java\tscript:` and `java\nscript:`
* both navigate, so these are stripped before the scheme is compared — testing
* the raw string alone is trivially bypassed.
*
* Expressed as code-point ranges rather than a regex character class, because a
* regex containing control characters is itself a lint error, escaped or not.
*/
function isIgnoredInScheme(code) {
	return code <= 32 || code >= 127 && code <= 160 || code >= 8203 && code <= 8205 || code === 65279;
}
function stripSchemeNoise(value) {
	let out = "";
	for (const char of value) if (!isIgnoredInScheme(char.codePointAt(0) ?? 0)) out += char;
	return out;
}
/** True when a URL string would execute script if the browser followed it. */
function isDangerousUrl(value) {
	if (typeof value !== "string") return false;
	return DANGEROUS_SCHEME.test(stripSchemeNoise(value));
}
function isUrlProp(key) {
	return URL_PROPS.has(key);
}
var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function checkEventHandler(value, path, at, severity) {
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
	if (!EVENT_ACTIONS.has(action)) report(`${path}.action`, `unknown action "${action}" (expected one of: ${[...EVENT_ACTIONS].join(", ")})`);
	if (value.payload !== void 0 && !isPlainObject(value.payload)) report(`${path}.payload`, "payload must be an object");
}
/**
* Props are validated as policy, not structure: the Zod mirror types `props` as
* an open record, so flagging these as errors would make the two validators
* disagree about conformance. The renderer drops each offending prop.
*/
function checkProps(props, path, at) {
	for (const [key, value] of Object.entries(props)) {
		if (FORBIDDEN_PROPS.has(key)) at.warn(`${path}.${key}`, `prop "${key}" is not allowed and will be dropped`);
		if (isUrlProp(key) && isDangerousUrl(value)) at.warn(`${path}.${key}`, "URL scheme is not allowed and will be dropped");
		if (isPlainObject(value) && "action" in value) checkEventHandler(value, `${path}.${key}`, at, "warning");
	}
}
function checkNode(node, path, depth, at) {
	if (depth > 50) {
		at.warn(path, `node nesting exceeds 50 levels and will not render past it`);
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
		if (typeof node.as !== "string" || node.as.length === 0) at.error(`${path}.as`, "as must be a non-empty string");
		if (node.node === void 0) at.error(`${path}.node`, "node is required");
		else checkNode(node.node, `${path}.node`, depth + 1, at);
		return;
	}
	if ("$cond" in node) {
		if (typeof node.$cond !== "string") at.error(`${path}.$cond`, "$cond must be a string");
		if (node.then === void 0) at.error(`${path}.then`, "then is required");
		else checkNode(node.then, `${path}.then`, depth + 1, at);
		if (node.else !== void 0) checkNode(node.else, `${path}.else`, depth + 1, at);
		return;
	}
	if ("component" in node) {
		if (typeof node.component !== "string" || node.component.length === 0) at.error(`${path}.component`, "component must be a non-empty string");
		if (node.props !== void 0) if (!isPlainObject(node.props)) at.error(`${path}.props`, "props must be an object");
		else checkProps(node.props, `${path}.props`, at);
		if (node.children !== void 0) if (!Array.isArray(node.children)) at.error(`${path}.children`, "children must be an array");
		else node.children.forEach((child, i) => checkNode(child, `${path}.children[${i}]`, depth + 1, at));
		return;
	}
	at.error(path, "node must have one of: \"component\", \"$ref\", \"$each\", \"$cond\"");
}
function checkBinding(value, path, at) {
	if (!isPlainObject(value)) {
		at.error(path, "data binding must be an object");
		return;
	}
	const type = value.type;
	if (typeof type !== "string" || !BINDING_TYPES.has(type)) {
		at.error(`${path}.type`, `binding type must be one of: ${[...BINDING_TYPES].join(", ")}`);
		return;
	}
	if (type === "static" && !("value" in value)) at.error(`${path}.value`, "static binding requires value");
	if (type === "api") {
		if (typeof value.endpoint !== "string") at.error(`${path}.endpoint`, "api binding requires endpoint");
		if (value.method !== void 0 && typeof value.method !== "string") at.error(`${path}.method`, "method must be a string");
		if (value.headers !== void 0) {
			if (!isPlainObject(value.headers)) at.error(`${path}.headers`, "headers must be an object");
			else for (const [name, header] of Object.entries(value.headers)) if (typeof header !== "string") at.error(`${path}.headers.${name}`, "header must be a string");
		}
	}
	if (type === "source") {
		if (typeof value.source !== "string") at.error(`${path}.source`, "source binding requires source");
		if (value.params !== void 0 && !isPlainObject(value.params)) at.error(`${path}.params`, "params must be an object");
	}
}
function checkForm(value, path, at) {
	if (!isPlainObject(value)) {
		at.error(path, "form must be an object");
		return;
	}
	if (!isPlainObject(value.fields)) at.error(`${path}.fields`, "fields must be an object");
	else for (const [name, field] of Object.entries(value.fields)) {
		if (!isPlainObject(field)) {
			at.error(`${path}.fields.${name}`, "field must be an object");
			continue;
		}
		if (!("initialValue" in field)) at.error(`${path}.fields.${name}.initialValue`, "initialValue is required");
		if (field.validation !== void 0 && !isPlainObject(field.validation)) at.error(`${path}.fields.${name}.validation`, "validation must be an object");
	}
	if (value.onSubmit !== void 0) checkEventHandler(value.onSubmit, `${path}.onSubmit`, at, "error");
}
/**
* Validates an untrusted document.
*
* `ok: false` means the document does not conform and should be rejected.
* `ok: true` with warnings means it renders, minus whatever each warning names.
* The renderer itself never consults this — it degrades per node — so validation
* is a gate you choose to put in front of it.
*/
function validateViewSpec(input) {
	const issues = [];
	const at = {
		error: (path, message) => issues.push({
			path,
			message,
			severity: "error"
		}),
		warn: (path, message) => issues.push({
			path,
			message,
			severity: "warning"
		})
	};
	if (!isPlainObject(input)) return {
		ok: false,
		issues: [{
			path: "",
			message: "spec must be an object",
			severity: "error"
		}]
	};
	if (input.version !== 1) at.error("version", "version must be the number 1");
	if (typeof input.title !== "string" || input.title.length === 0) at.error("title", "title must be a non-empty string");
	else if (input.title.length > 200) at.error("title", "title must be at most 200 characters");
	if (input.description !== void 0 && typeof input.description !== "string") at.error("description", "description must be a string");
	if (input.theme !== void 0 && typeof input.theme !== "string") at.error("theme", "theme must be a string");
	if (input.themeOverrides !== void 0) {
		if (!isPlainObject(input.themeOverrides)) at.error("themeOverrides", "themeOverrides must be an object");
		else for (const [key, value] of Object.entries(input.themeOverrides)) if (typeof value !== "string") at.error(`themeOverrides.${key}`, "value must be a string");
		else if (!key.startsWith("--")) at.warn(`themeOverrides.${key}`, "key must be a CSS custom property starting with '--'; it will be ignored");
	}
	if (input.data !== void 0) if (!isPlainObject(input.data)) at.error("data", "data must be an object");
	else for (const [key, binding] of Object.entries(input.data)) checkBinding(binding, `data.${key}`, at);
	if (input.forms !== void 0) if (!isPlainObject(input.forms)) at.error("forms", "forms must be an object");
	else for (const [key, form] of Object.entries(input.forms)) checkForm(form, `forms.${key}`, at);
	if (input.root === void 0) at.error("root", "root is required");
	else checkNode(input.root, "root", 0, at);
	return errorsOf(issues).length === 0 ? {
		ok: true,
		spec: input,
		issues
	} : {
		ok: false,
		issues
	};
}
/** Narrowing helper for consumers that only need a yes/no. */
function isViewSpec(input) {
	return validateViewSpec(input).ok;
}
//#endregion
export { FORBIDDEN_PROPS, MAX_NODE_DEPTH, errorsOf, isDangerousUrl, isUrlProp, isViewSpec, validateViewSpec, warningsOf };

//# sourceMappingURL=validate.js.map