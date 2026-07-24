import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RendererAdapters } from "../adapters/types";
import type { EventHandlerSpec, FormDef } from "../spec/types";
import {
  createEventCallback,
  type EventHandlerContext,
  validateField,
  validateForm,
} from "./event-handler";
import type { FormState } from "./form-state";
import { EMPTY_REF_CONTEXT } from "./resolve-ref";

function makeFormState(values: Record<string, unknown> = {}): FormState {
  return {
    values,
    errors: {},
    setValue: vi.fn(),
    setError: vi.fn(),
    clearError: vi.fn(),
    reset: vi.fn(),
  };
}

function makeContext(
  adapters: RendererAdapters = {},
  overrides: Partial<EventHandlerContext> = {},
): EventHandlerContext {
  return {
    adapters,
    formStates: {},
    formDefs: {},
    dialogs: { open: vi.fn(), close: vi.fn() },
    setState: vi.fn(),
    refContext: EMPTY_REF_CONTEXT,
    ...overrides,
  };
}

const fire = (handler: EventHandlerSpec, context: EventHandlerContext) =>
  createEventCallback(handler, context)();

describe("validateField", () => {
  it.each([
    [undefined, "This field is required"],
    [null, "This field is required"],
    ["", "This field is required"],
    [[], "This field is required"],
    [false, "This field is required"],
  ])("treats %j as missing", (value, message) => {
    expect(validateField(value, { required: true })).toBe(message);
  });

  it("uses a custom message", () => {
    expect(validateField("", { required: true, message: "Need it" })).toBe("Need it");
  });

  it("skips other rules for an empty optional field", () => {
    expect(validateField("", { minLength: 5 })).toBeNull();
    expect(validateField(null, { min: 5 })).toBeNull();
  });

  it("checks string length", () => {
    expect(validateField("ab", { minLength: 3 })).toContain("at least 3");
    expect(validateField("abcd", { maxLength: 3 })).toContain("at most 3");
    expect(validateField("abc", { minLength: 3, maxLength: 3 })).toBeNull();
  });

  it("checks a pattern, and treats an invalid pattern as a failure", () => {
    expect(validateField("abc", { pattern: "^[0-9]+$" })).toBe("Invalid format");
    expect(validateField("123", { pattern: "^[0-9]+$" })).toBeNull();
    expect(validateField("x", { pattern: "([" })).toBe("Invalid format");
  });

  it("checks numeric bounds", () => {
    expect(validateField(4, { min: 5 })).toContain("at least 5");
    expect(validateField(6, { max: 5 })).toContain("at most 5");
    expect(validateField(5, { min: 5, max: 5 })).toBeNull();
  });

  it("applies numeric bounds to numeric strings", () => {
    // A text input yields strings; without coercion min/max would never fire —
    // the bug this replaces.
    expect(validateField("4", { min: 5 })).toContain("at least 5");
    expect(validateField("6", { max: 5 })).toContain("at most 5");
  });

  it("leaves non-numeric strings to the string rules", () => {
    expect(validateField("abc", { min: 5 })).toBeNull();
  });
});

describe("validateForm", () => {
  const def: FormDef = {
    fields: {
      email: { initialValue: "", validation: { required: true } },
      note: { initialValue: "" },
    },
  };

  it("reports errors and returns false", () => {
    const state = makeFormState({ email: "", note: "" });
    expect(validateForm(def, state)).toBe(false);
    expect(state.setError).toHaveBeenCalledWith("email", "This field is required");
  });

  it("clears errors and returns true when clean", () => {
    const state = makeFormState({ email: "a@b.c", note: "" });
    expect(validateForm(def, state)).toBe(true);
    expect(state.clearError).toHaveBeenCalledWith("email");
    expect(state.setError).not.toHaveBeenCalled();
  });

  it("clears errors for fields with no rules", () => {
    const state = makeFormState({ email: "a@b.c", note: "x" });
    validateForm(def, state);
    expect(state.clearError).toHaveBeenCalledWith("note");
  });
});

