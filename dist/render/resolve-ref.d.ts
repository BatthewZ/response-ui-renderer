/** A form as it appears to `$ref` paths. */
export type FormRefState = {
    values: Record<string, unknown>;
    errors: Record<string, string>;
};
/**
 * Namespaces stay separate rather than being merged into one lookup object, so
 * a data key called `forms` cannot shadow the forms namespace.
 */
export type RefContext = {
    data: Record<string, unknown>;
    forms: Record<string, FormRefState>;
    vars: Record<string, unknown>;
};
export declare const EMPTY_REF_CONTEXT: RefContext;
/**
 * Resolution order, highest first:
 *  1. Explicit namespace — `data.…`, `forms.…`
 *  2. Iterator and view-state variables (`$each` aliases, `state.…`)
 *  3. Data-key shorthand — `users.0.name` → `data.users[0].name`
 *
 * Iterator variables beat data deliberately: inside `$each` the loop alias must
 * win, otherwise a data key of the same name would silently capture the body.
 */
export declare function resolveRef(path: string, context: RefContext): unknown;
/** Replaces `{ $ref }` anywhere inside a payload, preserving structure. */
export declare function resolveDeep(value: unknown, context: RefContext, depth?: number): unknown;
/** Renders a resolved value as text. Objects are JSON, not `[object Object]`. */
export declare function refToText(value: unknown): string | null;
//# sourceMappingURL=resolve-ref.d.ts.map