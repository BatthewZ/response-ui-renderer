"use client";
import { IconSetProvider } from "../registry/Icon.js";
import { defaultRegistry } from "../registry/registry.js";
import { EMPTY_FORMS, useFormsState } from "./form-state.js";
import { NodeErrorBoundary } from "./NodeErrorBoundary.js";
import { ViewDataProvider, useViewData } from "./ViewDataProvider.js";
import { NodeRenderer } from "./NodeRenderer.js";
import { ViewThemeScope } from "./ViewThemeScope.js";
import { useCallback, useMemo, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/render/ViewRenderer.tsx
var EMPTY_ADAPTERS = Object.freeze({});
function DataDiagnostics({ children }) {
	const { dataErrors, dataLoading } = useViewData();
	const message = useMemo(() => {
		if (dataErrors.length === 0) return null;
		return dataErrors.some((error) => error.includes("requires authentication")) ? "This view uses live data that requires sign-in. Some content may not be shown." : "Some data sources failed to load. Some content may not be shown.";
	}, [dataErrors]);
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		dataLoading && /* @__PURE__ */ jsx("div", {
			className: "rui-view-loading",
			role: "progressbar",
			"aria-label": "Loading data"
		}),
		message && /* @__PURE__ */ jsx("div", {
			className: "rui-view-banner",
			role: "status",
			children: message
		}),
		children
	] });
}
/** Reads the live context so handlers see current values, not mount-time ones. */
function ViewBody({ spec, registry, adapters, formDefs, dialogs, setState, hideDiagnostics }) {
	const view = useViewData();
	const eventContext = useMemo(() => {
		const refContext = {
			data: view.data,
			forms: Object.fromEntries(Object.entries(view.forms).map(([name, form]) => [name, {
				values: form.values,
				errors: form.errors
			}])),
			vars: view.vars
		};
		return {
			adapters,
			formStates: view.forms,
			formDefs,
			dialogs,
			setState,
			refContext
		};
	}, [
		adapters,
		view.data,
		view.forms,
		view.vars,
		formDefs,
		dialogs,
		setState
	]);
	const tree = /* @__PURE__ */ jsx(NodeRenderer, {
		node: spec.root,
		registry,
		eventContext
	});
	return hideDiagnostics ? tree : /* @__PURE__ */ jsx(DataDiagnostics, { children: tree });
}
/**
* Renders a ViewSpec document as response-ui components.
*
* Mountable anywhere: it needs no router, no ToastProvider and no server. Those
* are supplied — or not — through `adapters`.
*/
function ViewRenderer({ spec, adapters = EMPTY_ADAPTERS, registry = defaultRegistry, icons, theme, themeMode = "root", className, hideDiagnostics = false }) {
	const formDefs = spec.forms ?? EMPTY_FORMS;
	const formStates = useFormsState(formDefs);
	const [dialogStates, setDialogStates] = useState({});
	const [viewState, setViewState] = useState({});
	const [prevSpec, setPrevSpec] = useState(spec);
	if (prevSpec !== spec) {
		setPrevSpec(spec);
		setDialogStates({});
		setViewState({});
	}
	const dialogs = useMemo(() => ({
		open: (id) => setDialogStates((prev) => ({
			...prev,
			[id]: true
		})),
		close: (id) => setDialogStates((prev) => ({
			...prev,
			[id]: false
		}))
	}), []);
	const setState = useCallback((key, value) => {
		setViewState((prev) => ({
			...prev,
			[key]: value
		}));
	}, []);
	return /* @__PURE__ */ jsx(ViewThemeScope, {
		theme: theme ?? spec.theme,
		themeOverrides: spec.themeOverrides,
		mode: themeMode,
		className,
		children: /* @__PURE__ */ jsx(IconSetProvider, {
			icons,
			children: /* @__PURE__ */ jsx(ViewDataProvider, {
				dataBindings: spec.data,
				adapters,
				forms: formStates,
				viewState,
				dialogStates,
				children: /* @__PURE__ */ jsx(NodeErrorBoundary, {
					label: spec.title,
					children: /* @__PURE__ */ jsx(ViewBody, {
						spec,
						registry,
						adapters,
						formDefs,
						dialogs,
						setState,
						hideDiagnostics
					})
				})
			})
		})
	});
}
//#endregion
export { ViewRenderer };

//# sourceMappingURL=ViewRenderer.js.map