/**
 * The ViewSpec wire format — a JSON document describing a response-ui page.
 *
 * This is a published contract: third parties author documents against it, so
 * node shapes, action names and binding types are frozen once released.
 */

/** Reads a value out of the render context by dot path. */
export type RefNode = { $ref: string };

/** Repeats `node` once per element of the array at `$each`. */
export type EachNode = { $each: string; as: string; node: ViewNode };

/** Renders `then` when `$cond` resolves truthy, else `else`. */
export type CondNode = { $cond: string; then: ViewNode; else?: ViewNode };

/** Instantiates a registered component. `component` may be `Parent.Child`. */
export type ComponentNode = {
  component: string;
  props?: Record<string, unknown>;
  children?: ViewNode[];
};

export type ViewNode = string | ComponentNode | RefNode | EachNode | CondNode;

/**
 * Two-way binding to `formName.fieldName`.
 *
 * Canonical spelling is a bare prop key — `props: { $field: "contact.email" }` —
 * which wires `value`/`checked` and `onChange` together from one declaration.
 * The longhand `props: { value: { $field: "contact.email" } }` is also accepted.
 */
export const FIELD_BINDING_KEY = "$field";

export type FieldBinding = { $field: string };

export type EventAction =
  | "submitForm"
  | "resetForm"
  | "navigate"
  | "showToast"
  | "apiCall"
  | "openDialog"
  | "closeDialog"
  | "setState";

export type EventHandlerSpec = {
  action: EventAction;
  payload?: Record<string, unknown>;
};

export type ValidationRules = {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  message?: string;
};

export type FormFieldDef = {
  initialValue: unknown;
  validation?: ValidationRules;
};

export type FormDef = {
  fields: Record<string, FormFieldDef>;
  onSubmit?: EventHandlerSpec;
};

/** A literal value baked into the document. */
export type StaticBinding = { type: "static"; value: unknown };

/**
 * An HTTP request issued on mount. Resolved by `adapters.fetchData`, which
 * defaults to `globalThis.fetch` — the renderer never rewrites the URL.
 */
export type ApiBinding = {
  type: "api";
  endpoint: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

/**
 * A named lookup delegated to `adapters.resolveSource`. The escape hatch for
 * host-specific data access (credentialed proxies, RPC, in-memory stores)
 * without putting any host's server contract into the wire format.
 */
export type SourceBinding = {
  type: "source";
  source: string;
  params?: Record<string, unknown>;
};

export type DataBinding = StaticBinding | ApiBinding | SourceBinding;

export type ViewSpec = {
  version: 1;
  title: string;
  description?: string;
  /** Theme name written to `data-theme`. See ThemeMode for scoping caveats. */
  theme?: string;
  /** CSS custom properties (`--C-PRIMARY`, …) applied to the view subtree. */
  themeOverrides?: Record<string, string>;
  data?: Record<string, DataBinding>;
  forms?: Record<string, FormDef>;
  root: ViewNode;
};

export const isRefNode = (n: ViewNode): n is RefNode =>
  typeof n === "object" && n !== null && "$ref" in n;

export const isEachNode = (n: ViewNode): n is EachNode =>
  typeof n === "object" && n !== null && "$each" in n;

export const isCondNode = (n: ViewNode): n is CondNode =>
  typeof n === "object" && n !== null && "$cond" in n;

export const isComponentNode = (n: ViewNode): n is ComponentNode =>
  typeof n === "object" && n !== null && "component" in n;

export const isFieldBinding = (v: unknown): v is FieldBinding =>
  typeof v === "object" && v !== null && "$field" in v &&
  typeof (v as FieldBinding).$field === "string";

export const isRefValue = (v: unknown): v is RefNode =>
  typeof v === "object" && v !== null && "$ref" in v &&
  typeof (v as RefNode).$ref === "string";

export const isEventHandlerSpec = (v: unknown): v is EventHandlerSpec =>
  typeof v === "object" && v !== null && "action" in v &&
  typeof (v as EventHandlerSpec).action === "string";
