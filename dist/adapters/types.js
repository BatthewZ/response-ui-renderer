//#region src/adapters/types.ts
/** HTTP methods the renderer will issue. */
var ALLOWED_HTTP_METHODS = [
	"GET",
	"POST",
	"PUT",
	"PATCH",
	"DELETE"
];
/** Methods that may carry a request body. */
var METHODS_WITH_BODY = [
	"POST",
	"PUT",
	"PATCH"
];
function normalizeMethod(method) {
	if (typeof method !== "string") return "GET";
	const upper = method.toUpperCase();
	return ALLOWED_HTTP_METHODS.includes(upper) ? upper : "GET";
}
/**
* Relative paths and same-origin absolute URLs only. Protocol-relative `//host`
* is rejected — it resolves to a third-party origin.
*/
function defaultAllowUrl(url) {
	if (url.startsWith("//")) return false;
	if (url.startsWith("/")) return true;
	if (typeof globalThis.location === "undefined") return false;
	try {
		return new URL(url, globalThis.location.href).origin === globalThis.location.origin;
	} catch {
		return false;
	}
}
//#endregion
export { ALLOWED_HTTP_METHODS, METHODS_WITH_BODY, defaultAllowUrl, normalizeMethod };

//# sourceMappingURL=types.js.map