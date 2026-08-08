import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { exampleSpecs } from "../examples";
import { lucideIcons } from "../icons";
import type { ViewSpec } from "../spec/types";
import { findRenderDiagnostics } from "./diagnostics";
import { ID_REF_PROPS, isIdScopedProp, NAME_PROP_MEANING, normalizeIdScope } from "./id-scope";
import { ViewRenderer } from "./ViewRenderer";

const spec = (partial: Partial<ViewSpec> & Pick<ViewSpec, "root">): ViewSpec => ({
  version: 1,
  title: "Test",
  ...partial,
});

/** The shape the issue was observed in: one document, mounted once per turn. */
const poll: ViewSpec = spec({
  root: {
    component: "Stack",
    children: [
      { component: "Label", props: { htmlFor: "pick-a" }, children: ["Alpha"] },
      { component: "Radio", props: { id: "pick-a", name: "choice", value: "a" } },
      { component: "Label", props: { htmlFor: "pick-b" }, children: ["Beta"] },
      { component: "Radio", props: { id: "pick-b", name: "choice", value: "b" } },
    ],
  },
});

const idsIn = (root: ParentNode): string[] =>
  [...root.querySelectorAll("[id]")].map((el) => el.id);

describe("several documents on one page", () => {
  it("keeps each document's radio group its own", async () => {
    render(
      <>
        <ViewRenderer spec={poll} idScope />
        <ViewRenderer spec={poll} idScope />
      </>,
    );
    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    expect(radios).toHaveLength(4);

    await userEvent.click(radios[0]);
    expect(radios[0].checked).toBe(true);

    // The failure this fixes: the second document's group is the same group, so
    // choosing in it clears the first.
    await userEvent.click(radios[2]);
    expect(radios[0].checked).toBe(true);
    expect(radios[2].checked).toBe(true);
  });

  it("still merges the groups when the host asks for no scoping", async () => {
    render(
      <>
        <ViewRenderer spec={poll} />
        <ViewRenderer spec={poll} />
      </>,
    );
    const radios = screen.getAllByRole<HTMLInputElement>("radio");
    await userEvent.click(radios[0]);
    await userEvent.click(radios[2]);
    // Unchanged default: opting in is what fixes it, so this must stay broken.
    expect(radios[0].checked).toBe(false);
  });

  it("gives the two documents disjoint ids", () => {
    const first = render(<ViewRenderer spec={poll} idScope />);
    const second = render(<ViewRenderer spec={poll} idScope />);

    const a = idsIn(first.container);
    const b = idsIn(second.container);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });

  it("resolves every label to a control inside its own document", async () => {
    const first = render(<ViewRenderer spec={poll} idScope />);
    const second = render(<ViewRenderer spec={poll} idScope />);

    for (const view of [first.container, second.container]) {
      const labels = [...view.querySelectorAll<HTMLLabelElement>("label[for]")];
      expect(labels).toHaveLength(2);
      for (const label of labels) {
        const target = document.getElementById(label.htmlFor);
        expect(target).not.toBeNull();
        expect(view.contains(target)).toBe(true);
      }
    }

    // …and clicking one activates that document's control, not the first's.
    const secondBeta = within(second.container).getByText("Beta");
    await userEvent.click(secondBeta);
    const firstRadios = [...first.container.querySelectorAll<HTMLInputElement>("input")];
    expect(firstRadios.some((r) => r.checked)).toBe(false);
  });

  it("takes an explicit prefix, so a host can construct the id from outside", () => {
    const { container } = render(<ViewRenderer spec={poll} idScope="turn-7" />);
    expect(idsIn(container)).toEqual(["turn-7-pick-a", "turn-7-pick-b"]);
  });
});

