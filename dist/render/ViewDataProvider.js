"use client";
import { METHODS_WITH_BODY, defaultAllowUrl, normalizeMethod } from "../adapters/types.js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/render/ViewDataProvider.tsx
var ViewDataContext = createContext({
	data: {},
	forms: {},
	vars: {},
	dialogStates: {},
	dataErrors: [],
	dataLoading: false
});
function useViewData() {
	return useContext(ViewDataContext);
}
var isAsync = (binding) => binding.type === "api" || binding.type === "source";
function asyncKeysOf(bindings) {
	const keys = /* @__PURE__ */ new Set();
	if (!bindings) return keys;
	for (const [key, binding] of Object.entries(bindings)) if (binding && isAsync(binding)) keys.add(key);
	return keys;
}
/** Loads one binding. Rejects with a message already fit for display. */
async function loadBinding(key, binding, adapters, signal) {
	if (binding.type === "source") {
		if (!adapters.resolveSource) throw new Error(`Data source "${key}" needs a resolveSource adapter for source "${binding.source}"`);
		return adapters.resolveSource(binding, signal);
	}
	if (binding.type !== "api") throw new Error(`Data source "${key}" has an unsupported binding type`);
	if (!(adapters.allowUrl ?? defaultAllowUrl)(binding.endpoint)) throw new Error(`Data source "${key}" was blocked: endpoint not allowed`);
	const method = normalizeMethod(binding.method);
	const init = {
		method,
		signal
	};
	if (binding.body !== void 0 && METHODS_WITH_BODY.includes(method)) init.body = JSON.stringify(binding.body);
	if (binding.headers) init.headers = { ...binding.headers };
	if (init.body && !("Content-Type" in (init.headers ?? {}))) init.headers = {
		...init.headers,
		"Content-Type": "application/json"
	};
	const res = await (adapters.fetch ?? ((url, opts) => fetch(url, opts)))(binding.endpoint, init);
	if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? `Data source "${key}" requires authentication` : `Data source "${key}" failed to load (${res.status})`);
	return await res.json();
}
function ViewDataProvider({ dataBindings, adapters, forms, viewState, dialogStates, children }) {
	const staticData = useMemo(() => {
		const entries = {};
		if (!dataBindings) return entries;
		for (const [key, binding] of Object.entries(dataBindings)) if (binding?.type === "static") entries[key] = binding.value;
		return entries;
	}, [dataBindings]);
	const [asyncData, setAsyncData] = useState({});
	const [dataErrors, setDataErrors] = useState([]);
	const [pendingKeys, setPendingKeys] = useState(() => asyncKeysOf(dataBindings));
	const [prevBindings, setPrevBindings] = useState(dataBindings);
	if (prevBindings !== dataBindings) {
		setPrevBindings(dataBindings);
		setAsyncData({});
		setDataErrors([]);
		setPendingKeys(asyncKeysOf(dataBindings));
	}
	useEffect(() => {
		if (!dataBindings) return;
		const controller = new AbortController();
		for (const [key, binding] of Object.entries(dataBindings)) {
			if (!binding || !isAsync(binding)) continue;
			loadBinding(key, binding, adapters, controller.signal).then((result) => {
				if (controller.signal.aborted) return;
				setAsyncData((prev) => ({
					...prev,
					[key]: result
				}));
			}).catch((err) => {
				if (controller.signal.aborted) return;
				const message = err instanceof Error ? err.message : `Data source "${key}" failed to load`;
				setDataErrors((prev) => prev.includes(message) ? prev : [...prev, message]);
			}).finally(() => {
				if (controller.signal.aborted) return;
				setPendingKeys((prev) => {
					if (!prev.has(key)) return prev;
					const next = new Set(prev);
					next.delete(key);
					return next;
				});
			});
		}
		return () => controller.abort();
	}, [dataBindings, adapters]);
	const data = useMemo(() => ({
		...staticData,
		...asyncData
	}), [staticData, asyncData]);
	const context = useMemo(() => ({
		data,
		forms,
		vars: { state: viewState },
		dialogStates,
		dataErrors,
		dataLoading: pendingKeys.size > 0
	}), [
		data,
		forms,
		viewState,
		dialogStates,
		dataErrors,
		pendingKeys
	]);
	return /* @__PURE__ */ jsx(ViewDataContext.Provider, {
		value: context,
		children
	});
}
/** Layers `$each` iteration variables onto the surrounding context. */
function ViewContextExtender({ vars, children }) {
	const parent = useViewData();
	const extended = useMemo(() => ({
		...parent,
		vars: {
			...parent.vars,
			...vars
		}
	}), [parent, vars]);
	return /* @__PURE__ */ jsx(ViewDataContext.Provider, {
		value: extended,
		children
	});
}
//#endregion
export { ViewContextExtender, ViewDataProvider, useViewData };

//# sourceMappingURL=ViewDataProvider.js.map