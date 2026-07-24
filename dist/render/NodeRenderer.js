"use client";
import { Icon } from "../registry/Icon.js";
import { lookupComponent } from "../registry/types.js";
import { FIELD_BINDING_KEY, isComponentNode, isCondNode, isEachNode, isEventHandlerSpec, isFieldBinding, isRefNode, isRefValue } from "../spec/types.js";
import { refToText, resolveRef } from "./resolve-ref.js";
import { createEventCallback } from "./event-handler.js";
import { NodeErrorBoundary } from "./NodeErrorBoundary.js";
import { wantsIconComponent } from "../registry/icon-slots.js";
import { FORBIDDEN_PROPS, isDangerousUrl, isUrlProp } from "../spec/validate.js";
import { ViewContextExtender, useViewData } from "./ViewDataProvider.js";
import { createElement, useId } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/render/NodeRenderer.tsx
/** Splits `"contact.email"` and looks up the live form. */
function resolveFormField(path, forms) {
	const dot = path.indexOf(".");
	if (dot === -1) return null;
	const formName = path.slice(0, dot);
	const fieldName = path.slice(dot + 1);
	if (!Object.hasOwn(forms, formName)) return null;
	return {
		fieldName,
		formState: forms[formName]
	};
}
/** Iteration keys prefer a stable id so reordering does not remount rows. */
function itemKey(item, index) {
	if (typeof item === "object" && item !== null) {
		const obj = item;
		for (const field of [
			"id",
			"key",
			"slug",
			"uuid"
		]) if (Object.hasOwn(obj, field)) {
			const value = obj[field];
			if (typeof value === "string" || typeof value === "number") return String(value);
		}
	}
	if (typeof item === "string" || typeof item === "number") return String(item);
	return String(index);
}
function nodeKey(node, index) {
	if (typeof node === "string") return `t${index}`;
	if (isRefNode(node)) return `r${index}-${node.$ref}`;
	if (isEachNode(node)) return `e${index}-${node.$each}`;
	if (isCondNode(node)) return `c${index}-${node.$cond}`;
	if (isComponentNode(node)) {
		const id = node.props?.id ?? node.props?.name ?? node.props?.value;
		if (typeof id === "string" || typeof id === "number") return `${node.component}-${id}`;
		return `${node.component}-${index}`;
	}
	return `n${index}`;
}
/** `icon`, `leftIcon`, `trailingIcon`… — slots typed ReactNode in the library. */
function isIconProp(key) {
	return key === "icon" || key.length > 4 && key.endsWith("Icon");
}
/** Coerces the DOM value for a `$field`-bound control. */
function readInputValue(event) {
	const target = event.target;
	if (target instanceof HTMLInputElement) {
		if (target.type === "checkbox") return target.checked;
		if (target.type === "radio") return target.value;
		if (target.type === "number" || target.type === "range") {
			if (target.value === "") return "";
			const num = Number(target.value);
			return Number.isNaN(num) ? target.value : num;
		}
	}
	return target.value;
}
function NodeRenderer({ node, registry, eventContext, depth = 0 }) {
	const view = useViewData();
	const autoDialogId = useId();
	if (depth > 50) return /* @__PURE__ */ jsxs("div", {
		className: "rui-render-error",
		role: "alert",
		children: [
			"Node nesting exceeded ",
			50,
			" levels."
		]
	});
	const refContext = {
		data: view.data,
		forms: Object.fromEntries(Object.entries(view.forms).map(([name, form]) => [name, {
			values: form.values,
			errors: form.errors
		}])),
		vars: view.vars
	};
	if (typeof node === "string") return /* @__PURE__ */ jsx(Fragment, { children: node });
	if (node == null || typeof node !== "object") return /* @__PURE__ */ jsxs("div", {
		className: "rui-render-error",
		role: "alert",
		children: ["Invalid node: ", String(node)]
	});
	if (isRefNode(node)) return /* @__PURE__ */ jsx(Fragment, { children: refToText(resolveRef(node.$ref, refContext)) });
	if (isCondNode(node)) {
		const branch = resolveRef(node.$cond, refContext) ? node.then : node.else;
		if (branch === void 0) return null;
		return /* @__PURE__ */ jsx(NodeErrorBoundary, {
			label: "$cond",
			children: /* @__PURE__ */ jsx(NodeRenderer, {
				node: branch,
				registry,
				eventContext,
				depth: depth + 1
			})
		});
	}
	if (isEachNode(node)) {
		const resolved = resolveRef(node.$each, refContext);
		if (!Array.isArray(resolved)) return null;
		return /* @__PURE__ */ jsx(Fragment, { children: resolved.map((item, index) => /* @__PURE__ */ jsx(ViewContextExtender, {
			vars: {
				[node.as]: item,
				[`${node.as}Index`]: index
			},
			children: /* @__PURE__ */ jsx(NodeErrorBoundary, {
				label: `$each[${index}]`,
				children: /* @__PURE__ */ jsx(NodeRenderer, {
					node: node.node,
					registry,
					eventContext,
					depth: depth + 1
				})
			})
		}, itemKey(item, index))) });
	}
	if (!isComponentNode(node)) return /* @__PURE__ */ jsx("div", {
		className: "rui-render-error",
		role: "alert",
		children: "Node must have one of: component, $ref, $each, $cond."
	});
	const Component = lookupComponent(registry, node.component);
	if (!Component) return /* @__PURE__ */ jsxs("div", {
		className: "rui-render-warning",
		role: "alert",
		children: ["Unknown component: ", /* @__PURE__ */ jsx("strong", { children: node.component })]
	});
	const props = {};
	/** Both binding spellings converge here. */
	const applyFieldBinding = (path) => {
		const bound = resolveFormField(path, view.forms);
		if (!bound) return;
		const { fieldName, formState } = bound;
		const current = formState.values[fieldName];
		if (node.component === "Checkbox" || node.component === "Switch") props.checked = Boolean(current);
		else if (node.component === "Radio") props.checked = current === props.value;
		else props.value = current == null ? "" : current;
		props.onChange = (event) => {
			formState.setValue(fieldName, readInputValue(event));
		};
	};
	for (const [key, value] of Object.entries(node.props ?? {})) {
		if (FORBIDDEN_PROPS.has(key)) continue;
		if (key === "$field") continue;
		if (isRefValue(value)) {
			props[key] = resolveRef(value.$ref, refContext);
			continue;
		}
		if (isEventHandlerSpec(value)) {
			props[key] = createEventCallback(value, eventContext);
			continue;
		}
		if (isFieldBinding(value)) {
			applyFieldBinding(value.$field);
			continue;
		}
		if (isUrlProp(key) && isDangerousUrl(value)) continue;
		if (isIconProp(key) && typeof value === "string") {
			props[key] = wantsIconComponent(node.component, key) ? () => /* @__PURE__ */ jsx(Icon, { name: value }) : /* @__PURE__ */ jsx(Icon, { name: value });
			continue;
		}
		props[key] = value;
	}
	const fieldPath = node.props?.[FIELD_BINDING_KEY];
	if (typeof fieldPath === "string") applyFieldBinding(fieldPath);
	if (node.component === "Dialog" || node.component === "Drawer") {
		const dialogId = typeof node.props?.id === "string" ? node.props.id : autoDialogId;
		props.open = view.dialogStates[dialogId] ?? node.props?.open === true;
		props.onClose = () => eventContext.dialogs.close(dialogId);
	}
	let optionChildren;
	if (node.component === "Select" && Array.isArray(props.options)) {
		optionChildren = props.options.map((option, index) => {
			if (typeof option === "string" || typeof option === "number") return /* @__PURE__ */ jsx("option", {
				value: option,
				children: option
			}, String(option));
			const record = option ?? {};
			const value = record.value;
			return /* @__PURE__ */ jsx("option", {
				value,
				children: record.label ?? value
			}, typeof value === "string" || typeof value === "number" ? String(value) : index);
		});
		delete props.options;
	}
	if ((node.component === "Field" || node.component === "FieldError") && typeof props.name === "string") {
		const bound = resolveFormField(props.name, view.forms);
		const message = bound ? bound.formState.errors[bound.fieldName] : void 0;
		if (node.component === "Field") {
			if (message) props.error = message;
			delete props.name;
		} else {
			if (message) props.children = message;
			delete props.name;
		}
	}
	const childNodes = node.children?.map((child, index) => /* @__PURE__ */ jsx(NodeErrorBoundary, {
		label: `${node.component}[${index}]`,
		children: /* @__PURE__ */ jsx(NodeRenderer, {
			node: child,
			registry,
			eventContext,
			depth: depth + 1
		})
	}, nodeKey(child, index)));
	const children = optionChildren ? [...optionChildren, ...childNodes ?? []] : childNodes;
	const element = children && children.length > 0 ? createElement(Component, props, children) : createElement(Component, props);
	return /* @__PURE__ */ jsx(NodeErrorBoundary, {
		label: node.component,
		children: element
	});
}
//#endregion
export { NodeRenderer };

//# sourceMappingURL=NodeRenderer.js.map