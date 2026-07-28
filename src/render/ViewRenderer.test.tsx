import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { exampleSpecs } from "../examples";
import type { ViewSpec } from "../spec/types";
import { ViewRenderer } from "./ViewRenderer";

const spec = (partial: Partial<ViewSpec> & Pick<ViewSpec, "root">): ViewSpec => ({
  version: 1,
  title: "Test",
  ...partial,
});

/**
 * Cleared before each test, not after: testing-library's `cleanup` runs in the
 * setup file's afterEach, which fires AFTER a file-local afterEach — so an
 * unmount restoring the host's previous theme would land after any cleanup here
 * and leak into the next test.
 */
beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("real generated documents", () => {
  it.each(Object.entries(exampleSpecs))("renders %s with no unknown components", (_name, doc) => {
    const { container } = render(<ViewRenderer spec={doc as ViewSpec} />);
    expect(container.textContent).not.toContain("Unknown component");
    expect(container.textContent).not.toContain("Render error");
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("renders content from the specimens, not just a wrapper", () => {
    render(<ViewRenderer spec={exampleSpecs.contactForm as ViewSpec} />);
    expect(screen.getByText("Contact Us")).toBeInTheDocument();
  });

  it("expands $each over static data", () => {
    render(<ViewRenderer spec={exampleSpecs.teamDirectory as ViewSpec} />);
    // The document iterates `members`; every name must reach the DOM.
    const members = (exampleSpecs.teamDirectory as unknown as {
      data: { members: { value: { name: string }[] } };
    }).data.members.value;
    expect(members.length).toBeGreaterThan(0);
    for (const member of members) {
      expect(screen.getAllByText(member.name).length).toBeGreaterThan(0);
    }
  });
});

describe("node kinds", () => {
  it("renders a string node", () => {
    const { container } = render(<ViewRenderer spec={spec({ root: "just text" })} />);
    expect(container.textContent).toContain("just text");
  });

  it("resolves a $ref against static data", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: { user: { type: "static", value: { name: "Ada" } } },
          root: { $ref: "data.user.name" },
        })}
      />,
    );
    expect(container.textContent).toContain("Ada");
  });

  it("supports the bare data-key shorthand", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: { user: { type: "static", value: { name: "Grace" } } },
          root: { $ref: "user.name" },
        })}
      />,
    );
    expect(container.textContent).toContain("Grace");
  });

  it("renders JSON for an object $ref rather than [object Object]", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: { u: { type: "static", value: { a: 1 } } },
          root: { $ref: "data.u" },
        })}
      />,
    );
    expect(container.textContent).toContain('{"a":1}');
  });

  it("takes each branch of $cond", () => {
    const build = (flag: boolean) =>
      spec({
        data: { flag: { type: "static", value: flag } },
        root: { $cond: "data.flag", then: "YES", else: "NO" },
      });
    expect(render(<ViewRenderer spec={build(true)} />).container.textContent).toContain("YES");
    expect(render(<ViewRenderer spec={build(false)} />).container.textContent).toContain("NO");
  });

  it("exposes the iterator alias and its index", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: { rows: { type: "static", value: ["a", "b"] } },
          root: {
            $each: "data.rows",
            as: "row",
            node: { component: "Text", children: [{ $ref: "row" }, { $ref: "rowIndex" }] },
          },
        })}
      />,
    );
    expect(container.textContent).toContain("a0");
    expect(container.textContent).toContain("b1");
  });

  it("lets an iterator alias shadow a data key of the same name", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: {
            row: { type: "static", value: "OUTER" },
            rows: { type: "static", value: ["INNER"] },
          },
          root: { $each: "data.rows", as: "row", node: { $ref: "row" } },
        })}
      />,
    );
    expect(container.textContent).toContain("INNER");
    expect(container.textContent).not.toContain("OUTER");
  });
});

