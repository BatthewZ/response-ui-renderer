import { ALLOWED_HTTP_METHODS, METHODS_WITH_BODY, defaultAllowUrl, normalizeMethod } from "../adapters/types.js";
import { isEventHandlerSpec } from "../spec/types.js";
import { resolveDeep } from "./resolve-ref.js";
//#region src/render/event-handler.ts
/** Guards against a document wiring onSuccess → onError → onSuccess forever. */
var MAX_HANDLER_DEPTH = 5;
/**
* Validation runs in a fixed order so a required-but-empty field reports
* "required" rather than a confusing length error.
*/
function validateField(value, rules) {
	if (rules.required) {
		if (value == null || value === "" || value === false || Array.isArray(value) && value.length === 0) return rules.message ?? "This field is required";
	}
	if (value == null || value === "") return null;
	if (typeof value === "string") {
		if (rules.minLength != null && value.length < rules.minLength) return rules.message ?? `Must be at least ${rules.minLength} characters`;
		if (rules.maxLength != null && value.length > rules.maxLength) return rules.message ?? `Must be at most ${rules.maxLength} characters`;
		if (rules.pattern != null) try {
			if (!new RegExp(rules.pattern).test(value)) return rules.message ?? "Invalid format";
		} catch {
			return rules.message ?? "Invalid format";
		}
	}
	const numeric = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)) ? Number(value) : null;
	if (numeric != null) {
		if (rules.min != null && numeric < rules.min) return rules.message ?? `Must be at least ${rules.min}`;
		if (rules.max != null && numeric > rules.max) return rules.message ?? `Must be at most ${rules.max}`;
	}
	return null;
}
/** Runs every rule in a form. Returns true when the form is clean. */
function validateForm(def, state) {
	let valid = true;
	for (const [fieldName, fieldDef] of Object.entries(def.fields ?? {})) {
		if (!fieldDef?.validation) {
			state.clearError(fieldName);
			continue;
		}
		const error = validateField(state.values[fieldName], fieldDef.validation);
		if (error) {
			state.setError(fieldName, error);
			valid = false;
		} else state.clearError(fieldName);
	}
	return valid;
}
function warn(message) {
	console.warn(`[response-ui-renderer] ${message}`);
}
/**
* Turns a declarative handler into a callback.
*
* Every side effect goes through `context.adapters`, so the wire format stays
* free of any host's router, server routes or auth model.
*/
function createEventCallback(handler, context, depth = 0) {
	if (depth > MAX_HANDLER_DEPTH) {
		warn(`handler nesting exceeded ${MAX_HANDLER_DEPTH}; ignoring`);
		return () => void 0;
	}
	return () => {
		const raw = handler.payload ?? {};
		const { adapters, refContext } = context;
		const payload = resolveDeep(raw, refContext);
		switch (handler.action) {
			case "submitForm": {
				const formId = raw.form ?? raw.formId;
				if (typeof formId !== "string") {
					warn("submitForm: payload.form is required");
					return;
				}
				const state = context.formStates[formId];
				const def = context.formDefs[formId];
				if (!state || !def) {
					warn(`submitForm: form "${formId}" is not declared in spec.forms`);
					return;
				}
				if (!validateForm(def, state)) return;
				if (def.onSubmit) createEventCallback(def.onSubmit, context, depth + 1)();
				return;
			}
			case "resetForm": {
				const formId = raw.form ?? raw.formId;
				if (typeof formId === "string") context.formStates[formId]?.reset();
				return;
			}
			case "navigate": {
				const path = payload.path;
				if (typeof path !== "string" || path.length === 0) {
					warn("navigate: payload.path is required");
					return;
				}
				if (!adapters.navigate) {
					warn(`navigate: no navigate adapter supplied; "${path}" ignored`);
					return;
				}
				adapters.navigate(path);
				return;
			}
			case "showToast": {
				const message = payload.message;
				if (!adapters.toast) {
					warn("showToast: no toast adapter and no ToastProvider above the renderer");
					return;
				}
				adapters.toast(typeof message === "string" ? message : "Notification", {
					variant: payload.variant,
					title: typeof payload.title === "string" ? payload.title : void 0
				});
				return;
			}
			case "openDialog":
				if (typeof payload.dialogId === "string") context.dialogs.open(payload.dialogId);
				return;
			case "closeDialog":
				if (typeof payload.dialogId === "string") context.dialogs.close(payload.dialogId);
				return;
			case "setState": {
				const key = raw.key;
				if (typeof key !== "string" || key.length === 0) {
					warn("setState: payload.key must be a non-empty string");
					return;
				}
				context.setState(key, payload.value);
				return;
			}
			case "apiCall":
				runApiCall(raw, payload, context, depth);
				return;
			default: warn(`unknown action "${String(handler.action)}"`);
		}
	};
}
function runApiCall(raw, payload, context, depth) {
	const { adapters } = context;
	const endpoint = raw.endpoint;
	if (typeof endpoint !== "string" || endpoint.length === 0) {
		warn("apiCall: payload.endpoint is required");
		return;
	}
	const method = normalizeMethod(raw.method);
	if (typeof raw.method === "string" && !ALLOWED_HTTP_METHODS.includes(raw.method.toUpperCase())) warn(`apiCall: method "${raw.method}" is not allowed; using GET`);
	if (!(adapters.allowUrl ?? defaultAllowUrl)(endpoint)) {
		adapters.toast?.("Request blocked: endpoint not allowed", {
			variant: "error",
			title: "Request Blocked"
		});
		warn(`apiCall: blocked "${endpoint}"`);
		return;
	}
	const init = { method };
	if (payload.body !== void 0 && METHODS_WITH_BODY.includes(method)) {
		init.body = JSON.stringify(payload.body);
		init.headers = { "Content-Type": "application/json" };
	}
	(adapters.fetch ?? ((url, opts) => fetch(url, opts)))(endpoint, init).then(async (res) => {
		if (res.ok) {
			if (isEventHandlerSpec(raw.onSuccess)) createEventCallback(raw.onSuccess, context, depth + 1)();
			return;
		}
		if (isEventHandlerSpec(raw.onError)) {
			createEventCallback(raw.onError, context, depth + 1)();
			return;
		}
		const text = await res.text().catch(() => `HTTP ${res.status}`);
		adapters.toast?.(`Request failed: ${text}`, {
			variant: "error",
			title: "Request Failed"
		});
	}).catch((err) => {
		if (isEventHandlerSpec(raw.onError)) {
			createEventCallback(raw.onError, context, depth + 1)();
			return;
		}
		const message = err instanceof Error ? err.message : "Network error";
		adapters.toast?.(`Request failed: ${message}`, {
			variant: "error",
			title: "Request Failed"
		});
	});
}
//#endregion
export { createEventCallback, validateField, validateForm };

//# sourceMappingURL=event-handler.js.map