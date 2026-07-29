import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { coverageSpecs } from "../examples/coverage";
import { NOT_ADDRESSABLE } from "../examples/not-addressable";
import { lucideIcons } from "../icons";
import { defaultRegistry, listComponentNames } from "../registry/registry";
import type { ViewSpec } from "../spec/types";
import { validateViewSpec } from "../spec/validate";
import { ViewRenderer } from "./ViewRenderer";

/**
 * The parity contract.
 *
 * Naming a component is free — the registry is derived from the library's
 * barrel, so every export has always been addressable. Whether it *renders* from
 * a document is the claim worth making, and before this corpus existed only
 * about thirty of a hundred and sixty-five names had ever been exercised.
 */

/** Every `"component"` named anywhere in a document, including compound parts. */
function componentsIn(node: unknown, found: Set<string>): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) componentsIn(item, found);
    return found;
  }
  if (typeof node !== "object" || node === null) return found;
  for (const [key, value] of Object.entries(node)) {
    if (key === "component" && typeof value === "string") found.add(value);
    else componentsIn(value, found);
  }
  return found;
}

const covered = new Set<string>();
for (const spec of Object.values(coverageSpecs)) {
  componentsIn(spec, covered);
}

const addressable = listComponentNames(defaultRegistry);

describe("coverage corpus", () => {
  it.each(Object.entries(coverageSpecs))("%s renders clean", (_name, doc) => {
    const { container } = render(
      <ViewRenderer spec={doc as ViewSpec} icons={lucideIcons} adapters={{ navigate: () => {} }} />,
    );
    expect(container.textContent).not.toContain("Unknown component");
    expect(container.textContent).not.toContain("Render error");
    expect(container.querySelector("[data-rui-view]")?.children.length ?? 0).toBeGreaterThan(0);
  });

  // `result.ok ? [] : result.issues` would compare [] to [] on every conforming
  // document, so every warning in the corpus passed unseen. Assert the issue list
  // itself — the corpus is the reference, and must model advice it gives.
  it.each(Object.entries(coverageSpecs))("%s raises no errors or warnings", (_name, doc) => {
    const result = validateViewSpec(doc);
    expect(result.issues.map((issue) => `${issue.severity} ${issue.path}: ${issue.message}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("parity contract", () => {
  it("exercises or excuses every addressable component", () => {
    const unaccounted = addressable.filter(
      (name) => !covered.has(name) && !Object.hasOwn(NOT_ADDRESSABLE, name),
    );
    expect(unaccounted).toEqual([]);
  });

  it("excuses nothing that does not exist", () => {
    // A component dropped upstream must not leave a stale excuse behind,
    // claiming a decision about something that is no longer there.
    const phantom = Object.keys(NOT_ADDRESSABLE).filter((name) => !addressable.includes(name));
    expect(phantom).toEqual([]);
  });

  it("excuses nothing the corpus actually renders", () => {
    const contradictory = Object.keys(NOT_ADDRESSABLE).filter((name) => covered.has(name));
    expect(contradictory).toEqual([]);
  });

  it("names nothing the registry does not have", () => {
    // A typo in a fixture would otherwise render an "Unknown component" box that
    // the clean-render assertion catches, but with no hint of which name is wrong.
    const unknown = [...covered].filter((name) => !addressable.includes(name));
    expect(unknown).toEqual([]);
  });
});
