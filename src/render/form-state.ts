"use client";

import { useCallback, useMemo, useState } from "react";

import type { FormDef } from "../spec/types";

export type FormState = {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  setValue: (field: string, value: unknown) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  reset: () => void;
};

export const EMPTY_FORMS: Readonly<Record<string, FormDef>> = Object.freeze({});

/**
 * Holds every form in the document behind two `useState` calls.
 *
 * A `useState` per form would put a hook inside a loop, which breaks the Rules
 * of Hooks the moment a document adds or removes a form — and documents are
 * expected to change identity at runtime (a new LLM turn replaces the spec).
 */
export function useFormsState(forms: Readonly<Record<string, FormDef>>): Record<string, FormState> {
  const initialValues = useMemo(() => {
    const init: Record<string, Record<string, unknown>> = {};
    for (const [formKey, def] of Object.entries(forms)) {
      const values: Record<string, unknown> = {};
      const fields = def?.fields;
      if (fields && typeof fields === "object") {
        for (const [fieldKey, field] of Object.entries(fields)) {
          values[fieldKey] = field?.initialValue;
        }
      }
      init[formKey] = values;
    }
    return init;
  }, [forms]);

  const [allValues, setAllValues] = useState(initialValues);
  const [allErrors, setAllErrors] = useState<Record<string, Record<string, string>>>({});

  // Re-initialise when the document changes, during render rather than in an
  // effect, so the first paint of a new spec never shows the previous one's values.
  const [prevInitial, setPrevInitial] = useState(initialValues);
  if (prevInitial !== initialValues) {
    setPrevInitial(initialValues);
    setAllValues(initialValues);
    setAllErrors({});
  }

  const setValue = useCallback((formKey: string, field: string, value: unknown) => {
    setAllValues((prev) => ({
      ...prev,
      [formKey]: { ...prev[formKey], [field]: value },
    }));
    setAllErrors((prev) => {
      const formErrors = { ...(prev[formKey] ?? {}) };
      delete formErrors[field];
      return { ...prev, [formKey]: formErrors };
    });
  }, []);

  const setError = useCallback((formKey: string, field: string, error: string) => {
    setAllErrors((prev) => ({
      ...prev,
      [formKey]: { ...(prev[formKey] ?? {}), [field]: error },
    }));
  }, []);

  const clearError = useCallback((formKey: string, field: string) => {
    setAllErrors((prev) => {
      const formErrors = { ...(prev[formKey] ?? {}) };
      delete formErrors[field];
      return { ...prev, [formKey]: formErrors };
    });
  }, []);

  const reset = useCallback(
    (formKey: string) => {
      setAllValues((prev) => ({ ...prev, [formKey]: initialValues[formKey] ?? {} }));
      setAllErrors((prev) => ({ ...prev, [formKey]: {} }));
    },
    [initialValues],
  );

  return useMemo(() => {
    const result: Record<string, FormState> = {};
    for (const formKey of Object.keys(forms)) {
      result[formKey] = {
        values: allValues[formKey] ?? {},
        errors: allErrors[formKey] ?? {},
        setValue: (field, value) => setValue(formKey, field, value),
        setError: (field, error) => setError(formKey, field, error),
        clearError: (field) => clearError(formKey, field),
        reset: () => reset(formKey),
      };
    }
    return result;
  }, [forms, allValues, allErrors, setValue, setError, clearError, reset]);
}

/** Projects form state into the shape `$ref` paths address. */
export function toFormRefState(
  forms: Record<string, FormState>,
): Record<string, { values: Record<string, unknown>; errors: Record<string, string> }> {
  const out: Record<string, { values: Record<string, unknown>; errors: Record<string, string> }> = {};
  for (const [name, state] of Object.entries(forms)) {
    out[name] = { values: state.values, errors: state.errors };
  }
  return out;
}
