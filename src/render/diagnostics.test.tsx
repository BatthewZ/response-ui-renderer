import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { lucideIcons } from "../icons";
import type { ViewSpec } from "../spec/types";
import { findRenderDiagnostics } from "./diagnostics";
import { ViewRenderer } from "./ViewRenderer";

const spec = (root: unknown): ViewSpec => ({ version: 1, title: "T", root }) as ViewSpec;

/**
 * The corpus gates used to ask `textContent` for two particular sentences. Each
 * case here is one the renderer reports and that phrasing could not see, so
 * these are the reason the gates query the DOM instead — and they go red if
 * anyone narrows them back.
 */
describe("findRenderDiagnostics", () => {
  it("sees a missing icon, which renders no text at all", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ component: "Icon", props: { name: "NoSuchIconXYZ" } })}
        icons={lucideIcons}
      />,
    );
    expect(container.textContent).toBe("");
    expect(findRenderDiagnostics(container)).toEqual(["missing icon: NoSuchIconXYZ"]);
  });

  it("sees a node with no recognised discriminator", () => {
    const { container } = render(<ViewRenderer spec={spec({ nope: true })} />);
    expect(container.textContent).not.toContain("Unknown component");
    expect(container.textContent).not.toContain("Render error");
    expect(findRenderDiagnostics(container)).toEqual([
      "Node must have one of: component, $ref, $each, $cond.",
    ]);
  });

  it("still sees an unknown component", () => {
    const { container } = render(<ViewRenderer spec={spec({ component: "Nope" })} />);
    expect(findRenderDiagnostics(container)).toEqual(["Unknown component: Nope"]);
  });

  it("reports nothing for a clean document", () => {
    const { container } = render(<ViewRenderer spec={spec({ component: "Text", children: ["ok"] })} />);
    expect(findRenderDiagnostics(container)).toEqual([]);
  });
});
