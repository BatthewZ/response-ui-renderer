import {
  ALLOWED_HTTP_METHODS,
  defaultAllowUrl,
  METHODS_WITH_BODY,
  normalizeMethod,
  type RendererAdapters,
} from "../adapters/types";
import {
  type EventHandlerSpec,
  type FormDef,
  isEventHandlerSpec,
  type ValidationRules,
} from "../spec/types";
import type { FormState } from "./form-state";
import { readReportedValue } from "./reported-value";
import { type RefContext, resolveDeep } from "./resolve-ref";

/** Guards against a document wiring onSuccess → onError → onSuccess forever. */
const MAX_HANDLER_DEPTH = 5;

/**
 * Reserved ref root, readable only from inside a handler payload.
 *
 * Without it a callback's argument is unreachable, so no component can report a
 * value back — `Pagination` (controlled-only, no `defaultPage`) could never
 * move, and every `onValueChange` was write-only. It shadows a `$each` alias of
 * the same name, so `event` is reserved inside handlers.
 */
export const EVENT_REF_ROOT = "event";

/**
 * `event.value` — the first argument, DOM events unwrapped to their value.
 * `event.args.0`, `event.args.1`, … — raw positionals, for callbacks that
 * report more than one thing.
 *
 * Deliberately not propagated into `onSuccess`/`onError` chains: those run after
 * a request, not in response to the original interaction, so an `event` there
 * would name a value that is no longer the one the user acted on.
 */
function withEventScope(base: RefContext, args: readonly unknown[]): RefContext {
  return {
    ...base,
    vars: {
      ...base.vars,
      [EVENT_REF_ROOT]: { value: readReportedValue(args[0]), args },
    },
  };
}

export type EventHandlerContext = {
  adapters: RendererAdapters;
  formStates: Record<string, FormState>;
  formDefs: Readonly<Record<string, FormDef>>;
  dialogs: { open: (id: string) => void; close: (id: string) => void };
  setState: (key: string, value: unknown) => void;
  refContext: RefContext;
};

/**
 * Validation runs in a fixed order so a required-but-empty field reports
 * "required" rather than a confusing length error.
 */
export function validateField(value: unknown, rules: ValidationRules): string | null {
  if (rules.required) {
    const empty =
      value == null ||
      value === "" ||
      value === false ||
      (Array.isArray(value) && value.length === 0);
    if (empty) return rules.message ?? "This field is required";
  }

  if (value == null || value === "") return null;

  if (typeof value === "string") {
    if (rules.minLength != null && value.length < rules.minLength) {
      return rules.message ?? `Must be at least ${rules.minLength} characters`;
    }
    if (rules.maxLength != null && value.length > rules.maxLength) {
      return rules.message ?? `Must be at most ${rules.maxLength} characters`;
    }
    if (rules.pattern != null) {
      try {
        if (!new RegExp(rules.pattern).test(value)) return rules.message ?? "Invalid format";
      } catch {
        return rules.message ?? "Invalid format";
      }
    }
  }

  // Numeric bounds also apply to numeric strings: a text input bound to a
  // `min`/`max` rule would otherwise skip validation entirely.
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
        ? Number(value)
        : null;

  if (numeric != null) {
    if (rules.min != null && numeric < rules.min) {
      return rules.message ?? `Must be at least ${rules.min}`;
    }
    if (rules.max != null && numeric > rules.max) {
      return rules.message ?? `Must be at most ${rules.max}`;
    }
  }

  return null;
}

/** Runs every rule in a form. Returns true when the form is clean. */
export function validateForm(def: FormDef, state: FormState): boolean {
  let valid = true;
  for (const [fieldName, fieldDef] of Object.entries(def.fields ?? {})) {
    if (!fieldDef?.validation) {
      state.clearError(fieldName);
      continue;
    }
    const error = validateField(state.values[fieldName], fieldDef.validation);
    if (error) {
      state.setError(fieldName, error);
      valid = false;
    } else {
      state.clearError(fieldName);
    }
  }
  return valid;
}

function warn(message: string): void {
  console.warn(`[response-ui-renderer] ${message}`);
}

/**
 * Turns a declarative handler into a callback.
 *
 * Every side effect goes through `context.adapters`, so the wire format stays
 * free of any host's router, server routes or auth model.
 */
