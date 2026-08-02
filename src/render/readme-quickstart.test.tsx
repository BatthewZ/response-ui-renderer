import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ViewSpec } from "../spec/types";
import { validateViewSpec } from "../spec/validate";
import { findRenderDiagnostics } from "./diagnostics";
import { ViewRenderer } from "./ViewRenderer";

/**
 * The README's first document, rendered.
 *
 * A quickstart is the one example a reader is guaranteed to run, and it is
 * copied out of a file nothing executes. The counts beside it are already gated
 * (`contracts.test.ts`) for the same reason — a claim in prose drifts silently.
 * This reads the document out of the README rather than restating it, so there
 * is no second copy to keep in step.
 */
const readme = readFileSync(
  path.join(import.meta.dirname, "../../README.md"),
  "utf8",
);

const block = /```json\n([\s\S]*?)\n```/.exec(readme);

describe("the README quickstart", () => {
  it("has a JSON document to run", () => {
    expect(block, "no ```json block in README.md — the quickstart moved or changed fence").not.toBeNull();
  });

  const spec = JSON.parse(block![1]) as ViewSpec;

  it("raises no errors or warnings", () => {
    const result = validateViewSpec(spec);
    expect(result.issues.map((issue) => `${issue.severity} ${issue.path}: ${issue.message}`)).toEqual([]);
  });

  it("renders what the prose promises", async () => {
    const toast = vi.fn();
    render(<ViewRenderer spec={spec} adapters={{ toast }} />);

    expect(findRenderDiagnostics(document.body)).toEqual([]);
    expect(screen.getByRole("heading", { level: 3, name: "It renders." })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Say hello" }));
    expect(toast).toHaveBeenCalledWith("Hi", expect.anything());
  });

  it("degrades in place when the component name is wrong, as the prose claims", () => {
    // Misspelled in the source text, so the node under test is the documented
    // one however the document is later rearranged.
    const misspelled = block![1].replace('"Card"', '"Crad"');
    expect(misspelled).not.toBe(block![1]);

    render(<ViewRenderer spec={JSON.parse(misspelled) as ViewSpec} />);

    expect(findRenderDiagnostics(document.body).length).toBeGreaterThan(0);
  });
});