describe("theming", () => {
  it("applies themeOverrides as inline custom properties", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: "x",
          themeOverrides: { "--C-PRIMARY": "oklch(0.6 0.15 220)", "--RADIUS-MD": "1rem" },
        })}
      />,
    );
    const wrapper = container.querySelector<HTMLElement>("[data-rui-view]");
    expect(wrapper?.style.getPropertyValue("--C-PRIMARY")).toBe("oklch(0.6 0.15 220)");
    expect(wrapper?.style.getPropertyValue("--RADIUS-MD")).toBe("1rem");
  });

  it("ignores override keys that are not custom properties", () => {
    const { container } = render(
      <ViewRenderer spec={spec({ root: "x", themeOverrides: { background: "red" } })} />,
    );
    const wrapper = container.querySelector<HTMLElement>("[data-rui-view]");
    expect(wrapper?.style.background).toBe("");
  });

  it("root mode writes data-theme to <html>, because :root[data-theme] themes need it there", () => {
    const { unmount } = render(<ViewRenderer spec={spec({ root: "x", theme: "aurora" })} />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("aurora");
    unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("root mode restores whatever theme the host had set", () => {
    document.documentElement.setAttribute("data-theme", "midnight");
    const { unmount } = render(<ViewRenderer spec={spec({ root: "x", theme: "solstice" })} />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("solstice");
    unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");
  });

  it('treats "default" as removing the attribute', () => {
    document.documentElement.setAttribute("data-theme", "midnight");
    render(<ViewRenderer spec={spec({ root: "x", theme: "default" })} />);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("scoped mode writes data-theme to the wrapper and leaves <html> alone", () => {
    const { container } = render(
      <ViewRenderer spec={spec({ root: "x", theme: "aurora" })} themeMode="scoped" />,
    );
    expect(container.querySelector("[data-rui-view]")?.getAttribute("data-theme")).toBe("aurora");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("the theme prop overrides the document's own theme", () => {
    render(<ViewRenderer spec={spec({ root: "x", theme: "solstice" })} theme="midnight" />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");
  });

  it("warns when two root-mode views compete for <html>", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <>
        <ViewRenderer spec={spec({ root: "a", theme: "solstice" })} />
        <ViewRenderer spec={spec({ root: "b", theme: "aurora" })} />
      </>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("applying a theme to <html>"));
    warn.mockRestore();
  });

  it("leaves the host's theme alone when the document declares none", () => {
    // A view that says nothing about theming must not strip the host app's own
    // theme for as long as it happens to be mounted.
    document.documentElement.setAttribute("data-theme", "solstice");
    const { unmount } = render(<ViewRenderer spec={spec({ root: "x" })} />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("solstice");
    unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe("solstice");
  });

  it("hands overlapping views back in the right order", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const a = render(<ViewRenderer spec={spec({ root: "a", theme: "aurora" })} />);
    const b = render(<ViewRenderer spec={spec({ root: "b", theme: "midnight" })} />);
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");

    // Unmounting the FIRST view must not restore the pre-A document state and
    // wipe B, which is still on screen.
    a.unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");

    b.unmount();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    warn.mockRestore();
  });

  it("restores the host's theme once overlapping views have all gone", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    document.documentElement.setAttribute("data-theme", "solstice");
    const a = render(<ViewRenderer spec={spec({ root: "a", theme: "aurora" })} />);
    const b = render(<ViewRenderer spec={spec({ root: "b", theme: "midnight" })} />);
    a.unmount();
    b.unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe("solstice");
    warn.mockRestore();
  });

  it("warns even when both competing views ask for the same theme", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <>
        <ViewRenderer spec={spec({ root: "a", theme: "aurora" })} />
        <ViewRenderer spec={spec({ root: "b", theme: "aurora" })} />
      </>,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("applying a theme to <html>"));
    warn.mockRestore();
  });

  it("keeps the theme applied while a same-theme sibling is still mounted", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const a = render(<ViewRenderer spec={spec({ root: "a", theme: "aurora" })} />);
    const b = render(<ViewRenderer spec={spec({ root: "b", theme: "aurora" })} />);
    a.unmount();
    expect(document.documentElement.getAttribute("data-theme")).toBe("aurora");
    b.unmount();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    warn.mockRestore();
  });
});

describe("forms", () => {
  const formSpec = spec({
    forms: {
      contact: {
        fields: {
          email: { initialValue: "", validation: { required: true, message: "Email required" } },
          subscribe: { initialValue: false },
        },
        onSubmit: { action: "showToast", payload: { message: "sent" } },
      },
    },
    root: {
      component: "Stack",
      children: [
        { component: "Input", props: { "aria-label": "Email", $field: "contact.email" } },
        {
          component: "Checkbox",
          props: { "aria-label": "Subscribe", $field: "contact.subscribe" },
        },
        { component: "FieldError", props: { name: "contact.email" } },
        {
          component: "Button",
          props: { onClick: { action: "submitForm", payload: { form: "contact" } } },
          children: ["Send"],
        },
      ],
    },
  });

  it("binds a text input two-way", async () => {
    const user = userEvent.setup();
    render(<ViewRenderer spec={formSpec} />);
    const input = screen.getByLabelText("Email");
    await user.type(input, "a@b.c");
    expect(input).toHaveValue("a@b.c");
  });

  it("binds a checkbox to `checked`, not `value`", async () => {
    const user = userEvent.setup();
    render(<ViewRenderer spec={formSpec} />);
    const box = screen.getByLabelText("Subscribe");
    expect(box).not.toBeChecked();
    await user.click(box);
    expect(box).toBeChecked();
  });

  it("surfaces a validation error and blocks onSubmit", async () => {
    const user = userEvent.setup();
    const toast = vi.fn();
    render(<ViewRenderer spec={formSpec} adapters={{ toast }} />);
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Email required")).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it("runs onSubmit once the form is valid, and clears the error", async () => {
    const user = userEvent.setup();
    const toast = vi.fn();
    render(<ViewRenderer spec={formSpec} adapters={{ toast }} />);
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.type(screen.getByLabelText("Email"), "a@b.c");
    expect(screen.queryByText("Email required")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(toast).toHaveBeenCalledWith("sent", expect.anything());
  });

  it("resets to initial values", async () => {
    const user = userEvent.setup();
    render(
      <ViewRenderer
        spec={spec({
          forms: { f: { fields: { a: { initialValue: "start" } } } },
          root: {
            component: "Stack",
            children: [
              { component: "Input", props: { "aria-label": "A", $field: "f.a" } },
              {
                component: "Button",
                props: { onClick: { action: "resetForm", payload: { form: "f" } } },
                children: ["Reset"],
              },
            ],
          },
        })}
      />,
    );
    const input = screen.getByLabelText("A");
    await user.clear(input);
    await user.type(input, "changed");
    expect(input).toHaveValue("changed");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("start");
  });
});

describe("adapters", () => {
  it("calls navigate", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <ViewRenderer
        adapters={{ navigate }}
        spec={spec({
          root: {
            component: "Button",
            props: { onClick: { action: "navigate", payload: { path: "/next" } } },
            children: ["Go"],
          },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(navigate).toHaveBeenCalledWith("/next");
  });

  it("warns instead of throwing when no navigate adapter is supplied", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Button",
            props: { onClick: { action: "navigate", payload: { path: "/next" } } },
            children: ["Go"],
          },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("no navigate adapter"));
    warn.mockRestore();
  });

  it("resolves $ref inside an event payload", async () => {
    const user = userEvent.setup();
    const toast = vi.fn();
    render(
      <ViewRenderer
        adapters={{ toast }}
        spec={spec({
          data: { msg: { type: "static", value: "from data" } },
          root: {
            component: "Button",
            props: {
              onClick: { action: "showToast", payload: { message: { $ref: "data.msg" } } },
            },
            children: ["Go"],
          },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(toast).toHaveBeenCalledWith("from data", expect.anything());
  });

  it("loads an api binding through the injected fetch, unrewritten", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: "remote" }),
    });

    render(
      <ViewRenderer
        adapters={{ fetch: fetchImpl }}
        spec={spec({
          data: { u: { type: "api", endpoint: "/api/user" } },
          root: { $ref: "data.u.name" },
        })}
      />,
    );
    expect(fetchImpl).toHaveBeenCalledWith("/api/user", expect.objectContaining({ method: "GET" }));
    expect(await screen.findByText("remote")).toBeInTheDocument();
  });

  it("routes a source binding to resolveSource", async () => {
    const resolveSource = vi.fn().mockResolvedValue({ name: "crm" });
    render(
      <ViewRenderer
        adapters={{ resolveSource }}
        spec={spec({
          data: { u: { type: "source", source: "crm", params: { id: 7 } } },
          root: { $ref: "data.u.name" },
        })}
      />,
    );
    expect(resolveSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "crm", params: { id: 7 } }),
      expect.anything(),
    );
    expect(await screen.findByText("crm")).toBeInTheDocument();
  });

  it("reports a source binding with no resolver instead of failing silently", async () => {
    render(
      <ViewRenderer
        spec={spec({
          data: { u: { type: "source", source: "crm" } },
          root: "body",
        })}
      />,
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/failed to load/i);
  });

  it("blocks a cross-origin api binding by default", async () => {
    const fetchImpl = vi.fn();
    render(
      <ViewRenderer
        adapters={{ fetch: fetchImpl }}
        spec={spec({
          data: { u: { type: "api", endpoint: "https://evil.example.com/steal" } },
          root: "body",
        })}
      />,
    );
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lets a host widen the URL gate deliberately", () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(1) });
    render(
      <ViewRenderer
        adapters={{ fetch: fetchImpl, allowUrl: () => true }}
        spec={spec({
          data: { u: { type: "api", endpoint: "https://api.example.com/x" } },
          root: "body",
        })}
      />,
    );
    expect(fetchImpl).toHaveBeenCalled();
  });
});

