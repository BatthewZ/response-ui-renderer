/** A form as it appears to `$ref` paths. */
export type FormRefState = {
  values: Record<string, unknown>;
  errors: Record<string, string>;
};

/**
 * Namespaces stay separate rather than being merged into one lookup object, so
 * a data key called `forms` cannot shadow the forms namespace.
 */
export type RefContext = {
  data: Record<string, unknown>;
  forms: Record<string, FormRefState>;
  vars: Record<string, unknown>;
};

export const EMPTY_REF_CONTEXT: RefContext = Object.freeze({
  data: Object.freeze({}),
  forms: Object.freeze({}),
  vars: Object.freeze({}),
});

/**
 * Walks a dot path. Own-property checks only: `data.__proto__.polluted` and
 * `x.constructor` resolve to undefined rather than to prototype members.
 * Array indices work because own-property checks succeed on them.
 */
function walk(segments: readonly string[], root: unknown): unknown {
  let current = root;
  for (const segment of segments) {
    if (current == null) return undefined;
    if (typeof current !== "object" && typeof current !== "string") return undefined;
    if (typeof current === "string") {
      // Only `length` is meaningfully addressable on a string.
      if (segment !== "length") return undefined;
      current = current.length;
      continue;
    }
    if (!Object.hasOwn(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * `forms.<name>.values.<field>` / `.errors.<field>` are canonical.
 * `forms.<name>.<field>` is accepted as shorthand for the value, so a document
 * does not have to spell out `.values.` on every binding.
 */
function resolveForms(rest: readonly string[], forms: RefContext["forms"]): unknown {
  if (rest.length === 0) return forms;
  const [name, ...tail] = rest;
  if (!Object.hasOwn(forms, name)) return undefined;
  const form = forms[name];
  if (tail.length === 0) return form;
  if (tail[0] === "values" || tail[0] === "errors") return walk(tail, form);
  return walk(tail, form.values);
}

/**
 * Resolution order, highest first:
 *  1. Explicit namespace — `data.…`, `forms.…`
 *  2. Iterator and view-state variables (`$each` aliases, `state.…`)
 *  3. Data-key shorthand — `users.0.name` → `data.users[0].name`
 *
 * Iterator variables beat data deliberately: inside `$each` the loop alias must
 * win, otherwise a data key of the same name would silently capture the body.
 */
export function resolveRef(path: string, context: RefContext): unknown {
  if (typeof path !== "string" || path.length === 0) return undefined;

  const dot = path.indexOf(".");
  const root = dot === -1 ? path : path.slice(0, dot);
  const rest = dot === -1 ? [] : path.slice(dot + 1).split(".");

  if (root === "data") return walk(rest, context.data);
  if (root === "forms") return resolveForms(rest, context.forms);
  if (Object.hasOwn(context.vars, root)) return walk(rest, context.vars[root]);
  if (Object.hasOwn(context.data, root)) return walk(rest, context.data[root]);
  return undefined;
}

/** Replaces `{ $ref }` anywhere inside a payload, preserving structure. */
export function resolveDeep(value: unknown, context: RefContext, depth = 0): unknown {
  if (depth > 20 || value == null || typeof value !== "object") return value;
  if (Object.hasOwn(value, "$ref")) {
    const ref = (value as { $ref: unknown }).$ref;
    return typeof ref === "string" ? resolveRef(ref, context) : undefined;
  }
  if (Array.isArray(value)) return value.map((item) => resolveDeep(item, context, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = resolveDeep(item, context, depth + 1);
  }
  return out;
}

/** Renders a resolved value as text. Objects are JSON, not `[object Object]`. */
export function refToText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value) ?? null;
  } catch {
    return null;
  }
}
