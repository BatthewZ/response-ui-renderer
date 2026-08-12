import { ToastProvider } from "@batthewz/response-ui-react-components";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { defaultReferenceContracts } from "../reference/contracts";
import { defaultRegistry } from "../registry/registry";
import { extendRegistry } from "../registry/types";
import { type ComponentNode, extendContracts, isComponentNode, type ViewSpec } from "../spec";
import { BUILDER_PATH_SELECTOR } from "./instrument";
import { nodeAt, type NodePath, pathToKey } from "./tree";
import { ViewBuilder } from "./ViewBuilder";

/**
 * The builder, driven the way someone without a mouse drives it.
 *
 * The drag is a pointer gesture and jsdom has no layout — `elementFromPoint`
 * answers nothing and every box is zero by zero — so the drop geometry is tested
 * as functions in `drop.test.ts` and what is asserted here is everything that
 * survives having no viewport: that a palette entry adds the node it says it
 * will, that the inspector edits the selected node, that the theme panel writes
 * to the document, and that what comes out is a document and not a picture of
 * one.
 *
 * The keyboard path is not a lesser path. It is the same command the drag runs,
 * and it is the only one a screen-reader user has.
 */

function mount(props: Parameters<typeof ViewBuilder>[0] = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ViewBuilder onChange={onChange} {...props} />
    </ToastProvider>,
  );
  const latest = (): ViewSpec | null => {
    const calls = onChange.mock.calls;
    return calls.length === 0 ? null : (calls[calls.length - 1][0] as ViewSpec | null);
  };
  return { user, onChange, latest };
}

/**
 * The palette button for exactly this component.
 *
 * Anchored on the whole label, not just the prefix: the accessible name is
 * `"Accordion. Add to …"`, and `/^Accordion\./` also matches `Accordion.Item`
 * and `Accordion.Trigger`.
 */
