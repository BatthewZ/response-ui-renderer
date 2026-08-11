import componentDocs from "../registry/component-docs.json";
import { COMPONENT_NOTES } from "../registry/component-notes";
import { defaultContracts } from "../registry/default-contracts";
import { type ComponentContracts, extendContracts } from "../spec/contracts";

/**
 * The documented contracts, and the sections they are documented under.
 *
 * Split out of the reference renderer so that reading them costs only what they
 * are: the renderer imports `VIEWSPEC.md` as text to carry its prose around the
 * generated tables, and anything that wants the *facts* — the builder's palette
 * and inspector, a host's own tooling — has no use for forty-odd kilobytes of
 * this package's own words. `./reference` re-exports every name here unchanged.
 */

/**
 * `defaultContracts` plus everything only a reference reads — the prop tables,
 * the slot keys, and the curated category and note.
 *
 * A separate value behind a separate entry point, because none of that is read
 * at render or validate time: it is 60-odd kilobytes of documentation, and a
 * package that ships zero runtime dependencies should not put it in the path of
 * a page that renders one card, nor in a server-side validation gate.
 *
 * Extend this, not `defaultContracts`, when generating a reference:
 * `renderReferenceRegions(extendContracts(defaultReferenceContracts, yours))`.
 */
export function referenceContracts(docs: ComponentContracts): ComponentContracts {
  // Derived facts first: their key order is the library's own declaration
  // order, which is the order compound parts are listed in. The curated notes
  // land last because they are the only hand-written layer.
  return extendContracts(extendContracts(docs, defaultContracts), COMPONENT_NOTES);
}

export const defaultReferenceContracts: ComponentContracts = referenceContracts(componentDocs);

export type ReferenceCategory = {
  /** Heading the section is emitted under. */
  name: string;
  /** One line of standing advice for everything in it. */
  blurb: string;
};

/**
 * The sections `@batthewz/response-ui-react-components` is documented under.
 *
 * Order is the reading order of the reference. A host documenting its own
 * components passes its own list; the built-in one is exported because the
 * common case is adding a section to these rather than replacing them.
 */
export const DEFAULT_CATEGORIES: readonly ReferenceCategory[] = [
  {
    name: "Layout",
    blurb: "Structure and spacing. The `r1`–`r6` scale is **inverted** — `r1` is the largest step.",
  },
  { name: "Typography", blurb: "Text and inline marks." },
  {
    name: "Action",
    blurb:
      'Buttons and triggers. `Button` defaults to `type: "button"` — a submit control must say so explicitly.',
  },
  { name: "Feedback", blurb: "Status, progress and loading." },
  { name: "Data", blurb: "Tables, metrics and lists driven by `data` + `$each`." },
  {
    name: "Form",
    blurb: "Bind every control with `$field`; declare the field in `spec.forms` first.",
  },
  {
    name: "Overlay",
    blurb: "Floating surfaces. Dialogs need a literal `id` so an action can target them.",
  },
  { name: "Navigation", blurb: "Disclosure, tabs, wayfinding and app chrome." },
  { name: "Media", blurb: "Images, rails and showcases." },
  {
    name: "Animation",
    blurb:
      "Presentational only. Pass `animate: false` when the content must be readable without a viewport observer.",
  },
];