describe("scoping runs on the resolved value, not the literal", () => {
  it("scopes an id that arrives through a $ref", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          data: { f: { type: "static", value: { controlId: "from-ref" } } },
          root: {
            component: "Stack",
            children: [
              {
                component: "Label",
                props: { htmlFor: { $ref: "data.f.controlId" } },
                children: ["Ref label"],
              },
              { component: "Input", props: { id: { $ref: "data.f.controlId" } } },
            ],
          },
        })}
      />,
    );
    expect(idsIn(container)).toEqual(["doc-from-ref"]);
    const label = container.querySelector<HTMLLabelElement>("label")!;
    expect(label.htmlFor).toBe("doc-from-ref");
  });

  it("scopes an id that does not exist until an api binding resolves", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ controlId: "late" }),
    });
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        adapters={{ fetch: fetchImpl }}
        spec={spec({
          data: { remote: { type: "api", endpoint: "/api/form" } },
          root: { component: "Input", props: { id: { $ref: "data.remote.controlId" } } },
        })}
      />,
    );
    // The case no host pre-pass can reach: at transform time this value exists
    // in no process anywhere.
    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(idsIn(container)).toEqual(["doc-late"]);
  });

  it("scopes the native id references the README names", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          root: {
            component: "Input",
            props: { id: "q", name: "q", list: "suggestions", form: "outer" },
          },
        })}
      />,
    );
    const input = container.querySelector<HTMLInputElement>("input")!;
    expect(input.id).toBe("doc-q");
    expect(input.getAttribute("name")).toBe("doc-q");
    expect(input.getAttribute("list")).toBe("doc-suggestions");
    expect(input.getAttribute("form")).toBe("doc-outer");
  });

  it("scopes every token of a single-valued ARIA id reference too", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          root: {
            component: "Stack",
            props: { "aria-details": "a b", "aria-errormessage": "e1 e2" },
            children: ["x"],
          },
        })}
      />,
    );
    // ARIA 1.2 types these single and 1.3 types them as lists. Treating them as
    // single produced `"doc-a b"` — first token scoped, second orphaned, which
    // is precisely the breakage tokenising exists to prevent.
    const el = container.querySelector("[aria-details]")!;
    expect(el.getAttribute("aria-details")).toBe("doc-a doc-b");
    expect(el.getAttribute("aria-errormessage")).toBe("doc-e1 doc-e2");
  });

  it("scopes every token of an ARIA id list", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          root: {
            component: "Stack",
            props: { as: "section", "aria-labelledby": "h  sub" },
            children: [
              { component: "Text", props: { id: "h", as: "h2" }, children: ["Heading"] },
              { component: "Text", props: { id: "sub" }, children: ["Sub"] },
            ],
          },
        })}
      />,
    );
    const section = container.querySelector("section")!;
    expect(section.getAttribute("aria-labelledby")).toBe("doc-h doc-sub");
    for (const id of section.getAttribute("aria-labelledby")!.split(" ")) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});