const add = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name.replace(/\./g, "\\.")}\\. Add`) });

/**
 * The palette section holding a component, reached through the component rather
 * than through the category it happens to live in: which section owns `Card` is
 * the contracts' business, and a test that spelled the category would fail on a
 * recategorisation that broke nothing.
 */
function sectionOf(name: string): { trigger: HTMLElement; panel: HTMLElement } {
  const panel = add(name).closest<HTMLElement>("[role='region']");
  if (panel === null) throw new Error(`"${name}" is not inside a palette section`);
  const trigger = document.getElementById(panel.getAttribute("aria-labelledby") ?? "");
  if (trigger === null) throw new Error(`the section holding "${name}" is not labelled by a heading`);
  return { trigger, panel };
}

/**
 * The component node at a path, or a failure naming the path.
 *
 * Narrowed rather than cast: a cast would keep passing if an edit put a string
 * or a `$cond` where a component was expected, and the assertion below it would
 * then be reading a property off something that never had one.
 */
function componentAt(spec: ViewSpec | null, path: NodePath): ComponentNode {
  const node = spec === null ? null : nodeAt(spec.root, path);
  if (node === null || !isComponentNode(node)) {
    throw new Error(`no component at "${pathToKey(path)}" — found ${JSON.stringify(node)}`);
  }
  return node;
}

describe("adding components", () => {
  it("starts empty, and says so rather than showing a broken document", () => {
    const { latest } = mount();
    expect(latest()).toBeNull();
    expect(screen.getByText("Drag a component here")).toBeInTheDocument();
    // The verdict pill, not any of the palette chips that happen to say "Empty".
    expect(document.querySelector(".rui-builder-status")).toHaveTextContent("Empty");
  });

  it("makes the first component the document root", async () => {
    const { user, latest } = mount();
    await user.click(add("Card"));

    const spec = latest();
    expect(spec).not.toBeNull();
    expect(spec?.version).toBe(1);
    expect(componentAt(spec, []).component).toBe("Card");
    // And it is a *document*, valid enough that the toolbar says so.
    expect(screen.getByText("Valid document")).toBeInTheDocument();
  });

  it("nests the next one inside the selection, and says where before it is clicked", async () => {
    // No templates, so each component lands bare and the structure under test is
    // the builder's and not the corpus's. What the shipped templates bring with
    // them is asserted in `catalog.test.ts`.
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Card"));

    // The label is the promise: the button says where the click will put it.
    expect(add("Text")).toHaveAccessibleName("Text. Add to inside Card");

    await user.click(add("Text"));
    const spec = latest();
    expect(componentAt(spec, []).component).toBe("Card");
    expect(componentAt(spec, []).children).toHaveLength(1);
    expect(componentAt(spec, [0]).component).toBe("Text");

    // And again, one level deeper: the selection follows what was just added,
    // so a run of clicks nests rather than piling up at one level.
    await user.click(add("Badge"));
    expect(componentAt(spec === null ? null : latest(), [0, 0]).component).toBe("Badge");
  });

  it("puts one after the selection when the selection cannot hold it", async () => {
    const { user, latest } = mount();
    await user.click(add("Card"));
    await user.click(add("Input"));
    // `Input` is now selected and takes no children, so the next one is a
    // sibling. Nesting into it would be a drop that renders nothing.
    expect(add("Badge")).toHaveAccessibleName("Badge. Add to after Input");

    await user.click(add("Badge"));
    // Relative to the end: `Card` arrives from the corpus with children of its
    // own, and what is being asserted is the pair, not the count.
    const children = componentAt(latest(), []).children ?? [];
    expect(children.length).toBeGreaterThan(1);
    expect(componentAt(latest(), [children.length - 2]).component).toBe("Input");
    expect(componentAt(latest(), [children.length - 1]).component).toBe("Badge");
  });

  it("filters the palette by the name a document spells", async () => {
    const { user } = mount();
    await user.type(screen.getByLabelText("Search components"), "table.r");

    expect(screen.getByRole("button", { name: /^Table\.Row\./ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Card\./ })).toBeNull();
  });

  it("leaves out the components a document cannot drive", () => {
    mount();
    expect(screen.queryByRole("button", { name: /^FileUpload\./ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Repeater\./ })).toBeNull();
  });

  it("collapses a category, and takes its components out of reach with it", async () => {
    const { user } = mount();
    const section = sectionOf("Card");
    expect(section.trigger).toHaveAttribute("aria-expanded", "true");
    expect(section.panel).not.toHaveAttribute("inert");

    await user.click(section.trigger);

    expect(section.trigger).toHaveAttribute("aria-expanded", "false");
    // A collapsed panel is only CSS-clipped, and jsdom has no layout to clip
    // with — `inert` is the part that is actually load-bearing here, because it
    // is what takes the chips out of the tab order and the accessibility tree.
    // Without it the section would look shut and still be reachable by Tab.
    expect(section.panel).toHaveAttribute("inert");
  });

  it("opens a collapsed category rather than hide a search hit behind it", async () => {
    const { user } = mount();
    await user.click(sectionOf("Card").trigger);

    await user.type(screen.getByLabelText("Search components"), "card");

    expect(sectionOf("Card").trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps a section collapsed while the query it was collapsed under is refined", async () => {
    const { user } = mount();
    const search = screen.getByLabelText("Search components");

    await user.type(search, "car");
    await user.click(sectionOf("Card").trigger);
    await user.type(search, "d");

    // Reopening per keystroke would undo the collapse the moment it was made.
    expect(sectionOf("Card").trigger).toHaveAttribute("aria-expanded", "false");
  });
});

describe("the canvas is the render", () => {
  it("draws the real components, marked with the node that drew them", async () => {
    const { user } = mount();
    await user.click(add("Card"));
    await user.click(add("Badge"));

    // Not a diagram: a real `Badge` element, carrying the path of the node in
    // the document that produced it.
    const marked = document.querySelectorAll(BUILDER_PATH_SELECTOR);
    expect(marked.length).toBeGreaterThan(1);
    expect([...marked].map((element) => element.getAttribute("data-rui-builder-path"))).toContain("0");
  });

  it("can be picked up, which is the gesture the whole page is for", async () => {
    // jsdom has no layout, so where a drag *lands* is tested as functions in
    // `drop.test.ts`. What is asserted here is the half that only the component
    // can answer: that pressing on a rendered node and moving starts a drag of
    // that node at all. It did not, for a while — the canvas was drop-only, and
    // nothing about that compiles differently.
    const { user } = mount({ templates: {} });
    await user.click(add("Card"));
    await user.click(add("Badge"));

    const badge = document.querySelector('[data-rui-builder-path="0"]');
    expect(badge).not.toBeNull();

    fireEvent.pointerDown(badge!, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 90, clientY: 90 });

    expect(document.querySelector(".rui-builder-ghost")).toHaveTextContent("Badge");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.querySelector(".rui-builder-ghost")).toBeNull();
  });

  it("does not pick up the root, which has nowhere to go", async () => {
    const { user } = mount({ templates: {} });
    await user.click(add("Card"));

    const root = document.querySelector('[data-rui-builder-path=""]');
    fireEvent.pointerDown(root!, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 90, clientY: 90 });

    expect(document.querySelector(".rui-builder-ghost")).toBeNull();
  });

  it("keeps the marking out of the document that leaves", async () => {
    const { user, latest } = mount();
    await user.click(add("Card"));
    expect(JSON.stringify(latest())).not.toContain("data-rui-builder-path");
  });
});

describe("the inspector", () => {
  it("offers a component's variants as the contract defines them", async () => {
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Badge"));

    // `Badge.variant` is an enumerated prop, so it is buttons rather than a text
    // field — and the members are the library's own, read from the same
    // `propEnums` the validator checks a document against.
    const inspector = screen.getByLabelText("Properties and theme");
    for (const variant of ["default", "success", "warning", "error", "info"]) {
      expect(within(inspector).getByRole("button", { name: variant })).toBeInTheDocument();
    }

    await user.click(within(inspector).getByRole("button", { name: "success", pressed: false }));
    expect(componentAt(latest(), []).props?.variant).toBe("success");

    // Pressing the pressed one clears it, which is the only way back to the
    // component's own default.
    await user.click(within(inspector).getByRole("button", { name: "success", pressed: true }));
    expect(componentAt(latest(), []).props?.variant).toBeUndefined();
  });

  it("offers a wide enumeration as a list instead of a wall of buttons", async () => {
    // `Text.variant` has nine members; nine buttons is not a control.
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Text"));

    const select = screen.getByLabelText("variant");
    await user.selectOptions(select, "h3");
    expect(componentAt(latest(), []).props?.variant).toBe("h3");
  });

  it("offers a variant the prop table does not mention", async () => {
    // `Timeline.Item.titleAs` is bounded by `propEnums` and has no row in the
    // prop table — the two are generated from different things. Drawing only
    // the table left the panel saying a component with six variants declared no
    // props at all, for five components.
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Timeline.Item"));

    const inspector = screen.getByLabelText("Properties and theme");
    expect(within(inspector).queryByText(/declares no props of its own/)).toBeNull();

    await user.click(within(inspector).getByRole("button", { name: "h3" }));
    expect(componentAt(latest(), []).props?.titleAs).toBe("h3");
  });

  it("bounds a heading level to the six the renderer allows", async () => {
    // `headingLevel` is interpolated into a tag name, so the renderer refuses
    // anything else. It reaches the inspector through the contract's
    // `headingLevelProps`, which a reshaped contract used to drop — leaving a
    // free-text JSON box over a value that has exactly six members.
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Accordion"));

    const inspector = screen.getByLabelText("Properties and theme");
    await user.click(within(inspector).getByRole("button", { name: "3" }));
    expect(componentAt(latest(), []).props?.headingLevel).toBe("3");
  });

  it("does not offer a text editor for a component that takes no children", async () => {
    // `every` on an empty array is true. Typing into the field it used to give
    // a `Divider` puts children on a void element, which throws. The default
    // templates are needed here: with none, every component is a container by
    // the forgiving default, and `Divider` would be offered the field for a
    // reason that has nothing to do with the bug.
    const { user } = mount();
    await user.click(add("Divider"));

    const inspector = screen.getByLabelText("Properties and theme");
    expect(within(inspector).queryByLabelText("Text")).toBeNull();
  });

  it("edits the text a component holds", async () => {
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Text"));

    await user.clear(screen.getByLabelText("Text"));
    await user.type(screen.getByLabelText("Text"), "Hello");
    expect(componentAt(latest(), []).children).toEqual(["Hello"]);
  });

  it("writes a `classNames` field to the slot key the contract names", async () => {
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Select"));

    // `control` and `chevron` are `Select`'s documented slots, and they are the
    // two elements a caller cannot otherwise reach.
    await user.type(screen.getByLabelText("classNames.chevron"), "opacity-50");
    expect(componentAt(latest(), []).props?.classNames).toEqual({ chevron: "opacity-50" });
  });

  it("deletes the selected node and stops describing it", async () => {
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Card"));
    await user.click(add("Badge"));

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(componentAt(latest(), []).children).toBeUndefined();

    // The selection moves to what contained it, not to whatever slid into its
    // place — so the inspector is describing the `Card` a moment later.
    const inspector = screen.getByLabelText("Properties and theme");
    expect(within(inspector).getByRole("heading", { level: 3 })).toHaveTextContent("Card");

    // And deleting the root really does empty the document.
    await user.click(within(inspector).getByRole("button", { name: "Delete" }));
    expect(latest()).toBeNull();
    expect(screen.getByText(/Select something on the canvas/)).toBeInTheDocument();
    expect(screen.getByText("Drag a component here")).toBeInTheDocument();
  });

  it("undoes it again", async () => {
    const { user, latest } = mount({ templates: {} });
    await user.click(add("Card"));
    await user.click(add("Badge"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(componentAt(latest(), []).children).toHaveLength(1);
  });
});

describe("living inside somebody else's application", () => {
  it("calls onChange once per edit, for the host the README tells people to write", async () => {
    // An inline arrow that stores the document — the documented usage. Its
    // identity changes on every render of the host, so naming it as an effect
    // dependency calls it a second time for a change that did not happen. React
    // bails out of the resulting re-render because the value is identical, which
    // is what keeps that from being an infinite loop — but the host is still
    // told twice about one edit, and a host that logs, posts or diffs on change
    // does it twice.
    const calls: (ViewSpec | null)[] = [];

    function Host() {
      const [saved, setSaved] = useState<ViewSpec | null>(null);
      return (
        <>
          <ViewBuilder
            templates={{}}
            onChange={(spec) => {
              calls.push(spec);
              setSaved(spec);
            }}
          />
          <p data-testid="saved">{saved === null ? "nothing" : saved.title}</p>
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Host />
      </ToastProvider>,
    );

    const atStart = calls.length;
    await user.click(add("Card"));

    expect(screen.getByTestId("saved")).toHaveTextContent("Untitled view");
    expect(calls.length).toBe(atStart + 1);
  });

  it("leaves the host's own keys alone when the focus is outside it", async () => {
    const { user } = mount({ templates: {} });
    await user.click(add("Card"));
    await user.click(add("Badge"));

    // Backspace with something outside the builder focused. On the window this
    // deleted a node out of a document the reader may not be looking at.
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    fireEvent.keyDown(outside, { key: "Backspace" });

    expect(document.querySelector('[data-rui-builder-path="0"]')).not.toBeNull();
    outside.remove();
  });
});

describe("the theme panel", () => {
  it("writes a token from the contract into the document's own themeOverrides", async () => {
    const { user, latest } = mount();
    await user.click(add("Card"));
    await user.click(screen.getByRole("tab", { name: /^Theme/ }));

    await user.click(screen.getByRole("button", { name: "C-PRIMARY" }));

    const overrides = latest()?.themeOverrides;
    expect(overrides).toBeDefined();
    expect(Object.keys(overrides ?? {})).toEqual(["--C-PRIMARY"]);
    expect(screen.getByRole("tab", { name: "Theme (1)" })).toBeInTheDocument();
  });

  it("removes the key rather than freezing the current value into the document", async () => {
    const { user, latest } = mount();
    await user.click(add("Card"));
    await user.click(screen.getByRole("tab", { name: /^Theme/ }));
    await user.click(screen.getByRole("button", { name: "C-PRIMARY" }));

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(latest()?.themeOverrides).toBeUndefined();
  });
});

describe("a host's own registry", () => {
  it("gets a palette entry, a template and an inspector, with nothing taught here", async () => {
    const PriceTag = ({ amount }: { amount: string }) => <p>{amount}</p>;

    const { user, latest } = mount({
      registry: extendRegistry(defaultRegistry, { PriceTag }),
      contracts: extendContracts(defaultReferenceContracts, {
        PriceTag: {
          category: "Data",
          propEnums: { emphasis: ["quiet", "loud"] },
          props: [
            { key: "amount", optional: false, type: "string" },
            { key: "emphasis", optional: true, type: '"quiet"|"loud"' },
          ],
        },
      }),
    });

    await user.click(add("PriceTag"));
    expect(componentAt(latest(), []).component).toBe("PriceTag");

    // The variants come from the contract the host supplied, through the same
    // code path the built-in components use.
    const inspector = screen.getByLabelText("Properties and theme");
    await user.click(within(inspector).getByRole("button", { name: "loud" }));
    expect(componentAt(latest(), []).props?.emphasis).toBe("loud");
  });
});