export function createEventCallback(
  handler: EventHandlerSpec,
  context: EventHandlerContext,
  depth = 0,
): (...args: unknown[]) => void {
  if (depth > MAX_HANDLER_DEPTH) {
    warn(`handler nesting exceeded ${MAX_HANDLER_DEPTH}; ignoring`);
    return () => undefined;
  }

  return (...args: unknown[]) => {
    const raw = handler.payload ?? {};
    const { adapters } = context;
    const refContext = withEventScope(context.refContext, args);
    const payload = resolveDeep(raw, refContext) as Record<string, unknown>;

    switch (handler.action) {
      case "submitForm": {
        const formId = (raw.form ?? raw.formId) as string | undefined;
        if (typeof formId !== "string") {
          warn("submitForm: payload.form is required");
          return;
        }
        const state = context.formStates[formId];
        const def = context.formDefs[formId];
        if (!state || !def) {
          warn(`submitForm: form "${formId}" is not declared in spec.forms`);
          return;
        }
        if (!validateForm(def, state)) return;
        if (def.onSubmit) createEventCallback(def.onSubmit, context, depth + 1)();
        return;
      }

      case "resetForm": {
        const formId = (raw.form ?? raw.formId) as string | undefined;
        if (typeof formId === "string") context.formStates[formId]?.reset();
        return;
      }

      case "navigate": {
        const path = payload.path;
        if (typeof path !== "string" || path.length === 0) {
          warn("navigate: payload.path is required");
          return;
        }
        if (!adapters.navigate) {
          warn(`navigate: no navigate adapter supplied; "${path}" ignored`);
          return;
        }
        adapters.navigate(path);
        return;
      }

      case "showToast": {
        const message = payload.message;
        if (!adapters.toast) {
          warn("showToast: no toast adapter and no ToastProvider above the renderer");
          return;
        }
        adapters.toast(typeof message === "string" ? message : "Notification", {
          variant: payload.variant as ToastVariantLike,
          title: typeof payload.title === "string" ? payload.title : undefined,
        });
        return;
      }

      case "openDialog": {
        if (typeof payload.dialogId === "string") context.dialogs.open(payload.dialogId);
        return;
      }

      case "closeDialog": {
        if (typeof payload.dialogId === "string") context.dialogs.close(payload.dialogId);
        return;
      }

      case "setState": {
        // `key` is read raw: a $ref-derived key would make state shape depend on
        // data, which no document can then reliably read back.
        const key = raw.key;
        if (typeof key !== "string" || key.length === 0) {
          warn("setState: payload.key must be a non-empty string");
          return;
        }
        context.setState(key, payload.value);
        return;
      }

      case "apiCall": {
        runApiCall(raw, payload, context, depth);
        return;
      }

      default: {
        warn(`unknown action "${String(handler.action)}"`);
      }
    }
  };
}

type ToastVariantLike = "success" | "warning" | "error" | "info" | undefined;

function runApiCall(
  raw: Record<string, unknown>,
  payload: Record<string, unknown>,
  context: EventHandlerContext,
  depth: number,
): void {
  const { adapters } = context;
  const endpoint = raw.endpoint;
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    warn("apiCall: payload.endpoint is required");
    return;
  }

  const method = normalizeMethod(raw.method);
  if (typeof raw.method === "string" && !ALLOWED_HTTP_METHODS.includes(raw.method.toUpperCase())) {
    warn(`apiCall: method "${raw.method}" is not allowed; using GET`);
  }

  const allow = adapters.allowUrl ?? defaultAllowUrl;
  if (!allow(endpoint)) {
    adapters.toast?.("Request blocked: endpoint not allowed", {
      variant: "error",
      title: "Request Blocked",
    });
    warn(`apiCall: blocked "${endpoint}"`);
    return;
  }

  const init: RequestInit = { method };
  if (payload.body !== undefined && METHODS_WITH_BODY.includes(method)) {
    init.body = JSON.stringify(payload.body);
    init.headers = { "Content-Type": "application/json" };
  }

  const doFetch = adapters.fetch ?? ((url: string, opts: RequestInit) => fetch(url, opts));

  void doFetch(endpoint, init)
    .then(async (res) => {
      if (res.ok) {
        if (isEventHandlerSpec(raw.onSuccess)) {
          createEventCallback(raw.onSuccess, context, depth + 1)();
        }
        return;
      }
      if (isEventHandlerSpec(raw.onError)) {
        createEventCallback(raw.onError, context, depth + 1)();
        return;
      }
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      adapters.toast?.(`Request failed: ${text}`, { variant: "error", title: "Request Failed" });
    })
    .catch((err: unknown) => {
      if (isEventHandlerSpec(raw.onError)) {
        createEventCallback(raw.onError, context, depth + 1)();
        return;
      }
      const message = err instanceof Error ? err.message : "Network error";
      adapters.toast?.(`Request failed: ${message}`, { variant: "error", title: "Request Failed" });
    });
}
