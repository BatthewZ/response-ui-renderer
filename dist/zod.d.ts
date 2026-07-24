import { z } from 'zod';
import { ViewSpec } from './spec/types';
export declare const eventHandlerSchema: z.ZodObject<{
    action: z.ZodEnum<{
        submitForm: "submitForm";
        resetForm: "resetForm";
        navigate: "navigate";
        showToast: "showToast";
        apiCall: "apiCall";
        openDialog: "openDialog";
        closeDialog: "closeDialog";
        setState: "setState";
    }>;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const validationRulesSchema: z.ZodObject<{
    required: z.ZodOptional<z.ZodBoolean>;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
    minLength: z.ZodOptional<z.ZodNumber>;
    maxLength: z.ZodOptional<z.ZodNumber>;
    pattern: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const formFieldSchema: z.ZodObject<{
    initialValue: z.ZodUnknown;
    validation: z.ZodOptional<z.ZodObject<{
        required: z.ZodOptional<z.ZodBoolean>;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        minLength: z.ZodOptional<z.ZodNumber>;
        maxLength: z.ZodOptional<z.ZodNumber>;
        pattern: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const formDefSchema: z.ZodObject<{
    fields: z.ZodRecord<z.ZodString, z.ZodObject<{
        initialValue: z.ZodUnknown;
        validation: z.ZodOptional<z.ZodObject<{
            required: z.ZodOptional<z.ZodBoolean>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            minLength: z.ZodOptional<z.ZodNumber>;
            maxLength: z.ZodOptional<z.ZodNumber>;
            pattern: z.ZodOptional<z.ZodString>;
            message: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    onSubmit: z.ZodOptional<z.ZodObject<{
        action: z.ZodEnum<{
            submitForm: "submitForm";
            resetForm: "resetForm";
            navigate: "navigate";
            showToast: "showToast";
            apiCall: "apiCall";
            openDialog: "openDialog";
            closeDialog: "closeDialog";
            setState: "setState";
        }>;
        payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const dataBindingSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"static">;
    value: z.ZodUnknown;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"api">;
    endpoint: z.ZodString;
    method: z.ZodOptional<z.ZodString>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    body: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"source">;
    source: z.ZodString;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>], "type">;
type ViewNodeShape = string | {
    component: string;
    props?: Record<string, unknown>;
    children?: ViewNodeShape[];
} | {
    $ref: string;
} | {
    $each: string;
    as: string;
    node: ViewNodeShape;
} | {
    $cond: string;
    then: ViewNodeShape;
    else?: ViewNodeShape;
};
export declare const refNodeSchema: z.ZodObject<{
    $ref: z.ZodString;
}, z.core.$strip>;
export declare const viewNodeSchema: z.ZodType<ViewNodeShape>;
export declare const viewSpecSchema: z.ZodType<ViewSpec>;
/**
 * JSON Schema for the wire format, for LLM structured output / tool definitions.
 *
 * `$each`/`$cond`/component nodes are mutually recursive, so the result uses
 * `$ref` cycles — check your provider tolerates them before wiring it into a
 * response_format, and fall back to prompting with the shape if not.
 */
export declare function viewSpecJsonSchema(): Record<string, unknown>;
export {};
//# sourceMappingURL=zod.d.ts.map