describe("icons", () => {
  const IconStub = () => <span data-testid="icon-check" />;

  it("renders an Icon node from the injected set", () => {
    render(
      <ViewRenderer
        icons={{ Check: IconStub }}
        spec={spec({ root: { component: "Icon", props: { name: "Check" } } })}
      />,
    );
    expect(screen.getByTestId("icon-check")).toBeInTheDocument();
  });

  it("accepts kebab and snake case names", () => {
    for (const name of ["check", "Check"]) {
      const { unmount } = render(
        <ViewRenderer
          icons={{ Check: IconStub }}
          spec={spec({ root: { component: "Icon", props: { name } } })}
        />,
      );
      expect(screen.getByTestId("icon-check")).toBeInTheDocument();
      unmount();
    }
  });

  it("coerces a string icon prop into an element for ReactNode slots", () => {
    render(
      <ViewRenderer
        icons={{ Check: IconStub }}
        spec={spec({
          root: {
            component: "Timeline",
            children: [
              { component: "Timeline.Item", props: { icon: "Check" }, children: ["Done"] },
            ],
          },
        })}
      />,
    );
    expect(screen.getByTestId("icon-check")).toBeInTheDocument();
  });

  it("passes a component, not an element, to LucideIcon-typed slots", () => {
    // AppShell.SidebarLink types `icon` as LucideIcon and invokes it as <Icon />.
    // Handing it an element makes React try to call an object as a component.
    const { container } = render(
      <ViewRenderer
        icons={{ Check: IconStub }}
        spec={spec({
          root: {
            component: "AppShell",
            children: [
              {
                component: "AppShell.Sidebar",
                children: [
                  {
                    component: "AppShell.SidebarLink",
                    props: { href: "/x", icon: "Check" },
                    children: ["Home"],
                  },
                ],
              },
            ],
          },
        })}
      />,
    );
    expect(container.textContent).not.toContain("Render error");
    expect(screen.getByTestId("icon-check")).toBeInTheDocument();
  });

  it("contains a compound part used outside its parent instead of blanking the view", () => {
    // The library throws for orphaned compound parts by design; a document from
    // a generator will produce them, and the view must survive it.
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Stack",
            children: [{ component: "AppShell.SidebarLink" }, "sibling survives"],
          },
        })}
      />,
    );
    expect(container.textContent).toContain("Render error");
    expect(container.textContent).toContain("sibling survives");
  });

  it("degrades to a placeholder when no icon set is supplied", () => {
    const { container } = render(
      <ViewRenderer spec={spec({ root: { component: "Icon", props: { name: "Check" } } })} />,
    );
    expect(container.querySelector(".rui-render-missing-icon")).toBeInTheDocument();
  });
});