describe("what scoping must not touch", () => {
  it("leaves a $field binding writing to form state", async () => {
    render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          forms: { contact: { fields: { email: { initialValue: "" } } } },
          root: {
            component: "Stack",
            children: [
              {
                component: "Input",
                props: { id: "email", name: "email", $field: "contact.email" },
              },
              { component: "Text", children: ["stored:", { $ref: "forms.contact.values.email" }] },
            ],
          },
        })}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>("textbox");
    expect(input.id).toBe("doc-email");
    expect(input.name).toBe("doc-email");

    await userEvent.type(input, "a@b.c");

    // NOT `input.value`: a broken binding leaves the input UNCONTROLLED, and an
    // uncontrolled input types perfectly well — so asserting the DOM value
    // passes whether or not the write reached form state. Read the state back
    // through the same `forms` namespace a document would.
    expect(await screen.findByText("stored:a@b.c")).toBeInTheDocument();
  });

  it("leaves Field's name resolving to a live validation error", async () => {
    render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          forms: {
            contact: {
              fields: { email: { initialValue: "", validation: { required: true } } },
            },
          },
          root: {
            component: "Stack",
            children: [
              {
                component: "Field",
                props: { name: "contact.email" },
                children: [{ component: "Input", props: { $field: "contact.email" } }],
              },
              { component: "FieldError", props: { name: "contact.email" } },
              {
                component: "Button",
                props: { onClick: { action: "submitForm", payload: { form: "contact" } } },
                children: ["Send"],
              },
            ],
          },
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    // A scoped `name` would resolve to no form at all and the message would
    // never appear.
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });

  it("keeps openDialog naming the id the document wrote, while the DOM id is scoped", async () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          root: {
            component: "Stack",
            children: [
              {
                component: "Button",
                props: { onClick: { action: "openDialog", payload: { dialogId: "share" } } },
                children: ["Share"],
              },
              {
                component: "Dialog",
                props: { id: "share" },
                children: [
                  { component: "Text", children: ["Share this"] },
                  {
                    component: "Button",
                    props: { onClick: { action: "closeDialog", payload: { dialogId: "share" } } },
                    children: ["Dismiss"],
                  },
                ],
              },
            ],
          },
        })}
      />,
    );
    // Not `findByText`: a closed <dialog> keeps its children in the DOM, so the
    // text is present either way and the check would pass on a broken payload.
    // The `open` property is what the state key actually decides.
    const panel = container.querySelector("dialog")!;
    expect(panel.open).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(panel.open).toBe(true);

    // The DOM id is namespaced; the key `openDialog` names is not.
    expect(idsIn(container)).toEqual(["doc-share"]);

    // Closing goes through the same key, and had no coverage under a scope at
    // all — every other closeDialog test renders without one.
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(panel.open).toBe(false);
  });

  it("leaves an id a cloning parent injected unscoped, and still merges the two", async () => {
    render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          root: {
            component: "Tooltip",
            props: { content: "Saved to your library" },
            children: [
              { component: "Button", props: { "aria-describedby": "help" }, children: ["Save"] },
            ],
          },
        })}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Save" });
    expect(trigger).toHaveAttribute("aria-describedby", "doc-help");

    await userEvent.hover(trigger);
    await screen.findByText("Saved to your library");

    const described = trigger.getAttribute("aria-describedby")!.split(/\s+/);
    // The document's token is scoped; Tooltip's own is already unique per
    // instance and is injected after the loop, so it must arrive untouched.
    expect(described).toContain("doc-help");
    expect(described).toHaveLength(2);
    expect(described.filter((id) => id.startsWith("doc-"))).toEqual(["doc-help"]);
  });

  it("leaves a state key addressable by the name the document wrote", async () => {
    render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          state: { tab: "one" },
          root: {
            component: "Stack",
            children: [
              {
                component: "Button",
                props: {
                  id: "go",
                  onClick: { action: "setState", payload: { key: "tab", value: "two" } },
                },
                children: ["Switch"],
              },
              { $ref: "state.tab" },
            ],
          },
        })}
      />,
    );
    expect(screen.getByRole("button").id).toBe("doc-go");
    await userEvent.click(screen.getByRole("button"));
    // A scoped `state` key would write `doc-tab` and the $ref would read nothing.
    expect(await screen.findByText("two")).toBeInTheDocument();
  });

  it("leaves an icon's name alone", () => {
    render(
      <ViewRenderer
        idScope="doc"
        icons={lucideIcons}
        spec={spec({ root: { component: "Icon", props: { name: "check" } } })}
      />,
    );
    // A prefixed name resolves to nothing and degrades to a missing-icon span.
    expect(findRenderDiagnostics(document.body)).toEqual([]);
  });

  it("leaves a person's name alone", () => {
    render(
      <ViewRenderer
        idScope="doc"
        spec={spec({ root: { component: "Avatar", props: { name: "Ada Lovelace" } } })}
      />,
    );
    expect(screen.getByText("AL")).toBeInTheDocument();
  });
});

describe("props that look like DOM ids and are not", () => {
  it("leaves a view-transition-name alone", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          root: { component: "ViewTransition", props: { name: "hero" }, children: ["Poster"] },
        })}
      />,
    );
    // A view-transition-name only does anything when it MATCHES a counterpart —
    // across a navigation, or a host's `::view-transition-group(hero)`. Prefixing
    // it breaks the pairing and reports nothing. It is required, not optional,
    // which is how it slipped past the first version of the gate.
    const styled = container.querySelector<HTMLElement>("[style*='view-transition-name']")!;
    expect(styled.style.viewTransitionName).toBe("hero");
  });

  it("scopes a component's own author-supplied id props with its label", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          root: {
            component: "Stack",
            children: [
              { component: "Label", props: { htmlFor: "from" }, children: ["From"] },
              { component: "DateRangePicker", props: { startInputId: "from", endInputId: "to" } },
            ],
          },
        })}
      />,
    );
    // `startInputId` is declared upstream so a `Label htmlFor` can name it. Scope
    // the label and not the id and turning the feature ON breaks a label that
    // worked with it off — a regression, not merely an incomplete fix.
    const label = container.querySelector<HTMLLabelElement>("label")!;
    expect(label.htmlFor).toBe("doc-from");
    expect(document.getElementById(label.htmlFor)).not.toBeNull();
  });
});

