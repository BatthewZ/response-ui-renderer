import { RendererAdapters } from '../adapters/types';
import { EventHandlerSpec, FormDef, ValidationRules } from '../spec/types';
import { FormState } from './form-state';
import { RefContext } from './resolve-ref';
export type EventHandlerContext = {
    adapters: RendererAdapters;
    formStates: Record<string, FormState>;
    formDefs: Readonly<Record<string, FormDef>>;
    dialogs: {
        open: (id: string) => void;
        close: (id: string) => void;
    };
    setState: (key: string, value: unknown) => void;
    refContext: RefContext;
};
/**
 * Validation runs in a fixed order so a required-but-empty field reports
 * "required" rather than a confusing length error.
 */
export declare function validateField(value: unknown, rules: ValidationRules): string | null;
/** Runs every rule in a form. Returns true when the form is clean. */
export declare function validateForm(def: FormDef, state: FormState): boolean;
/**
 * Turns a declarative handler into a callback.
 *
 * Every side effect goes through `context.adapters`, so the wire format stays
 * free of any host's router, server routes or auth model.
 */
export declare function createEventCallback(handler: EventHandlerSpec, context: EventHandlerContext, depth?: number): () => void;
//# sourceMappingURL=event-handler.d.ts.map