describe("hostile and degenerate documents", () => {
  it("reports an unknown component in place, leaving siblings intact", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: { component: "Stack", children: [{ component: "Nope" }, "sibling survives"] },
        })}
      />,
    );
    expect(container.textContent).toContain("Unknown component");
    expect(container.textContent).toContain("sibling survives");
  });

  it("refuses a component name that reaches into Object.prototype", () => {
    for (const name of ["__proto__", "constructor", "toString"]) {
      const { container, unmount } = render(
        <ViewRenderer spec={spec({ root: { component: name } })} />,
      );
      expect(container.textContent).toContain("Unknown component");
      unmount();
    }
  });

  it("drops dangerouslySetInnerHTML", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Card",
            props: { dangerouslySetInnerHTML: { __html: "<img src=x onerror=alert(1)>" } },
          },
        })}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("drops a javascript: URL but keeps the element", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Text",
            props: { as: "a", href: "javascript:alert(1)" },
            children: ["link"],
          },
        })}
      />,
    );
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href")).toBeNull();
    expect(container.textContent).toContain("link");
  });

  it("renders nothing for $each over a non-array", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: { x: { type: "static", value: { not: "an array" } } },
          root: { $each: "data.x", as: "i", node: "item" },
        })}
      />,
    );
    expect(container.textContent).not.toContain("item");
    expect(container.textContent).not.toContain("Render error");
  });

  it("renders nothing for a $ref that resolves to undefined", () => {
    const { container } = render(<ViewRenderer spec={spec({ root: { $ref: "nothing.here" } })} />);
    expect(container.textContent).toBe("");
  });

  it("refuses to walk into the prototype chain via $ref", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          data: { x: { type: "static", value: { a: 1 } } },
          root: { $ref: "data.x.constructor.name" },
        })}
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("stops at the depth limit instead of overflowing the stack", () => {
    let root: unknown = "leaf";
    for (let i = 0; i < 60; i += 1) root = { component: "Stack", children: [root] };
    const { container } = render(<ViewRenderer spec={spec({ root: root as never })} />);
    expect(container.textContent).toContain("nesting exceeded");
  });

  it("survives a malformed node object", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Stack", children: [{ nonsense: true } as never] } })}
      />,
    );
    expect(container.textContent).toContain("must have one of");
  });

  it("survives an empty children array and null props", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({ root: { component: "Card", props: undefined, children: [] } })}
      />,
    );
    expect(container.querySelector("[data-rui-view]")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Render error");
  });

  it("isolates a component that throws, keeping the rest of the view", () => {
    const Boom = () => {
      throw new Error("component exploded");
    };
    const registry = { Boom: { component: Boom } };
    const { container } = render(
      <ViewRenderer
        registry={registry}
        spec={spec({ root: { component: "Boom" } })}
      />,
    );
    expect(container.textContent).toContain("Render error");
    expect(container.textContent).toContain("component exploded");
  });
});

describe("document identity", () => {
  it("clears view state when the spec is replaced", async () => {
    const user = userEvent.setup();
    const build = (label: string) =>
      spec({
        root: {
          component: "Stack",
          children: [
            {
              component: "Button",
              props: { onClick: { action: "setState", payload: { key: "k", value: "SET" } } },
              children: [label],
            },
            { $ref: "state.k" },
          ],
        },
      });

    const { container, rerender } = render(<ViewRenderer spec={build("A")} />);
    await user.click(screen.getByRole("button", { name: "A" }));
    expect(container.textContent).toContain("SET");

    rerender(<ViewRenderer spec={build("B")} />);
    expect(container.textContent).not.toContain("SET");
  });

  it("re-initialises form values when the spec is replaced", () => {
    const build = (initial: string) =>
      spec({
        forms: { f: { fields: { a: { initialValue: initial } } } },
        root: { component: "Input", props: { "aria-label": "A", $field: "f.a" } },
      });

    const { rerender } = render(<ViewRenderer spec={build("first")} />);
    expect(screen.getByLabelText("A")).toHaveValue("first");
    rerender(<ViewRenderer spec={build("second")} />);
    expect(screen.getByLabelText("A")).toHaveValue("second");
  });
});
