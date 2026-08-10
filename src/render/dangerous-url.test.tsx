import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
const DANGEROUS = [
  "javascript:alert(1)",
  "vbscript:msgbox(1)",
  "data:text/html;base64,PHNjcmlwdD4=",
  // Everything below passed the denylist this filter used to be. SVG is a
  // document and carries `onload`; XHTML carries `<script>`; `blob:` can hold
  // either and is same-origin. Enumerating danger is what let them through.
  "data:image/svg+xml,<svg onload=alert(1)></svg>",
  "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+",
  "data:application/xhtml+xml,<html><script>alert(1)</script></html>",
  "blob:https://evil.example/8f2c",
  "view-source:https://evil.example",
];

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

  it.each(["/relative", "#anchor", "https://ok.example/x", "mailto:a@b.example", "tel:+441234"])(
    "still lets %s through — an allowlist that blocks these is not shippable",
    (url) => {
      const { container } = render(
        <ViewRenderer spec={spec({ root: { component: "Button", props: { as: "a", href: url }, children: ["x"] } })} />,
      );
      expect(href(container)).toBe(url);
    },
  );

  it("still lets a real image data URL through", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const { container } = render(
      <ViewRenderer spec={spec({ root: { component: "Avatar", props: { src: png, alt: "a" } } })} />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(png);
  });

  it("reads what React will put in the attribute, not just strings", () => {
    // `href: ["vbscript:…"]` is JSON-expressible and React stringifies it. A
    // `typeof value === "string"` guard read the array, said "not a URL", and
    // let the exact string through on the one prop name it already knew about.
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: { component: "Button", props: { as: "a", href: ["vbscript:msgbox(1)"] }, children: ["x"] },
        })}
      />,
    );
    expect(href(container)).toBeNull();
  });
});

/**
 * The prop name a URL arrives under is the component's choice, and three of
 * them do not choose a DOM attribute's name. Each was measured reaching the DOM
 * verbatim; `RequireAuth.redirect` did it with no user gesture, because the
 * component clicks the link itself in an effect.
 */
describe("renamed URL props are checked too", () => {
  const EVIL = "data:text/html,<script>alert(1)</script>";

  it("AppShell.SidebarLink.to", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "AppShell",
            children: [
              {
                component: "AppShell.Sidebar",
                children: [{ component: "AppShell.SidebarLink", props: { to: EVIL }, children: ["evil"] }],
              },
            ],
          },
        })}
      />,
    );
    expect(container.querySelector("a")?.getAttribute("href") ?? null).toBeNull();
  });

  it("Swimlane.viewAllHref", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Swimlane", props: { title: "t", viewAllHref: EVIL }, children: ["x"] } })} />,
    );
    expect(href(container)).toBeNull();
  });

  it("RequireAuth.redirect, which navigates without a click", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: { component: "RequireAuth", props: { status: "unauthenticated", redirect: EVIL }, children: ["x"] },
        })}
      />,
    );
    expect(href(container)).toBeNull();
  });

  it("leaves a safe value on a renamed prop alone", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Swimlane", props: { title: "t", viewAllHref: "/all" }, children: ["x"] } })} />,
    );
    expect(href(container)).toBe("/all");
  });
});

/**
 * Several components take a props bag and spread it onto the element they
 * render, so a URL attribute one level down is the same attribute — reached by
 * a route a top-level loop cannot see. `src` survived only because each of
 * these writes it after the spread; `srcSet` and `background` were not written
 * at all, so the document owned them outright.
 */
describe("nested prop bags are checked too", () => {
  it("imgProps.srcSet on a spread bag", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Hero",
            children: [
              {
                component: "Hero.Background",
                props: { src: "/ok.png", imgProps: { srcSet: "data:text/html,<script>alert(1)</script> 1x" } },
              },
            ],
          },
        })}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("srcset")).toBeNull();
  });

  it("tableProps.background on a spread bag", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Table", props: { tableProps: { background: "javascript:alert(1)" } } } })} />,
    );
    expect(container.querySelector("table")?.getAttribute("background")).toBeNull();
  });

  it("srcDoc inside a bag, which is raw HTML rather than a URL", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Hero",
            children: [
              { component: "Hero.Background", props: { src: "/ok.png", imgProps: { srcDoc: "<script>alert(1)</script>" } } },
            ],
          },
        })}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("srcdoc")).toBeNull();
  });

  it("leaves a legitimate nested attribute alone", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Hero",
            children: [
              { component: "Hero.Background", props: { src: "/ok.png", imgProps: { srcSet: "/small.png 1x" } } },
            ],
          },
        })}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("srcset")).toBe("/small.png 1x");
  });
});