describe("actions", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("navigate calls the adapter", () => {
    const navigate = vi.fn();
    fire({ action: "navigate", payload: { path: "/x" } }, makeContext({ navigate }));
    expect(navigate).toHaveBeenCalledWith("/x");
  });

  it("navigate warns on a missing path", () => {
    const navigate = vi.fn();
    fire({ action: "navigate", payload: {} }, makeContext({ navigate }));
    expect(navigate).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("showToast passes variant and title through", () => {
    const toast = vi.fn();
    fire(
      { action: "showToast", payload: { message: "hi", variant: "error", title: "T" } },
      makeContext({ toast }),
    );
    expect(toast).toHaveBeenCalledWith("hi", { variant: "error", title: "T" });
  });

  it("showToast falls back to a default message", () => {
    const toast = vi.fn();
    fire({ action: "showToast", payload: {} }, makeContext({ toast }));
    expect(toast).toHaveBeenCalledWith("Notification", expect.anything());
  });

  it("openDialog and closeDialog reach the dialog api", () => {
    const context = makeContext();
    fire({ action: "openDialog", payload: { dialogId: "d" } }, context);
    fire({ action: "closeDialog", payload: { dialogId: "d" } }, context);
    expect(context.dialogs.open).toHaveBeenCalledWith("d");
    expect(context.dialogs.close).toHaveBeenCalledWith("d");
  });

  it("setState requires a literal key", () => {
    const context = makeContext();
    fire({ action: "setState", payload: { key: "k", value: 1 } }, context);
    expect(context.setState).toHaveBeenCalledWith("k", 1);

    fire({ action: "setState", payload: { value: 1 } }, context);
    expect(context.setState).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();
  });

  it("resetForm resets a declared form and ignores an unknown one", () => {
    const form = makeFormState();
    const context = makeContext({}, { formStates: { f: form } });
    fire({ action: "resetForm", payload: { form: "f" } }, context);
    expect(form.reset).toHaveBeenCalled();
    expect(() => fire({ action: "resetForm", payload: { form: "nope" } }, context)).not.toThrow();
  });

  it("accepts formId as an alias for form", () => {
    const form = makeFormState();
    const context = makeContext({}, { formStates: { f: form } });
    fire({ action: "resetForm", payload: { formId: "f" } }, context);
    expect(form.reset).toHaveBeenCalled();
  });

  it("submitForm runs onSubmit only when valid", () => {
    const toast = vi.fn();
    const form = makeFormState({ email: "" });
    const def: FormDef = {
      fields: { email: { initialValue: "", validation: { required: true } } },
      onSubmit: { action: "showToast", payload: { message: "ok" } },
    };
    const context = makeContext({ toast }, { formStates: { f: form }, formDefs: { f: def } });

    fire({ action: "submitForm", payload: { form: "f" } }, context);
    expect(toast).not.toHaveBeenCalled();

    form.values.email = "a@b.c";
    fire({ action: "submitForm", payload: { form: "f" } }, context);
    expect(toast).toHaveBeenCalledWith("ok", expect.anything());
  });

  it("submitForm warns when the form is not declared", () => {
    fire({ action: "submitForm", payload: { form: "ghost" } }, makeContext());
    expect(warn).toHaveBeenCalled();
  });

  it("warns for an unrecognised action instead of throwing", () => {
    expect(() =>
      fire({ action: "dropTables" } as unknown as EventHandlerSpec, makeContext()),
    ).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it("stops runaway handler nesting", () => {
    const toast = vi.fn();
    const context = makeContext({ toast });
    // A form whose onSubmit submits itself would otherwise recurse forever.
    const def: FormDef = {
      fields: {},
      onSubmit: { action: "submitForm", payload: { form: "f" } },
    };
    context.formDefs = { f: def };
    context.formStates = { f: makeFormState() };
    expect(() => fire({ action: "submitForm", payload: { form: "f" } }, context)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("nesting"));
  });
});

describe("apiCall", () => {
  it("issues the request through the injected fetch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") });
    const onSuccess: EventHandlerSpec = { action: "showToast", payload: { message: "done" } };
    const toast = vi.fn();
    fire(
      {
        action: "apiCall",
        payload: { endpoint: "/save", method: "POST", body: { a: 1 }, onSuccess },
      },
      makeContext({ fetch: fetchImpl, toast }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/save",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ a: 1 }) }),
    );
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("done", expect.anything()));
  });

  it("blocks a cross-origin endpoint by default", () => {
    const fetchImpl = vi.fn();
    const toast = vi.fn();
    fire(
      { action: "apiCall", payload: { endpoint: "https://evil.example.com/x" } },
      makeContext({ fetch: fetchImpl, toast }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("blocked"), expect.anything());
  });

  it("blocks a protocol-relative endpoint", () => {
    const fetchImpl = vi.fn();
    fire(
      { action: "apiCall", payload: { endpoint: "//evil.example.com/x" } },
      makeContext({ fetch: fetchImpl }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("downgrades a disallowed method to GET rather than issuing it", () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") });
    fire(
      { action: "apiCall", payload: { endpoint: "/x", method: "TRACE" } },
      makeContext({ fetch: fetchImpl }),
    );
    expect(fetchImpl).toHaveBeenCalledWith("/x", expect.objectContaining({ method: "GET" }));
  });

  it("omits a body on methods that cannot carry one", () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("") });
    fire(
      { action: "apiCall", payload: { endpoint: "/x", method: "GET", body: { a: 1 } } },
      makeContext({ fetch: fetchImpl }),
    );
    expect(fetchImpl.mock.calls[0][1]).not.toHaveProperty("body");
  });

  it("runs onError for a failed response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("boom") });
    const toast = vi.fn();
    fire(
      {
        action: "apiCall",
        payload: {
          endpoint: "/x",
          onError: { action: "showToast", payload: { message: "failed" } },
        },
      },
      makeContext({ fetch: fetchImpl, toast }),
    );
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("failed", expect.anything()));
  });

  it("toasts a default error when no onError is declared", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const toast = vi.fn();
    fire({ action: "apiCall", payload: { endpoint: "/x" } }, makeContext({ fetch: fetchImpl, toast }));
    await vi.waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.stringContaining("offline"), expect.anything()),
    );
  });

  it("warns and does nothing without an endpoint", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchImpl = vi.fn();
    fire({ action: "apiCall", payload: {} }, makeContext({ fetch: fetchImpl }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