describe("the limitations the README admits to", () => {
  it("derives the same prefix in two separate server render passes", () => {
    const markup = () =>
      renderToStaticMarkup(<ViewRenderer spec={poll} idScope />).match(/id="([^"]+)"/)?.[1];

    // React restarts its id counter per pass, so `true` cannot separate documents
    // a host renders one-per-pass. The README says so; this is the check that
    // keeps the README honest rather than merely reassuring.
    expect(markup()).toBe(markup());
  });

  it("does not scope a fragment href, so it cannot reach a scoped target", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          root: {
            component: "Stack",
            children: [
              { component: "Text", props: { id: "main" }, children: ["Body"] },
              { component: "Button", props: { as: "a", href: "#main" }, children: ["Skip"] },
            ],
          },
        })}
      />,
    );
    // `href` goes through the URL filter, not the id rules. A fragment is still
    // an id reference, so this one is a real limit and is documented as one.
    const link = container.querySelector<HTMLAnchorElement>("a[href]")!;
    expect(link.getAttribute("href")).toBe("#main");
    expect(container.querySelector("#main")).toBeNull();
  });
});

describe("the limitation the README admits to", () => {
  it("does not de-duplicate a literal id repeated by $each inside one document", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          data: { rows: { type: "static", value: [{ n: 1 }, { n: 2 }, { n: 3 }] } },
          root: {
            component: "Stack",
            children: [
              {
                $each: "data.rows",
                as: "row",
                node: { component: "Input", props: { id: "row-input" } },
              },
            ],
          },
        })}
      />,
    );
    const ids = idsIn(container);
    expect(ids).toEqual(["doc-row-input", "doc-row-input", "doc-row-input"]);
    // One scope per renderer, so scoping cannot separate rows of one document —
    // exactly what the README tells the author, and the reason it tells them.
    expect(new Set(ids).size).toBe(1);
  });
});

/**
 * The behavioural tests above each cover one member of these tables. Membership
 * itself was unguarded: adding a bogus entry, dropping three ARIA props, or
 * flipping a `"dom"` classification to `"own"` all left the whole suite green —
 * and after the default was inverted, a wrong `"dom"` is the difference between
 * the radio-merge bug being fixed and not.
 */
describe("the classification tables are pinned, not just exercised", () => {
  it("scopes exactly these id-bearing props", () => {
    expect([...ID_REF_PROPS].sort()).toEqual([
      "aria-activedescendant",
      "aria-controls",
      "aria-describedby",
      "aria-details",
      "aria-errormessage",
      "aria-flowto",
      "aria-labelledby",
      "aria-owns",
      "endInputId",
      "form",
      "htmlFor",
      "id",
      "list",
      "startInputId",
    ]);
  });

  it("treats exactly these components' name as a DOM name", () => {
    const by = (meaning: "dom" | "own") =>
      Object.entries(NAME_PROP_MEANING)
        .filter(([, value]) => value === meaning)
        .map(([name]) => name)
        .sort();

    expect(by("dom")).toEqual([
      "Checkbox",
      "Combobox.Input",
      "DatePicker",
      "DateRangePicker",
      "Input",
      "NumberInput",
      "Radio",
      "SearchInput",
      "Select",
      "Slider",
      "Switch",
      "TagInput",
      "Textarea",
    ]);
    expect(by("own")).toEqual([
      "Avatar",
      "AvatarUpload",
      "Field",
      "FieldError",
      "Icon",
      "Repeater",
      "ViewTransition",
    ]);
  });

  // Negative space: the table above says what IS scoped, and nothing said what
  // is not. Making `value` an id-bearing prop corrupts every submitted value in
  // a scoped document, and left the suite green.
  it.each(["value", "defaultValue", "children", "className", "type", "role", "key", "title"])(
    "never treats %s as an id",
    (key) => {
      expect(isIdScopedProp("Input", key)).toBe(false);
      expect(isIdScopedProp("Radio", key)).toBe(false);
    },
  );

  it("scopes name only for a DOM-name component", () => {
    for (const [component, meaning] of Object.entries(NAME_PROP_MEANING)) {
      expect(isIdScopedProp(component, "name"), component).toBe(meaning === "dom");
    }
    // The default for anything absent — a future library component, or one a
    // host registered through extendRegistry — is to leave it alone.
    expect(isIdScopedProp("SomeHostComponent", "name")).toBe(false);
  });
});

