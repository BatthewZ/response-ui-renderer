import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderThrowing } from "../../test-utils";
import { parseIsoDate } from "../registry/prop-coercions";
import type { ViewNode, ViewSpec } from "../spec/types";
import { validateViewSpec, warningsOf } from "../spec/validate";
import { findRenderDiagnostics } from "./diagnostics";
import { ViewRenderer } from "./ViewRenderer";

const spec = (partial: Partial<ViewSpec> & Pick<ViewSpec, "root">): ViewSpec => ({
  version: 1,
  title: "Parity",
  ...partial,
});

/**
 * Surfaces a form value in the DOM so a binding can be asserted on what the
 * store actually holds, rather than on what the control displays.
 */
const readout = (path: string) => ({ component: "Text", children: [{ $ref: path }] });

const oneField = (initialValue: unknown) => ({
  probe: { fields: { v: { initialValue } } },
});

/** One control bound to `probe.v`, beside a readout of what the store holds. */
const boundSpec = (
  initialValue: unknown,
  component: string,
  props: Record<string, unknown>,
): ViewSpec =>
  spec({
    forms: oneField(initialValue),
    root: {
      component: "Stack",
      children: [
        { component, props: { ...props, $field: "probe.v" } },
        readout("forms.probe.v"),
      ],
    },
  });

/** Every warning a document raises, joined so one `toContain` reads across all of them. */
const warningText = (doc: unknown): string =>
  warningsOf(validateViewSpec(doc).issues)
    .map((issue) => issue.message)
    .join("\n");

describe("$field on value-callback controls", () => {
  // The library re-types `onChange` to `(value) => void` on these controls and
  // calls it with a bare value. A binding that assumes a DOM ChangeEvent
  // dereferences `event.target` and throws inside the handler.
  it("binds a Slider without throwing", async () => {
    render(<ViewRenderer spec={boundSpec(10, "Slider", { "aria-label": "Volume" })} />);

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "60" } });
    expect(await screen.findByText("60")).toBeInTheDocument();
  });

  it("binds a TagInput without throwing", async () => {
    const user = userEvent.setup();
    render(<ViewRenderer spec={boundSpec([], "TagInput", { "aria-label": "Tags" })} />);

    await user.click(screen.getByLabelText("Tags"));
    await user.keyboard("alpha{Enter}");
    expect(await screen.findByText('["alpha"]')).toBeInTheDocument();
  });

  it("binds a NumberInput without throwing", async () => {
    const user = userEvent.setup();
    render(<ViewRenderer spec={boundSpec(1, "NumberInput", { "aria-label": "Qty" })} />);

    await user.clear(screen.getByLabelText("Qty"));
    await user.type(screen.getByLabelText("Qty"), "7");
    await user.tab();
    expect(await screen.findByText("7")).toBeInTheDocument();
  });
});

describe("$field on Switch", () => {
  // Switch declares `onChange?: never` and destructures it away; it reports
  // through `onCheckedChange`. A binding wired to `onChange` renders the store's
  // value and can never write back — silently one-way.
  it("writes back when toggled", async () => {
    const user = userEvent.setup();
    render(<ViewRenderer spec={boundSpec(false, "Switch", { "aria-label": "Notify" })} />);

    await user.click(screen.getByLabelText("Notify"));
    expect(await screen.findByText("true")).toBeInTheDocument();
  });
});

describe("$field on Radio", () => {
  const radioSpec = (props: Record<string, unknown>) =>
    spec({
      forms: oneField("monthly"),
      root: {
        component: "Radio",
        props: { name: "billing", value: "monthly", "aria-label": "Monthly", ...props },
      },
    });

  it("checks under the bare spelling", () => {
    render(<ViewRenderer spec={radioSpec({ $field: "probe.v" })} />);
    expect(screen.getByLabelText("Monthly")).toBeChecked();
  });

  // A radio's `value` is its option identity, so the longhand — which occupies
  // that same key — cannot express one. Not fixable in the renderer; the
  // validator says so instead of leaving a silently dead control.
  it("warns rather than silently failing under the longhand spelling", () => {
    const longhand = radioSpec({ value: { $field: "probe.v" } });
    expect(validateViewSpec(longhand).ok).toBe(true);
    expect(warningText(longhand)).toContain("bind it with the bare form");
  });
});

