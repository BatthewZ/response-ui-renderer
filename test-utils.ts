import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect } from "vitest";

/**
 * Renders a document whose node is expected to throw, without React's dump.
 *
 * React logs every boundary-caught error with its component stack, so the tests
 * proving the renderer degrades to a diagnostic instead of blanking print pages
 * of expected stacks — the loudest output a release run produces, all of it the
 * suite working. Silencing belongs here and not in the setup file: a boundary
 * catch anywhere else is unexpected, and has to stay as loud as React makes it.
 *
 * The name is a claim, so it is checked: catching nothing fails the call rather
 * than passing quietly, which is what a case that stops throwing after a peer
 * bump would otherwise do.
 */
export function renderThrowing(
  ui: ReactElement,
  options?: Omit<RenderOptions, "onCaughtError">,
): RenderResult {
  let caught = 0;
  const result = render(ui, {
    ...options,
    onCaughtError: () => {
      caught += 1;
    },
  });

  expect(caught, "expected a node error boundary to catch, but nothing threw").toBeGreaterThan(0);
  return result;
}
