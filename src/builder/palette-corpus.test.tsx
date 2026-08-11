import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NOT_ADDRESSABLE } from "../examples/not-addressable";
import { lucideIcons } from "../icons";
import { defaultRegistry } from "../registry/registry";
import { findRenderDiagnostics } from "../render/diagnostics";
import { ViewRenderer } from "../render/ViewRenderer";
import { validateViewSpec, type ViewSpec } from "../spec";
import { createBuilderCatalog } from "./catalog";
import { defaultBuilderTemplates } from "./templates";
import { emptyDocument, toSpec } from "./tree";

/**
 * The claim the palette makes by existing: drag any of these in and you get a
 * document that conforms, and that draws what you dropped.
 *
 * It is the parity gate's shape, asked of what the builder actually produces —
 * which is not the corpus, because every binding has been resolved or taken out
 * of it on the way. That step is where the damage would be, and it is invisible
 * in a screenshot: a `SearchInput` that loses its `$field` loses a required
 * `value` with it, and a `Sparkline` handed the word "Values" instead of nine
 * numbers throws inside an error boundary that the page carries on around.
 */

const catalog = createBuilderCatalog({
  templates: defaultBuilderTemplates,
  excluded: NOT_ADDRESSABLE,
});

/**
 * Components whose *name* does not say they belong inside something, but which
 * do — and why.
 *
 * A compound part spells its parent (`Accordion.Trigger`), so "this is not a
 * document on its own" is already written on it and is asserted below as the
 * rule it is. These four are the ones the library exports under a flat name
 * while still reading their `EmptyState`'s context, so nothing about the name
 * warns you. Dropped inside an `EmptyState` they are fine.
 *
 * Asserted as an exact set, in both directions: a component that starts failing
 * shows up as an unexplained entry, and one that stops shows up as an
 * explanation of something that no longer happens.
 */
const NEEDS_AN_ANCESTOR: Readonly<Record<string, string>> = {
  EmptyStateActions: "reads the size its EmptyState is rendering at",
  EmptyStateDescription: "reads the size its EmptyState is rendering at",
  EmptyStateIcon: "reads the size its EmptyState is rendering at",
  EmptyStateTitle: "reads the size its EmptyState is rendering at",
};

/**
 * Components that render nothing when nothing has happened yet, and why.
 *
 * Not a failure — each is doing what it is for — but worth naming, because
 * "drops in and draws nothing" is otherwise exactly what a broken template looks
 * like, and the check that would catch a broken one has to say which is which.
 */
const DRAWS_NOTHING: Readonly<Record<string, string>> = {
  FieldError: "shows a form's error, and a fresh document has no form and no error",
  Portal: "renders into document.body on purpose, which is outside the view",
};

const names = catalog.entries.map((entry) => entry.name);
// Only the components a document can put at its root are rendered standalone
// here. A compound part is rendered *in place* by `parity.coverage.test.tsx`,
// which renders the corpus these templates are lifted out of; what is asserted
// about a part's own template is that it conforms (below) and that it keeps its
// required props and loses its bindings (`catalog.test.ts`).
const roots = catalog.entries.filter((entry) => entry.parent === null).map((entry) => entry.name);
const standalone = roots.filter((name) => !Object.hasOwn(NEEDS_AN_ANCESTOR, name));

/** Exactly what dropping `name` onto an empty canvas produces. */
function documentFor(name: string): ViewSpec {
  const spec = toSpec({ ...emptyDocument("Dropped"), root: catalog.template(name) });
  if (spec === null) throw new Error(`${name} produced no document`);
  return spec;
}

function renderDropped(name: string): { drewSomething: boolean; diagnostics: string[] } {
  const { container } = render(
    <ViewRenderer spec={documentFor(name)} icons={lucideIcons} adapters={{ navigate: () => {} }} />,
  );
  // Diagnostics are scanned from `document.body`, not the render tree: every
  // overlay in the library portals out of it, so one inside an open dialog or
  // menu is nowhere near what `render` hands back.
  const diagnostics = findRenderDiagnostics(document.body);
  const view = container.querySelector("[data-rui-view]");
  return { drewSomething: (view?.children.length ?? 0) > 0, diagnostics };
}

afterEach(cleanup);

describe("dropping a component produces a conforming document", () => {
  it("raises no error and no warning, for any of them", () => {
    // Every issue, not `result.ok`: `ok` means conformance, so a whole tier of
    // warnings — a variant outside its set, a stripped URL — passes an `ok`
    // check unseen, and those are precisely what a bad seed produces.
    const offenders: string[] = [];
    for (const name of names) {
      const result = validateViewSpec(documentFor(name), { registry: defaultRegistry });
      for (const issue of result.issues) {
        offenders.push(`${name}: ${issue.severity} ${issue.path}: ${issue.message}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("renders with nothing wrong anywhere on the page", () => {
    const offenders: string[] = [];
    for (const name of standalone) {
      for (const diagnostic of renderDropped(name).diagnostics) {
        offenders.push(`${name}: ${diagnostic}`);
      }
      cleanup();
    }
    expect(offenders).toEqual([]);
  });

  it("draws something, rather than an empty wrapper", () => {
    // A component that lands as a bare tag reads as broken, and it is exactly
    // what a template assembled from a contract alone would produce.
    const blank: string[] = [];
    for (const name of standalone) {
      if (!renderDropped(name).drewSomething) blank.push(name);
      cleanup();
    }
    expect(blank.sort()).toEqual(Object.keys(DRAWS_NOTHING).sort());
  });
});

describe("what the builder does not protect you from", () => {
  it("names every flat component that still needs an ancestor, and no other", () => {
    const failing: string[] = [];
    for (const name of roots) {
      if (renderDropped(name).diagnostics.length > 0) failing.push(name);
      cleanup();
    }
    expect(failing.sort()).toEqual(Object.keys(NEEDS_AN_ANCESTOR).sort());
  });

  it("puts them right the moment the ancestor is there", () => {
    expect(renderDropped("EmptyState").diagnostics).toEqual([]);
    expect(renderDropped("EmptyState").drewSomething).toBe(true);
  });

  it("still reports a compound part dropped on its own, rather than drawing nothing", () => {
    // The canvas is not silent about it: the renderer draws its own diagnostic
    // where the component would have been, which is what makes a wrong drop
    // recoverable instead of mysterious. Asserted so that a change making the
    // failure quiet is a failure here.
    const quiet = ["Accordion.Trigger", "Combobox.Item", "DropdownMenu.Content"].filter(
      (name) => renderDropped(name).diagnostics.length === 0,
    );
    expect(quiet).toEqual([]);
  });
});