describe("prefix handling", () => {
  it("treats an all-whitespace prefix as no scoping", () => {
    const { container } = render(<ViewRenderer spec={poll} idScope="   " />);
    expect(idsIn(container)).toEqual(["pick-a", "pick-b"]);
  });

  // Asserted against the function, not a render: React 19.2 already generates a
  // selector-safe id, so a rendered check would pass here whether or not the
  // strip exists. The peer range is `react ^19.0.0`, and 19.0/19.1 generate
  // `«r0»` — a real supported install this environment cannot reproduce.
  it.each([
    ["«r0»", "r0"],
    ["_r_0_", "_r_0_"],
  ])("reduces a generated id %s to something a selector can address", (generated, expected) => {
    expect(normalizeIdScope(true, generated)).toBe(expected);
    expect(normalizeIdScope(true, generated)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("passes a host's own prefix through as written", () => {
    // Rewriting it would break the outside lookup the host named it for, and
    // would collapse these two distinct scopes into one.
    expect(normalizeIdScope("turn/7", "«r0»")).toBe("turn/7");
    expect(normalizeIdScope("turn7", "«r0»")).toBe("turn7");
    expect(normalizeIdScope("turn-7", "«r0»")).toBe("turn-7");
    expect(normalizeIdScope(false, "«r0»")).toBe("");
    expect(normalizeIdScope(undefined, "«r0»")).toBe("");
  });

  it("emits ids a selector can address", () => {
    const { container } = render(<ViewRenderer spec={poll} idScope />);
    const ids = idsIn(container);
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("scopes a numeric id, which is what a row id resolves to", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          data: { rows: { type: "static", value: [{ id: 7 }, { id: 8 }] } },
          root: {
            component: "Stack",
            children: [
              {
                $each: "data.rows",
                as: "row",
                node: { component: "Input", props: { id: { $ref: "row.id" } } },
              },
            ],
          },
        })}
      />,
    );
    // Left unscoped these collide with the next document's rows, which is the
    // whole failure — and a numeric row id is the commonest generator output.
    expect(idsIn(container)).toEqual(["doc-7", "doc-8"]);
  });

  it("leaves an empty id alone rather than emitting a bare prefix", () => {
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({ root: { component: "Input", props: { id: "", name: "" } } })}
      />,
    );
    const input = container.querySelector<HTMLInputElement>("input")!;
    expect(input.id).toBe("");
    expect(input.getAttribute("name")).toBe("");
  });

  it("leaves an object on a scoped key alone", () => {
    // `form` is an id reference on a DOM element and a `FormApi` on
    // `FormProvider`. Only strings are prefixed, which is what keeps the two
    // apart without the rule needing to know which component it is on.
    const { container } = render(
      <ViewRenderer
        idScope="doc"
        spec={spec({
          data: { cfg: { type: "static", value: { owner: { id: "kept" } } } },
          root: { component: "Input", props: { form: { $ref: "data.cfg.owner" } } },
        })}
      />,
    );
    expect(container.querySelector("input")!.getAttribute("form")).not.toBe("doc-[object Object]");
  });

  it("follows the prop when a mounted view changes scope", () => {
    // The prefix rides on the view context. Leaving it out of that memo's
    // dependencies leaves a mounted renderer painting the old namespace, and
    // eslint carries no exhaustive-deps rule to notice.
    const { container, rerender } = render(<ViewRenderer spec={poll} idScope="first" />);
    expect(idsIn(container)).toEqual(["first-pick-a", "first-pick-b"]);

    rerender(<ViewRenderer spec={poll} idScope="second" />);
    expect(idsIn(container)).toEqual(["second-pick-a", "second-pick-b"]);
  });

  it("keeps the prefix stable across re-renders and across a new document", () => {
    const { container, rerender } = render(<ViewRenderer spec={poll} idScope />);
    const before = idsIn(container);
    rerender(<ViewRenderer spec={{ ...poll, title: "Renamed" }} idScope />);
    expect(idsIn(container)).toEqual(before);
  });
});

describe("real generated documents", () => {
  it.each(Object.entries(exampleSpecs))("renders %s scoped, with no diagnostics", (_n, doc) => {
    const { container } = render(
      <ViewRenderer spec={doc as ViewSpec} icons={lucideIcons} idScope="doc" />,
    );
    expect(findRenderDiagnostics(document.body)).toEqual([]);
    expect(container.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("keeps every label in the specimen pointing at a control that exists", () => {
    const { container } = render(
      <ViewRenderer spec={exampleSpecs.contactForm as ViewSpec} idScope="doc" />,
    );
    const labels = [...container.querySelectorAll<HTMLLabelElement>("label[for]")];
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(document.getElementById(label.htmlFor)).not.toBeNull();
    }
  });
});
