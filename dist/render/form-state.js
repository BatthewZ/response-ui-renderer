"use client";
import { useCallback, useMemo, useState } from "react";
//#region src/render/form-state.ts
var EMPTY_FORMS = Object.freeze({});
/**
* Holds every form in the document behind two `useState` calls.
*
* A `useState` per form would put a hook inside a loop, which breaks the Rules
* of Hooks the moment a document adds or removes a form — and documents are
* expected to change identity at runtime (a new LLM turn replaces the spec).
*/
function useFormsState(forms) {
	const initialValues = useMemo(() => {
		const init = {};
		for (const [formKey, def] of Object.entries(forms)) {
			const values = {};
			const fields = def?.fields;
			if (fields && typeof fields === "object") for (const [fieldKey, field] of Object.entries(fields)) values[fieldKey] = field?.initialValue;
			init[formKey] = values;
		}
		return init;
	}, [forms]);
	const [allValues, setAllValues] = useState(initialValues);
	const [allErrors, setAllErrors] = useState({});
	const [prevInitial, setPrevInitial] = useState(initialValues);
	if (prevInitial !== initialValues) {
		setPrevInitial(initialValues);
		setAllValues(initialValues);
		setAllErrors({});
	}
	const setValue = useCallback((formKey, field, value) => {
		setAllValues((prev) => ({
			...prev,
			[formKey]: {
				...prev[formKey],
				[field]: value
			}
		}));
		setAllErrors((prev) => {
			const formErrors = { ...prev[formKey] ?? {} };
			delete formErrors[field];
			return {
				...prev,
				[formKey]: formErrors
			};
		});
	}, []);
	const setError = useCallback((formKey, field, error) => {
		setAllErrors((prev) => ({
			...prev,
			[formKey]: {
				...prev[formKey] ?? {},
				[field]: error
			}
		}));
	}, []);
	const clearError = useCallback((formKey, field) => {
		setAllErrors((prev) => {
			const formErrors = { ...prev[formKey] ?? {} };
			delete formErrors[field];
			return {
				...prev,
				[formKey]: formErrors
			};
		});
	}, []);
	const reset = useCallback((formKey) => {
		setAllValues((prev) => ({
			...prev,
			[formKey]: initialValues[formKey] ?? {}
		}));
		setAllErrors((prev) => ({
			...prev,
			[formKey]: {}
		}));
	}, [initialValues]);
	return useMemo(() => {
		const result = {};
		for (const formKey of Object.keys(forms)) result[formKey] = {
			values: allValues[formKey] ?? {},
			errors: allErrors[formKey] ?? {},
			setValue: (field, value) => setValue(formKey, field, value),
			setError: (field, error) => setError(formKey, field, error),
			clearError: (field) => clearError(formKey, field),
			reset: () => reset(formKey)
		};
		return result;
	}, [
		forms,
		allValues,
		allErrors,
		setValue,
		setError,
		clearError,
		reset
	]);
}
/** Projects form state into the shape `$ref` paths address. */
function toFormRefState(forms) {
	const out = {};
	for (const [name, state] of Object.entries(forms)) out[name] = {
		values: state.values,
		errors: state.errors
	};
	return out;
}
//#endregion
export { EMPTY_FORMS, toFormRefState, useFormsState };

//# sourceMappingURL=form-state.js.map