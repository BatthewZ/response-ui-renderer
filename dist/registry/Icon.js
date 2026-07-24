"use client";
import { createContext, useContext, useMemo } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/registry/Icon.tsx
var IconSetContext = createContext(null);
function IconSetProvider({ icons, children }) {
	const value = useMemo(() => icons ?? null, [icons]);
	return /* @__PURE__ */ jsx(IconSetContext.Provider, {
		value,
		children
	});
}
function useIconSet() {
	return useContext(IconSetContext);
}
/**
* `"trending-up"`, `"trending_up"` and `"trendingUp"` all become `"TrendingUp"`.
* Documents are typically machine-generated and inconsistent about casing;
* failing on that would be needlessly brittle.
*/
function normalizeIconName(name) {
	const candidates = /* @__PURE__ */ new Set([name]);
	const pascal = name.split(/[-_\s]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
	if (pascal) {
		candidates.add(pascal);
		candidates.add(pascal.charAt(0).toUpperCase() + pascal.slice(1));
	}
	return [...candidates];
}
function lookupIcon(icons, name) {
	if (!icons || typeof name !== "string" || name.length === 0) return null;
	for (const candidate of normalizeIconName(name)) if (Object.hasOwn(icons, candidate)) return icons[candidate];
	return null;
}
/**
* The one name in the JSON vocabulary that is not a response-ui export.
*
* It exists because response-ui components take `icon` props typed as
* `ReactNode`, which JSON cannot express — without a name→component resolver,
* every icon slot in the library is unreachable from a document.
*
* The icon set is injected rather than imported here so the core bundle stays
* free of lucide's ~1600 modules. See `@batthewz/response-ui-renderer/icons`.
*/
function Icon({ name, size = 24, ...rest }) {
	const Resolved = lookupIcon(useIconSet(), name);
	if (!Resolved) return /* @__PURE__ */ jsx("span", {
		className: "rui-render-missing-icon",
		role: "img",
		"aria-label": typeof name === "string" ? name : "icon",
		"data-icon-name": String(name)
	});
	return /* @__PURE__ */ jsx(Resolved, {
		size,
		"aria-hidden": true,
		...rest
	});
}
//#endregion
export { Icon, IconSetProvider, lookupIcon, normalizeIconName, useIconSet };

//# sourceMappingURL=Icon.js.map