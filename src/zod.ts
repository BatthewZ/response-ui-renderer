import { z } from "zod";

import type { ViewSpec } from "./spec/types";

/**
 * A Zod mirror of the ViewSpec wire format.
 *
 * Deliberately a separate entry point with `zod` as an OPTIONAL peer. The core
 * renderer validates with `validateViewSpec` and has no runtime dependencies,
 * because `@batthewz/response-ui-react-components` commits to letting consumers
 * bring their own validator. Importing from here is opt-in: nobody pays for Zod
 * who does not ask for it.
 *
 * It exists because the interesting work happens *before* rendering:
 *
 * - **Constraining generation.** `z.toJSONSchema(viewSpecSchema)` produces a
 *   JSON Schema you can hand to an LLM as a structured-output / tool schema, so
 *   the model is shaped into valid documents instead of being corrected after.
 * - **Server-side gates.** Producers validating documents before persisting them
 *   already speak Zod; this gives them the canonical schema rather than a
 *   hand-maintained copy that drifts from the renderer.
 *
 * WHAT IS AND IS NOT GUARANTEED (mirrors the token mirror between
 * response-ui-css and response-ui-tw-merge — a second expression of one
 * contract, and the same known fragility):
 *
 * - Guaranteed: this schema and `validateViewSpec` agree on **conformance** for
 *   every document. `zod.test.ts` runs both over a shared corpus and fails on
 *   any disagreement about `result.ok`.
 * - NOT guaranteed: that this schema reproduces the renderer's advisory policy.
 *   `props` is an open record here, so a forbidden prop, a `javascript:` URL or
 *   an unknown action inside a prop parses cleanly. Those are warnings from
 *   `validateViewSpec` and are enforced by the renderer at render time, which
 *   drops the offending prop. Use `validateViewSpec` if you want to see them.
 *
 * Change either side, run the tests.
 */

const eventActionSchema = z.enum([
  "submitForm",
  "resetForm",
  "navigate",
  "showToast",
  "apiCall",
  "openDialog",
  "closeDialog",
  "setState",
]);

export const eventHandlerSchema = z.object({
  action: eventActionSchema,
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const validationRulesSchema = z.object({
  required: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  message: z.string().optional(),
});

export const formFieldSchema = z.object({
  initialValue: z.unknown(),
  validation: validationRulesSchema.optional(),
});

export const formDefSchema = z.object({
  fields: z.record(z.string(), formFieldSchema),
  onSubmit: eventHandlerSchema.optional(),
});

export const dataBindingSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("static"), value: z.unknown() }),
  z.object({
    type: z.literal("api"),
    endpoint: z.string(),
    method: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("source"),
    source: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
  }),
]);

type ViewNodeShape =
  | string
  | { component: string; props?: Record<string, unknown>; children?: ViewNodeShape[] }
  | { $ref: string }
  | { $each: string; as: string; node: ViewNodeShape }
  | { $cond: string; then: ViewNodeShape; else?: ViewNodeShape };

export const refNodeSchema = z.object({ $ref: z.string() });

export const viewNodeSchema: z.ZodType<ViewNodeShape> = z.lazy(() =>
  z.union([
    z.string(),
    refNodeSchema,
    z.object({
      $each: z.string(),
      as: z.string().min(1),
      node: viewNodeSchema,
    }),
    z.object({
      $cond: z.string(),
      then: viewNodeSchema,
      else: viewNodeSchema.optional(),
    }),
    z.object({
      component: z.string().min(1),
      props: z.record(z.string(), z.unknown()).optional(),
      children: z.array(viewNodeSchema).optional(),
    }),
  ]),
);

export const viewSpecSchema: z.ZodType<ViewSpec> = z.object({
  version: z.literal(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  theme: z.string().optional(),
  themeOverrides: z.record(z.string(), z.string()).optional(),
  data: z.record(z.string(), dataBindingSchema).optional(),
  forms: z.record(z.string(), formDefSchema).optional(),
  state: z.record(z.string(), z.unknown()).optional(),
  root: viewNodeSchema,
});

/**
 * JSON Schema for the wire format, for LLM structured output / tool definitions.
 *
 * `$each`/`$cond`/component nodes are mutually recursive, so the result uses
 * `$ref` cycles — check your provider tolerates them before wiring it into a
 * response_format, and fall back to prompting with the shape if not.
 */
export function viewSpecJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(viewSpecSchema, { io: "input", unrepresentable: "any" });
}
