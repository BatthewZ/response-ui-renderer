import { FormDef } from '../spec/types';
export type FormState = {
    values: Record<string, unknown>;
    errors: Record<string, string>;
    setValue: (field: string, value: unknown) => void;
    setError: (field: string, error: string) => void;
    clearError: (field: string) => void;
    reset: () => void;
};
export declare const EMPTY_FORMS: Readonly<Record<string, FormDef>>;
/**
 * Holds every form in the document behind two `useState` calls.
 *
 * A `useState` per form would put a hook inside a loop, which breaks the Rules
 * of Hooks the moment a document adds or removes a form — and documents are
 * expected to change identity at runtime (a new LLM turn replaces the spec).
 */
export declare function useFormsState(forms: Readonly<Record<string, FormDef>>): Record<string, FormState>;
/** Projects form state into the shape `$ref` paths address. */
export declare function toFormRefState(forms: Record<string, FormState>): Record<string, {
    values: Record<string, unknown>;
    errors: Record<string, string>;
}>;
//# sourceMappingURL=form-state.d.ts.map