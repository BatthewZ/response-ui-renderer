"use client";
import { Component } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/render/NodeErrorBoundary.tsx
/**
* Contains a throw to the node that caused it.
*
* Documents are typically machine-generated, so a component receiving props it
* cannot handle is an expected condition, not an exceptional one. Without a
* boundary per node, one bad prop blanks the entire view — and in a live
* preview that reads as "the renderer is broken" rather than "this node is".
*/
var NodeErrorBoundary = class extends Component {
	state = { message: null };
	static getDerivedStateFromError(error) {
		return { message: error instanceof Error ? error.message : String(error) };
	}
	componentDidUpdate(prev) {
		if (prev.label !== this.props.label && this.state.message !== null) this.setState({ message: null });
	}
	componentDidCatch(error, info) {
		this.props.onError?.(error, info);
	}
	render() {
		if (this.state.message !== null) return /* @__PURE__ */ jsxs("div", {
			className: "rui-render-error",
			role: "alert",
			children: [
				/* @__PURE__ */ jsx("strong", { children: "Render error" }),
				" (",
				this.props.label,
				"): ",
				this.state.message
			]
		});
		return this.props.children;
	}
};
//#endregion
export { NodeErrorBoundary };

//# sourceMappingURL=NodeErrorBoundary.js.map