import {
  errorsOf,
  validateViewSpec,
  type ValidationIssue,
  type ViewSpec,
  warningsOf,
} from "../src/spec";

/** Worst thing the validator found — the gate on the seam paints itself from this. */
export type Verdict = "clean" | "warning" | "error";

export interface SpecState {
  spec: ViewSpec | null;
  /** Set only when the text is not JSON at all. Conformance failures are `errors`. */
  parseError: string | null;
  /** Character offset the parser rejected, when the engine reports one. */
  parseOffset: number | null;
  /** Nothing typed yet — an invitation, not a syntax complaint. */
  empty: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  verdict: Verdict;
}

const EMPTY_MESSAGE = "Pick an example above, or paste a ViewSpec here.";

const failure = (
  parseError: string,
  parseOffset: number | null,
  empty = false,
): SpecState => ({
  spec: null,
  parseError,
  parseOffset,
  empty,
  issues: [],
  errors: [],
  warnings: [],
  verdict: "error",
});

export function readSpec(text: string): SpecState {
  if (text.trim() === "") return failure(EMPTY_MESSAGE, null, true);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const message = (e as Error).message;
    // V8 and SpiderMonkey both append "at position N"; Safari does not. No offset
    // means no jump-to-error, not a broken parse report.
    const at = /position (\d+)/.exec(message);
    return failure(message, at ? Number(at[1]) : null);
  }

  const result = validateViewSpec(parsed);
  const errors = errorsOf(result.issues);
  const warnings = warningsOf(result.issues);
  return {
    spec: result.ok ? result.spec : null,
    parseError: null,
    parseOffset: null,
    empty: false,
    issues: result.issues,
    errors,
    warnings,
    verdict: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "clean",
  };
}

/** What the verdict means, in the words the page uses everywhere it is shown. */
export function verdictSummary(state: SpecState): string {
  if (state.empty) return "Nothing to render";
  if (state.parseError) return "Not valid JSON";
  if (state.errors.length > 0) {
    return `${state.errors.length} ${state.errors.length === 1 ? "error" : "errors"}`;
  }
  if (state.warnings.length > 0) {
    return `${state.warnings.length} ${state.warnings.length === 1 ? "warning" : "warnings"}`;
  }
  return "Valid document";
}

export function verdictDetail(state: SpecState): string {
  if (state.parseError) return state.parseError;
  if (state.errors.length > 0) {
    return state.errors.length === 1
      ? "The document does not conform. Fix this to render it."
      : "The document does not conform. Fix these to render it.";
  }
  if (state.warnings.length > 0) {
    return state.warnings.length === 1
      ? "It renders, but this part will not do what it looks like."
      : "It renders, but these parts will not do what they look like.";
  }
  return "Conforms to the ViewSpec contract, with nothing flagged.";
}
