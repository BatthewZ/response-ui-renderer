import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ViewSpec } from "../spec/types";
import { ViewRenderer } from "./ViewRenderer";

const spec = (partial: Partial<ViewSpec> & Pick<ViewSpec, "root">): ViewSpec => ({
  version: 1,
  title: "T",
  ...partial,
});

const href = (container: HTMLElement) => container.querySelector("a")?.getAttribute("href") ?? null;

/**
 * Every scheme `isDangerousUrl` rejects, in each spelling a document can use.
 *
 * The `$ref` row is the one that matters: the guard used to run before the value
 * was resolved, so an indirect URL reached the DOM. React refuses `javascript:`
 * on its own, which hid the hole — `vbscript:` and `data:text/html` landed
 * verbatim. And since a `data` entry can be an api binding, the value can come
 * from a remote response rather than the document.
 */
const DANGEROUS = ["javascript:alert(1)", "vbscript:msgbox(1)", "data:text/html;base64,PHNjcmlwdD4="];

describe("dangerous URLs never reach the DOM", () => {
  it.each(DANGEROUS)("literal: %s", (url) => {
    const { container } = render(
      <ViewRenderer spec={spec({ root: { component: "Button", props: { as: "a", href: url }, children: ["x"] } })} />,
    );
    expect(href(container)).toBeNull();
  });

  it.each(DANGEROUS)("through a $ref: %s", (url) => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: { evil: { type: "static", value: url } },
          root: { component: "Button", props: { as: "a", href: { $ref: "evil" } }, children: ["x"] },
        })}
      />,
    );
    expect(href(container)).toBeNull();
  });

  it.each(DANGEROUS)("through a $ref into an object: %s", (url) => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: { cfg: { type: "static", value: { url } } },
          root: { component: "Button", props: { as: "a", href: { $ref: "cfg.url" } }, children: ["x"] },
        })}
      />,
    );
    expect(href(container)).toBeNull();
  });

  it("still lets a safe url through, literal or resolved", () => {
    const literal = render(
      <ViewRenderer spec={spec({ root: { component: "Button", props: { as: "a", href: "/ok" }, children: ["x"] } })} />,
    );
    expect(href(literal.container)).toBe("/ok");

    const resolved = render(
      <ViewRenderer
        spec={spec({
          data: { safe: { type: "static", value: "/also-ok" } },
          root: { component: "Button", props: { as: "a", href: { $ref: "safe" } }, children: ["x"] },
        })}
      />,
    );
    expect(href(resolved.container)).toBe("/also-ok");
  });
});
