import notAddressable from "./not-addressable.json";

/**
 * Components a document cannot drive, and why.
 *
 * Every other name the registry exposes must be exercised by the coverage
 * corpus — `parity.coverage.test.tsx` enumerates the live registry and fails on
 * anything that is neither covered nor excused here, so a component added
 * upstream forces a decision instead of quietly going untested.
 *
 * The bar for a place on this list is that no coercion could fix it: the
 * component needs a value only host code can hold — a live `File`, a hook
 * handle, a component type — or consumes a handler's *return* value, which a
 * declarative `{ "action": … }` cannot produce.
 *
 * Held as JSON so `scripts/gen-viewspec-doc.mjs` renders the same bytes into
 * VIEWSPEC.md that the parity gate enforces here.
 */
export const NOT_ADDRESSABLE: Readonly<Record<string, string>> = notAddressable;