/**
 * Which element to render is the same decision as which URL to follow, and was
 * open in the same way — including under a renamed prop. Neither of these needs
 * a URL: `as: "script"` makes the children the payload, and `srcDoc` is a whole
 * document in the embedder's own origin.
 */
describe("a document cannot choose an executing element", () => {
  // Void elements get NO children: `<embed>alert(1)</embed>` makes React throw
  // on its own, so the diagnostic box appeared whether or not the guard existed
  // and four of these rows could not fail. `meta` is checked through
  // `document.head` because React 19 hoists it out of the container.
  it.each(["script", "iframe", "object", "style"])("as: %s is refused", (tag) => {
    const { container } = render(
      <ViewRenderer spec={spec({ root: { component: "Stack", props: { as: tag }, children: ["alert(1)"] } })} />,
    );
    expect(container.querySelector(tag)).toBeNull();
  });

  it.each(["embed", "link", "base", "meta"])("as: %s is refused (void element)", (tag) => {
    const before = document.head.querySelectorAll(tag).length;
    const { container } = render(
      <ViewRenderer spec={spec({ root: { component: "Stack", props: { as: tag } } })} />,
    );
    expect(container.querySelector(tag)).toBeNull();
    expect(document.head.querySelectorAll(tag).length).toBe(before);
  });

  it("as: iframe with srcDoc leaves neither the element nor the attribute", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: { component: "Button", props: { as: "iframe", srcDoc: "<script>alert(1)</script>" }, children: ["x"] },
        })}
      />,
    );
    expect(container.innerHTML).not.toContain("srcdoc");
    expect(container.innerHTML).not.toContain("<iframe");
  });

  it("a renamed element prop is refused too", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Swimlane", props: { title: "t", titleAs: "script" }, children: ["x"] } })} />,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it.each(["section", "nav", "article", "ul", "a"])("still allows as: %s", (tag) => {
    const { container } = render(
      <ViewRenderer spec={spec({ root: { component: "Stack", props: { as: tag }, children: ["x"] } })} />,
    );
    expect(container.querySelector(tag)).not.toBeNull();
  });

  it("still allows a renamed element prop's real values", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Swimlane", props: { title: "t", titleAs: "h3" }, children: ["x"] } })} />,
    );
    expect(container.querySelector("h3")?.textContent).toBe("t");
  });
});

/**
 * Content is not a URL. A filter keyed on the value rather than the position
 * would drop every one of these, which is why this one is keyed on position.
 */
describe("verbatim content props are untouched", () => {
  it("CodeBlock.code keeps a javascript: string", () => {
    const { container } = render(
      <ViewRenderer spec={spec({ root: { component: "CodeBlock", props: { code: "javascript:alert(1)" } } })} />,
    );
    expect(container.textContent).toContain("javascript:alert(1)");
  });

  it("ActivityFeed.Item.action keeps a sentence", () => {
    // Typed `ReactNode` upstream — a slot whose name happens to be `<form
    // action>`. Under a scheme allowlist `approved:` is a scheme, so this
    // rendered empty until the contract said the prop is content.
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "ActivityFeed",
            children: [
              { component: "ActivityFeed.Item", props: { action: "approved: build 42" }, children: ["Ada"] },
            ],
          },
        })}
      />,
    );
    expect(container.textContent).toContain("approved: build 42");
  });

  it("DataTable rows keep prose that parses as a scheme", () => {
    // The measured cost of checking every nested key instead of only the bags a
    // component spreads: these cells came back empty. `action` and `cite` are
    // DOM attribute names AND ordinary field names, and `Approve: pending` has
    // a scheme by the URL grammar.
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "DataTable",
            props: {
              rowKey: "id",
              data: [{ id: "1", action: "Approve: pending review", cite: "Ref: RFC 42", src: "s3://bucket/key" }],
              columns: [
                { key: "action", header: "Action" },
                { key: "cite", header: "Cite" },
                { key: "src", header: "Src" },
              ],
            },
          },
        })}
      />,
    );
    expect(container.textContent).toContain("Approve: pending review");
    expect(container.textContent).toContain("Ref: RFC 42");
    expect(container.textContent).toContain("s3://bucket/key");
  });
});