describe("controlled-only dialogs", () => {
  it("warns when a Dialog has no id for an action to target", () => {
    const idless = spec({ root: { component: "Dialog", children: ["Body"] } });
    expect(validateViewSpec(idless).ok).toBe(true);
    expect(warningText(idless)).toContain("nothing can open it");
  });

  it("opens a CommandPalette through openDialog, like any other dialog", async () => {
    const user = userEvent.setup();
    render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Stack",
            children: [
              {
                component: "Button",
                props: { onClick: { action: "openDialog", payload: { dialogId: "launcher" } } },
                children: ["Open"],
              },
              { component: "CommandPalette", props: { id: "launcher", items: [] } },
            ],
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  // Opening was proven; closing was not. This covers the `closeDialog` ACTION,
  // which calls dialogs.close directly.
  //
  // It does NOT cover the `onClose` prop NodeRenderer injects — verified by
  // breaking that wiring, which leaves this test green. That path needs a native
  // dismiss, and jsdom's <dialog> is a stub, so Escape does nothing. `DialogHeader`
  // ships a close control as of 0.15.0, but clicking it calls that component's own
  // `onClose`, not the panel's, so it does not close this gap either.
  it("closes again through closeDialog", async () => {
    const user = userEvent.setup();
    render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Stack",
            children: [
              {
                component: "Button",
                props: { onClick: { action: "openDialog", payload: { dialogId: "d" } } },
                children: ["Open"],
              },
              {
                component: "Dialog",
                props: { id: "d" },
                children: [
                  {
                    component: "Button",
                    props: { onClick: { action: "closeDialog", payload: { dialogId: "d" } } },
                    children: ["Close"],
                  },
                ],
              },
            ],
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // The coverage corpus names both of these, but a corpus render mounts no
  // closed dialog's children, so it proves the names resolve and nothing more.
  // Opening one is the only way to see them render — and the header's close
  // control is the first close affordance in the library a document can reach,
  // so it is asserted on the button the component actually ships rather than on
  // one the fixture supplies.
  it("renders DialogHeader and DialogBody in an open panel, and closes from the header", async () => {
    const user = userEvent.setup();
    render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Stack",
            children: [
              {
                component: "Button",
                props: { onClick: { action: "openDialog", payload: { dialogId: "d" } } },
                children: ["Open"],
              },
              {
                component: "Dialog",
                props: { id: "d", "aria-labelledby": "panel-title" },
                children: [
                  {
                    component: "DialogHeader",
                    props: {
                      onClose: { action: "closeDialog", payload: { dialogId: "d" } },
                      closeLabel: "Close the panel",
                    },
                    children: [
                      { component: "Text", props: { variant: "h3", id: "panel-title" }, children: ["Share"] },
                    ],
                  },
                  { component: "DialogBody", children: [{ component: "Text", children: ["Body copy"] }] },
                ],
              },
            ],
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // Both parts really mounted: a component that failed to resolve renders a
    // diagnostic in place, and an empty one would still satisfy findByRole.
    expect(screen.getByText("Share")).toBeInTheDocument();
    expect(screen.getByText("Body copy")).toBeInTheDocument();
    expect(findRenderDiagnostics(document.body)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Close the panel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("components that clone their child", () => {
  // Tooltip injects a ref and seven handlers by cloning its child. The renderer
  // wraps every child in a NodeErrorBoundary, so the clone lands on the boundary
  // and the trigger never registers.
  it("opens a Tooltip from its trigger", async () => {
    const user = userEvent.setup();
    render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Tooltip",
            props: { content: "Saved to your library" },
            children: [{ component: "Button", children: ["Save"] }],
          },
        })}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved to your library")).toBeInTheDocument();
  });

  // `$cond` resolves to one node, so the clone is still addressed to one
  // element. Dropping the injected props there fails silently — nothing throws,
  // the tooltip just never opens.
  it("opens a Tooltip whose trigger is behind a $cond", async () => {
    const user = userEvent.setup();
    render(
      <ViewRenderer
        spec={spec({
          data: { signedIn: { type: "static", value: true } },
          root: {
            component: "Tooltip",
            props: { content: "Saved to your library" },
            children: [
              { $cond: "data.signedIn", then: { component: "Button", children: ["Save"] } },
            ],
          },
        })}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved to your library")).toBeInTheDocument();
  });

  // The parent computes what to inject from the child element's props, which are
  // the renderer's — it can never see the document's own value, so an injected
  // `undefined` must not erase one, and an IDREF list must be appended to.
  it("keeps the document's own aria-describedby on a cloned trigger", async () => {
    const user = userEvent.setup();
    render(
      <ViewRenderer
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
    expect(trigger).toHaveAttribute("aria-describedby", "help");

    await user.hover(trigger);
    await screen.findByText("Saved to your library");
    expect(trigger.getAttribute("aria-describedby")?.split(/\s+/)).toContain("help");
  });
});

describe("handler arguments", () => {
  // Pagination is controlled-only with no defaultPage: without the reported page
  // number reaching state, the pager can never move.
  it("advances a Pagination through setState", async () => {
    const user = userEvent.setup();
    render(
      <ViewRenderer
        spec={spec({
          state: { page: 1 },
          root: {
            component: "Pagination",
            props: {
              page: { $ref: "state.page" },
              totalPages: 5,
              "aria-label": "Results",
              onPageChange: {
                action: "setState",
                payload: { key: "page", value: { $ref: "event.value" } },
              },
            },
          },
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /1/ })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: /3/ }));
    expect(await screen.findByRole("button", { name: /3/ })).toHaveAttribute("aria-current", "page");
  });

  it("composes a nested handler inside an array prop", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <ViewRenderer
        adapters={{ navigate }}
        spec={spec({
          root: {
            component: "CommandPalette",
            props: {
              id: "launcher",
              open: true,
              items: [
                {
                  id: "settings",
                  label: "Open settings",
                  onSelect: { action: "navigate", payload: { path: "/settings" } },
                },
              ],
            },
          },
        })}
      />,
    );

    await user.click(await screen.findByText("Open settings"));
    expect(navigate).toHaveBeenCalledWith("/settings");
  });

  // Nested values are normally data. A row carrying an `action` string must stay
  // a row, or a feed of "merged"/"opened" events would turn into callbacks.
  it("leaves data that merely has an `action` field alone", () => {
    render(
      <ViewRenderer
        spec={spec({
          data: {
            rows: {
              type: "static",
              value: [{ id: "1", actor: "Ada", action: "merged", target: "main" }],
            },
          },
          root: {
            component: "ActivityFeed",
            children: [
              {
                $each: "data.rows",
                as: "row",
                node: {
                  component: "ActivityFeed.Item",
                  props: {
                    actor: { $ref: "row.actor" },
                    action: { $ref: "row.action" },
                    target: { $ref: "row.target" },
                  },
                },
              },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("merged")).toBeInTheDocument();
  });
});

describe("$node props", () => {
  it("renders a ViewNode into a prop the library types ReactNode", () => {
    render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Wizard",
            props: {
              steps: [
                {
                  title: "Account",
                  content: { $node: { component: "Text", children: ["Pick a username"] } },
                },
                { title: "Done", content: { $node: "All set" } },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByText("Pick a username")).toBeInTheDocument();
  });

  it("leaves `event` unresolvable outside a handler", () => {
    const { container } = render(
      <ViewRenderer spec={spec({ root: { $ref: "event.value" } })} />,
    );
    expect(container.textContent).toBe("");
  });
});

describe("props JSON cannot type", () => {
  const orders = [
    { ref: "ORD-1", customer: "Ada Lovelace", status: "shipped" },
    { ref: "ORD-2", customer: "Grace Hopper", status: "pending" },
  ];

  // `rowKey` is required and is a function, so without the string form neither
  // table can be instantiated from a document at all.
  it("instantiates a DataTable from a string rowKey", () => {
    render(
      <ViewRenderer
        spec={spec({
          data: { orders: { type: "static", value: orders } },
          root: {
            component: "DataTable",
            props: {
              data: { $ref: "data.orders" },
              rowKey: "ref",
              columns: [
                { key: "ref", header: "Order" },
                { key: "customer", header: "Customer" },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
  });

  // Every coercion below is keyed on the prop's NAME but switches on the value's
  // SHAPE, and a `$ref` is an object until it is resolved. Testing only the
  // literal spelling left each of these passing the unresolved marker through:
  // `rowKey` and the date props reached the library as `{$ref: …}` and threw.
  it("builds a key accessor from a $ref-resolved column name", () => {
    render(
      <ViewRenderer
        spec={spec({
          data: {
            orders: { type: "static", value: orders },
            keyField: { type: "static", value: "ref" },
          },
          root: {
            component: "DataTable",
            props: {
              data: { $ref: "data.orders" },
              rowKey: { $ref: "data.keyField" },
              columns: [{ key: "customer", header: "Customer" }],
            },
          },
        })}
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("renders a $node cell template once per row", () => {
    render(
      <ViewRenderer
        spec={spec({
          data: { orders: { type: "static", value: orders } },
          root: {
            component: "DataTable",
            props: {
              data: { $ref: "data.orders" },
              rowKey: "ref",
              columns: [
                { key: "ref", header: "Order" },
                {
                  key: "status",
                  header: "Status",
                  render: {
                    $node: {
                      component: "Badge",
                      children: [{ $ref: "row.status" }],
                    },
                  },
                },
              ],
            },
          },
        })}
      />,
    );
    expect(screen.getByText("shipped")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("seeds a Calendar from an ISO date string", () => {
    render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "Calendar",
            props: { defaultValue: "2026-06-14", defaultMonth: "2026-06-14" },
          },
        })}
      />,
    );
    // `aria-selected` belongs on the gridcell: ARIA does not allow it on a button.
    expect(screen.getByRole("gridcell", { selected: true })).toHaveTextContent("14");
  });

  it("seeds a Calendar from a $ref-resolved ISO date string", () => {
    render(
      <ViewRenderer
        spec={spec({
          data: { day: { type: "static", value: "2026-06-14" } },
          root: {
            component: "Calendar",
            props: { defaultValue: { $ref: "data.day" }, defaultMonth: { $ref: "data.day" } },
          },
        })}
      />,
    );
    expect(screen.getByRole("gridcell", { selected: true })).toHaveTextContent("14");
  });

  it("seeds a DateRangePicker from an ISO range", () => {
    const { container } = render(
      <ViewRenderer
        spec={spec({
          root: {
            component: "DateRangePicker",
            props: { name: "stay", defaultValue: { start: "2026-06-14", end: "2026-06-21" } },
          },
        })}
      />,
    );
    const submitted = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];
    expect(submitted.map((input) => input.value)).toEqual(["2026-06-14", "2026-06-21"]);
  });

  // A day that does not exist must not roll silently into the next month.
  it("leaves an impossible date untouched rather than rolling it forward", () => {
    expect(parseIsoDate("2026-02-30")).toBe("2026-02-30");
    expect(parseIsoDate("2026-02-28")).toBeInstanceOf(Date);
  });
});

describe("parents that inspect their children", () => {
  // Two shapes with two different outcomes, and the difference is the point.
  //
  // Tooltip injects its handlers by CLONING the child; the renderer forwards
  // whatever was injected onto the real element, so it works (asserted above).
  //
  // Hero, AvatarGroup, Table.Body, Breadcrumbs and Combobox.Content instead
  // compare `child.type` against a library component. That can never match — the
  // child's type is the renderer's own node component, at any depth — so the
  // inference is unavailable and the validator names the prop to set instead.

  it("cannot infer Hero's scrim, and says so", () => {
    const withBackground = spec({
      root: {
        component: "Hero",
        children: [
          { component: "Hero.Background", props: { src: "/cover.jpg", alt: "" } },
          { component: "Hero.Content", props: { animate: false }, children: ["Meridian"] },
        ],
      },
    });

    expect(warningText(withBackground)).toContain('set "overlay": true');

    // Stating it explicitly is all it takes, and silences the advice.
    const explicit = structuredClone(withBackground);
    (explicit.root as { props?: Record<string, unknown> }).props = { overlay: true };
    expect(warningsOf(validateViewSpec(explicit).issues)).toEqual([]);

    const { container } = render(<ViewRenderer spec={explicit} />);
    expect(container.querySelector(".hero__overlay")).not.toBeNull();
  });

  it("cannot pass AvatarGroup's size down, and says so", () => {
    const group = spec({
      root: {
        component: "AvatarGroup",
        props: { size: "lg" },
        children: [
          { component: "Avatar", props: { name: "Ada Lovelace" } },
          { component: "Avatar", props: { name: "Grace Hopper" } },
        ],
      },
    });
    expect(warningText(group)).toContain('set "size" on each Avatar');

    // Set per avatar, the size lands: `lg` is the `size-12` utility.
    const perAvatar = structuredClone(group);
    for (const child of (perAvatar.root as { children: { props: Record<string, unknown> }[] }).children) {
      child.props.size = "lg";
    }
    const { container } = render(<ViewRenderer spec={perAvatar} />);
    expect(container.querySelectorAll(".size-12")).toHaveLength(2);
  });

  it("stays quiet when the inference was never needed", () => {
    // A Hero with no Background never wanted a scrim; advice it cannot act on
    // is how an author learns to ignore warnings.
    const bare = spec({
      root: { component: "Hero", children: [{ component: "Hero.Content", children: ["Hi"] }] },
    });
    expect(warningsOf(validateViewSpec(bare).issues)).toEqual([]);
  });
});

describe("children a component calls", () => {
  // `MultiSelect` and `CommandPalette` type `children` as a function of their
  // own filtered list. A document supplies nodes, so before the renderer wrapped
  // them the root invoked an array and the whole component died with
  // "children is not a function".

  const OPTIONS = [
    { value: "ci", label: "Continuous integration" },
    { value: "logs", label: "Log search" },
  ];

  /** Chips + listbox, composed by the document from the root's own arguments. */
  const composedMultiSelect = (extraProps: Record<string, unknown> = {}) =>
    spec({
      data: { opts: { type: "static" as const, value: OPTIONS } },
      root: {
        component: "MultiSelect",
        props: {
          "aria-label": "Integrations",
          options: { $ref: "data.opts" },
          defaultValue: ["ci"],
          defaultOpen: true,
          ...extraProps,
        },
        children: [
          {
            $each: "selected",
            as: "chip",
            node: {
              component: "MultiSelect.Tag",
              props: { index: { $ref: "chipIndex" }, className: "rounded-full" },
              children: [{ $ref: "chip.label" }, { component: "MultiSelect.TagRemove" }],
            },
          },
          {
            component: "MultiSelect.Content",
            children: [
              {
                $cond: "options.0",
                then: {
                  $each: "options",
                  as: "opt",
                  node: {
                    component: "MultiSelect.Item",
                    props: { option: { $ref: "opt" } },
                    children: [
                      { component: "MultiSelect.ItemIndicator" },
                      { $ref: "opt.label" },
                    ],
                  },
                },
                else: { component: "MultiSelect.Empty", children: ["Nothing matched"] },
              },
            ],
          },
        ],
      },
    });

  it("renders a MultiSelect composed by the document", () => {
    const { container } = render(<ViewRenderer spec={composedMultiSelect()} />);

    expect(findRenderDiagnostics(container)).toEqual([]);
    // The chip came from `selected`, the rows from `options` — both the root's.
    expect(container.querySelector(".multiselect-tag")?.textContent).toContain(
      "Continuous integration",
    );
    expect(container.querySelector(".multiselect-tag")).toHaveClass("rounded-full");
    expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual([
      "Continuous integration",
      "Log search",
    ]);
  });

  it("renders the Empty row when the root's own list filters to nothing", async () => {
    render(<ViewRenderer spec={composedMultiSelect()} />);

    await userEvent.type(screen.getByRole("combobox"), "zzz");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Nothing matched")).toBeInTheDocument();
  });

  it("leaves the component's default tree alone when a document passes no children", () => {
    const bare = spec({
      root: {
        component: "MultiSelect",
        props: {
          "aria-label": "Integrations",
          options: OPTIONS,
          defaultValue: ["ci"],
          defaultOpen: true,
        },
      },
    });
    const { container } = render(<ViewRenderer spec={bare} />);

    expect(findRenderDiagnostics(container)).toEqual([]);
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("renders a CommandPalette row per item, composed by the document", () => {
    const palette = spec({
      root: {
        component: "CommandPalette",
        props: {
          id: "launcher",
          open: true,
          searchLabel: "Search actions",
          listLabel: "Actions",
          items: [
            { id: "share", label: "Share", group: "Collaborate", onSelect: null },
            { id: "export", label: "Export", group: "Publish", onSelect: null },
          ],
        },
        children: [
          {
            component: "CommandPalette.Item",
            children: [
              { $ref: "item.label" },
              { component: "Badge", children: [{ $ref: "item.group" }] },
            ],
          },
        ],
      },
    });

    const { container } = render(<ViewRenderer spec={palette} />);

    expect(findRenderDiagnostics(container)).toEqual([]);
    // The function is called once per row, so `item` differs between them.
    expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual([
      "ShareCollaborate",
      "ExportPublish",
    ]);
  });

  it("degrades to a diagnostic when a row addresses an option the root never handed it", () => {
    const wrong = spec({
      root: {
        component: "Stack",
        children: [
          {
            component: "MultiSelect",
            props: { "aria-label": "Integrations", options: OPTIONS, defaultOpen: true },
            children: [
              {
                component: "MultiSelect.Content",
                children: [
                  {
                    component: "MultiSelect.Item",
                    props: { option: { value: "invented", label: "Invented" } },
                    children: ["Invented"],
                  },
                ],
              },
            ],
          },
          { component: "Text", children: ["the rest of the view survives"] },
        ],
      },
    });

    renderThrowing(<ViewRenderer spec={wrong} />);

    // Scanned from the body: the listbox is a floating portal, so a diagnostic
    // inside it is nowhere near the render container.
    expect(findRenderDiagnostics(document.body).join("\n")).toContain(
      "is not in the list MultiSelect handed to children",
    );
    expect(screen.getByText("the rest of the view survives")).toBeInTheDocument();
  });

  it("degrades to a diagnostic when a chip addresses a position outside the selection", () => {
    const wrong = spec({
      root: {
        component: "MultiSelect",
        props: { "aria-label": "Integrations", options: OPTIONS },
        children: [{ component: "MultiSelect.Tag", props: { index: 7 }, children: ["ghost"] }],
      },
    });

    const { container } = renderThrowing(<ViewRenderer spec={wrong} />);

    expect(findRenderDiagnostics(container).join("\n")).toContain(
      "not a position in the selection",
    );
  });

  it("degrades to a diagnostic when a palette row is authored outside the palette", () => {
    const orphan = spec({
      root: {
        component: "Stack",
        children: [
          { component: "CommandPalette.Item", children: ["orphan row"] },
          { component: "Text", children: ["still here"] },
        ],
      },
    });

    const { container } = renderThrowing(<ViewRenderer spec={orphan} />);

    expect(findRenderDiagnostics(container).join("\n")).toContain(
      "must be returned from CommandPalette's children function",
    );
    expect(screen.getByText("still here")).toBeInTheDocument();
  });
});

describe("children a component parses", () => {
  // `Markdown` types `children` as a `string` it parses. A document supplies
  // nodes, so before the renderer resolved them to text the parser was handed
  // React elements and died on the first `.replace` — taking the whole subtree
  // with it, not merely the prose.

  const markdown = (children: ViewNode[], data?: ViewSpec["data"]) =>
    spec({ data, root: { component: "Markdown", children } });

  it("parses a document's string children as markdown source", () => {
    const { container } = render(<ViewRenderer spec={markdown(["## Runbook\n\nDrain first.\n"])} />);

    expect(findRenderDiagnostics(container)).toEqual([]);
    expect(container.querySelector("h2")).toHaveTextContent("Runbook");
    expect(container.querySelector("p")).toHaveTextContent("Drain first.");
  });

  it("concatenates children verbatim, so a $ref interpolates mid-sentence", () => {
    // Joining on a newline instead would split this into two paragraphs — the
    // reason the contract is concatenation and the reference says so.
    const doc = markdown(["Pinned to release **", { $ref: "data.version" }, "**."], {
      version: { type: "static", value: "2026.7.3" },
    });

    const { container } = render(<ViewRenderer spec={doc} />);

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toHaveTextContent("Pinned to release 2026.7.3.");
    expect(paragraphs[0].querySelector("strong")).toHaveTextContent("2026.7.3");
  });

  it("resolves $each and $cond into the source, binding the loop's own names", () => {
    // `$each` emits one node's text per item, so a document concatenates
    // fragments rather than composing them — the same shape the format has
    // everywhere else, minus the wrapper a rendered tree would give it.
    const doc = markdown(
      [
        "# Checks\n\n",
        { $each: "data.checks", as: "check", node: { $ref: "check" } },
        { $cond: "data.degraded", then: "\nDegraded.\n", else: "\nHealthy.\n" },
      ],
      {
        checks: { type: "static", value: ["- drain\n", "- rollout\n"] },
        degraded: { type: "static", value: false },
      },
    );

    const { container } = render(<ViewRenderer spec={doc} />);

    expect(findRenderDiagnostics(container)).toEqual([]);
    expect([...container.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "drain",
      "rollout",
    ]);
    expect(container.querySelector("p")).toHaveTextContent("Healthy.");
  });

  it("still accepts the source as a props.children $ref", () => {
    // The other spelling, and the one a document should use when the whole
    // source is a single fetched value. It must not be clobbered by the
    // children path resolving an empty list to "".
    const doc = spec({
      data: { article: { type: "static", value: "### From props\n" } },
      root: { component: "Markdown", props: { children: { $ref: "data.article" } } },
    });

    const { container } = render(<ViewRenderer spec={doc} />);

    expect(findRenderDiagnostics(container)).toEqual([]);
    expect(container.querySelector("h3")).toHaveTextContent("From props");
  });

  it("keeps the text a composed child sits beside, and warns about the child", () => {
    // A component child has no text to contribute. Dropping it silently is the
    // failure this package is built to avoid, so the validator names it.
    const doc = markdown(["# Kept\n", { component: "Badge", children: ["New"] }]);

    const { container } = render(<ViewRenderer spec={doc} />);

    expect(container.querySelector("h1")).toHaveTextContent("Kept");
    expect(screen.queryByText("New")).not.toBeInTheDocument();
    expect(warningText(doc)).toContain("parses its children as text");
  });

  it("warns when a document gives it no source at all", () => {
    expect(warningText(spec({ root: { component: "Markdown" } }))).toContain(
      "needs its source text",
    );
  });

  it("renders a fenced block as a real CodeBlock, not a <pre> of its own", () => {
    // The reason to reach for this component from a document rather than
    // hand-composing prose: the subset lands as design-system components.
    const { container } = render(
      <ViewRenderer spec={markdown(["```bash\nkubectl drain node/ingest-07\n```\n"])} />,
    );

    expect(findRenderDiagnostics(container)).toEqual([]);
    expect(screen.getByText(/kubectl drain/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });
});
