import { DataBinding, EventHandlerSpec, FormDef, ViewNode, ViewSpec } from './types';
/**
 * Dependency-free validation.
 *
 * `@batthewz/response-ui-react-components` states that consumers bring their own
 * validator and the library must not depend on one. This package honours that:
 * zero runtime dependencies, so a Zod/Valibot/ArkType consumer never ends up
 * with a second validator in their bundle.
 */
/**
 * `"error"` — the document does not conform to the format. `ok` is false.
 * `"warning"` — it conforms, but names something the renderer will refuse at
 * render time: a forbidden prop, a script-bearing URL, an unknown action inside
 * a prop, a theme override that is not a custom property, nesting past the
 * depth cap. The document still renders; the offending piece is dropped.
 *
 * The split exists so `ok` means exactly one thing — conformance — and can be
 * mirrored precisely by the optional Zod schema, which is single-tier.
 */
export type IssueSeverity = "error" | "warning";
export type ValidationIssue = {
    path: string;
    message: string;
    severity: IssueSeverity;
};
export type ValidationResult = {
    ok: true;
    spec: ViewSpec;
    issues: ValidationIssue[];
} | {
    ok: false;
    issues: ValidationIssue[];
};
/** Issues that make a document non-conforming. */
export declare const errorsOf: (issues: readonly ValidationIssue[]) => ValidationIssue[];
/** Issues the renderer acts on without refusing the document. */
export declare const warningsOf: (issues: readonly ValidationIssue[]) => ValidationIssue[];
/**
 * Bounds recursion so a hostile or runaway document cannot exhaust the stack.
 * Matches the render-time guard in NodeRenderer, which renders a diagnostic at
 * the cap rather than refusing — hence a warning, not an error.
 */
export declare const MAX_NODE_DEPTH = 50;
/** Keys that must never reach `createElement`, whatever the document says. */
export declare const FORBIDDEN_PROPS: ReadonlySet<string>;
/** True when a URL string would execute script if the browser followed it. */
export declare function isDangerousUrl(value: unknown): boolean;
export declare function isUrlProp(key: string): boolean;
/**
 * Validates an untrusted document.
 *
 * `ok: false` means the document does not conform and should be rejected.
 * `ok: true` with warnings means it renders, minus whatever each warning names.
 * The renderer itself never consults this — it degrades per node — so validation
 * is a gate you choose to put in front of it.
 */
export declare function validateViewSpec(input: unknown): ValidationResult;
/** Narrowing helper for consumers that only need a yes/no. */
export declare function isViewSpec(input: unknown): input is ViewSpec;
export type { DataBinding, EventHandlerSpec, FormDef, ViewNode, ViewSpec };
//# sourceMappingURL=validate.d.ts.map