/**
 * `navigate` hands its destination to the host's adapter, and assigning to
 * `location.href` is an ordinary way to write one. `payload` is resolved
 * deeply, so the destination can arrive from an api binding.
 */
describe("the navigate action checks its destination", () => {
  const clickWith = (path: string) => {
    const navigate = vi.fn();
    const { container } = render(
      <ViewRenderer
        adapters={{ navigate }}
        spec={spec({
          root: {
            component: "Button",
            props: { onClick: { action: "navigate", payload: { path } } },
            children: ["go"],
          },
        })}
      />,
    );
    container.querySelector("button")?.click();
    return navigate;
  };

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "blob:https://evil.example/x"])(
    "refuses %s",
    (path) => {
      expect(clickWith(path)).not.toHaveBeenCalled();
    },
  );

  it("still navigates to a real path", () => {
    expect(clickWith("/dashboard")).toHaveBeenCalledWith("/dashboard");
  });
});

/**
 * The DOM lowercases attribute names, so a mis-cased prop is the same
 * attribute. Measured in Chrome before this was closed: `HREF` produced a live
 * `javascript:` link that executed on click — worse than the reported defect,
 * which Chrome's own rule against top-frame `data:` navigation had blunted.
 */
describe("attribute names are matched the way the DOM matches them", () => {
  it.each(["HREF", "Href", "hREF", "SRCSET", "srcset", "FORMACTION"])(
    "%s is checked like its canonical spelling",
    (key) => {
      const { container } = render(
        <ViewRenderer
          spec={spec({
            root: { component: "Button", props: { as: "a", [key]: "javascript:alert(1)" }, children: ["x"] },
          })}
        />,
      );
      expect(container.innerHTML).not.toContain("javascript:");
    },
  );

  it.each(["SRCDOC", "SrcDoc", "srcdoc"])("%s is refused like srcDoc", (key) => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Button", props: { as: "a", [key]: "<script>alert(1)</script>" }, children: ["x"] } })} />,
    );
    expect(container.innerHTML.toLowerCase()).not.toContain("srcdoc");
  });

  it.each(["ping", "cite", "manifest", "xlinkHref"])("%s is a URL attribute too", (key) => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Button", props: { as: "a", href: "/ok", [key]: "javascript:alert(1)" }, children: ["x"] } })} />,
    );
    expect(container.innerHTML).not.toContain("javascript:");
    expect(href(container)).toBe("/ok");
  });
});

describe("a $ref cannot smuggle a bag past the nested check", () => {
  it("imgProps resolved wholesale from a binding is still scrubbed", () => {
    // `coerceNested` returned a resolved reference without walking it, so the
    // whole bag arrived unexamined — the same lesson the top-level filter
    // learned about references, one level down.
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: {
            bag: {
              type: "static",
              value: { srcSet: "data:text/html,<script>alert(1)</script> 1x", srcDoc: "<script>alert(1)</script>", title: "kept" },
            },
          },
          root: {
            component: "Hero",
            children: [{ component: "Hero.Background", props: { src: "/ok.png", imgProps: { $ref: "bag" } } }],
          },
        })}
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("srcset")).toBeNull();
    expect(img?.getAttribute("srcdoc")).toBeNull();
    expect(img?.getAttribute("title")).toBe("kept");
  });
});

describe("a heading level is a fragment, not a tag", () => {
  it.each(["eader", "group", "r", "1><img src=x onerror=alert(1)>"])(
    "Accordion.headingLevel %j is refused",
    (level) => {
      const { container } = render(
        <ViewRenderer
          spec={spec({
            root: {
              component: "Accordion",
              props: { headingLevel: level },
              children: [
                {
                  component: "Accordion.Item",
                  props: { value: "a" },
                  children: [{ component: "Accordion.Trigger", children: ["x"] }],
                },
              ],
            },
          })}
        />,
      );
      expect(container.querySelector("header, hgroup, hr")).toBeNull();
    },
  );

  it.each([2, 4])("still allows a real level %s", (level) => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Accordion",
            props: { headingLevel: level },
            children: [
              {
                component: "Accordion.Item",
                props: { value: "a" },
                children: [{ component: "Accordion.Trigger", children: ["x"] }],
              },
            ],
          },
        })}
      />,
    );
    expect(container.querySelector(`h${level}`)).not.toBeNull();
  });
});
