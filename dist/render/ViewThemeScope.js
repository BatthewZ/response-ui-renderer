"use client";
import { useEffect, useId, useMemo } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/render/ViewThemeScope.tsx
/** Theme name meaning "no override layer" — the `:root` token set itself. */
var DEFAULT_THEME = "default";
var claims = [];
var hostTheme = null;
function applyTopClaim() {
	const root = document.documentElement;
	const active = claims.length > 0 ? claims[claims.length - 1].theme : hostTheme;
	if (active != null && active !== "default") root.setAttribute("data-theme", active);
	else root.removeAttribute("data-theme");
}
function claimRoot(id, theme) {
	if (claims.length === 0) hostTheme = document.documentElement.getAttribute("data-theme");
	claims.push({
		id,
		theme
	});
	if (claims.length > 1) console.warn(`[response-ui-renderer] ${claims.length} views are applying a theme to <html> at once (${claims.map((claim) => claim.theme).join(", ")}); the most recently mounted wins. Use themeMode="scoped" with a bare [data-theme] theme, or themeOverrides, to theme views independently.`);
	applyTopClaim();
}
function releaseRoot(id) {
	const index = claims.findIndex((claim) => claim.id === id);
	if (index === -1) return;
	claims.splice(index, 1);
	applyTopClaim();
	if (claims.length === 0) hostTheme = null;
}
/**
* A view that declares no theme makes no claim at all. Removing the attribute
* "because this view has no theme" would strip the theme off the entire host
* application for as long as the renderer is mounted.
*/
function useRootTheme(theme, enabled) {
	const id = useId();
	useEffect(() => {
		if (!enabled || theme == null || typeof document === "undefined") return;
		claimRoot(id, theme);
		return () => releaseRoot(id);
	}, [
		id,
		theme,
		enabled
	]);
}
/**
* Only `--*` keys are applied. A document may legitimately try to set
* `background`; honouring it would let a spec restyle arbitrary CSS rather than
* re-point design tokens, which is the whole contract of a theme override.
*/
function toCustomProperties(overrides) {
	if (!overrides) return void 0;
	const style = {};
	let found = false;
	for (const [key, value] of Object.entries(overrides)) if (key.startsWith("--") && typeof value === "string") {
		style[key] = value;
		found = true;
	}
	return found ? style : void 0;
}
function ViewThemeScope({ theme, themeOverrides, mode = "root", className, children }) {
	useRootTheme(theme, mode === "root");
	const style = useMemo(() => toCustomProperties(themeOverrides), [themeOverrides]);
	return /* @__PURE__ */ jsx("div", {
		className,
		"data-theme": mode === "scoped" && theme && theme !== "default" ? theme : void 0,
		"data-rui-view": "",
		style,
		children
	});
}
//#endregion
export { DEFAULT_THEME, ViewThemeScope };

//# sourceMappingURL=ViewThemeScope.js.map