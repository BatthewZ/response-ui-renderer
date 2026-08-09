import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cloneElement, type ElementType, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { defaultContracts } from "../registry/default-contracts";
import { defaultRegistry } from "../registry/registry";
import { extendRegistry } from "../registry/types";
import { type ComponentContracts, extendContracts } from "../spec/contracts";
import type { ViewSpec } from "../spec/types";
import { ViewRenderer } from "./ViewRenderer";

/**
 * A host's component gets the same treatment the library's do, or it does not.
 *
 * Every rule the renderer applies used to be keyed on a name in a frozen table
 * that only ever listed `@batthewz/response-ui-react-components`, so a
 * registered component rendered with none of them and nothing said so. Each
 * case below pairs the contract with the same document rendered *without* it —
 * a coercion that fires unconditionally would pass half of these.
 */

/** Reports exactly what it was handed, so a coercion is visible in the DOM. */
const Probe = ({ label = "probe", ...props }: Record<string, unknown> & { label?: string }) => (
  <div data-testid={label}>
    {Object.entries(props)
      .map(([key, value]) => `${key}=${describe_(value)}`)
      .sort()
      .join(" ")}
  </div>
);

function describe_(value: unknown): string {
  if (value instanceof Date) return `Date(${value.getFullYear()}-${value.getMonth() + 1}-${value.getDate()})`;
  if (typeof value === "function") return `fn(${String(value({ id: "r7" }, 3))})`;
  return JSON.stringify(value) ?? String(value);
}

const Prose = ({ children }: { children?: ReactNode }) => (
  <p data-testid="prose">{typeof children === "string" ? `string:${children}` : "not-a-string"}</p>
);

const Rows = ({ children, positional }: { children?: unknown; positional?: boolean }) => (
  <div data-testid="rows">
    {typeof children === "function"
      ? positional
        ? (children as (row: unknown, index: number) => ReactNode)({ name: "Ada" }, 7)
        : (children as (args: unknown) => ReactNode)({ row: { name: "Ada" }, index: 0 })
      : "not-a-function"}
  </div>
);

/** Injects a prop by cloning, the way `Tooltip` and the `asChild` triggers do. */
const Cloner = ({ children }: { children?: ReactNode }) => (
  <div data-testid="cloner">
    {isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, { injected: true })
      : children}
  </div>
);

const Sheet = ({ open, children }: { open?: boolean; children?: ReactNode }) => (
  <div data-testid="sheet">{open ? children : "closed"}</div>
);

const Badged = ({ icon }: { icon?: ElementType }) => (
  <span data-testid="badged">{typeof icon === "function" ? "component" : "element"}</span>
);

const Field = ({ name }: { name?: string }) => <input aria-label="field" name={name} />;

const registry = extendRegistry(defaultRegistry, {
  Probe,
  Prose,
  Rows,
  Cloner,
  Sheet,
  Badged,
  HostField: Field,
});

const contracts: ComponentContracts = extendContracts(defaultContracts, {
  Probe: { coercions: { since: "isoDate", rowKey: "keyAccessor" } },
  Prose: { textChildren: "one string" },
  Rows: { functionChildren: { args: ["row", "index"], note: "once per row" } },
  Cloner: { childInspection: "always" },
  Sheet: { dialog: true },
  Badged: { iconComponentProps: ["icon"] },
  HostField: { nameProp: "dom" },
});

const view = (root: unknown, extra: Partial<ViewSpec> = {}): ViewSpec =>
  ({ version: 1, title: "custom", ...extra, root }) as ViewSpec;

/** Renders once with the contracts and once without, for the same document. */
function bothWays(spec: ViewSpec, props: Record<string, unknown> = {}) {
  const withContracts = render(
    <ViewRenderer spec={spec} registry={registry} contracts={contracts} {...props} />,
  );
  const declared = document.body.innerHTML;
  withContracts.unmount();

  const without = render(<ViewRenderer spec={spec} registry={registry} {...props} />);
  const undeclared = document.body.innerHTML;
  without.unmount();

  return { declared, undeclared };
}

describe("a registered component's contract", () => {
  it("coerces the props it names, and only for the component that names them", () => {
    const spec = view({
      component: "Probe",
      props: { since: "2026-06-14", rowKey: "id", other: "2026-06-14" },
    });
    const { declared, undeclared } = bothWays(spec);

    expect(declared).toContain("since=Date(2026-6-14)");
    expect(declared).toContain("rowKey=fn(r7)");
    // A coercion is keyed on a prop name; an undeclared prop keeps its string.
    expect(declared).toContain('other="2026-06-14"');

    expect(undeclared).toContain('since="2026-06-14"');
    expect(undeclared).toContain('rowKey="id"');
  });

  it("hands a text-children root one string instead of elements", () => {
    const spec = view({ component: "Prose", children: ["one ", "two"] });
    const { declared, undeclared } = bothWays(spec);
    expect(declared).toContain("string:one two");
    expect(undeclared).toContain("not-a-string");
  });

  it("hands a function-children root a function, with its arguments as refs", () => {
    const spec = view({
      component: "Rows",
      children: [{ component: "Probe", props: { label: "row", who: { $ref: "row.name" } } }],
    });
    const { declared, undeclared } = bothWays(spec);
    expect(declared).toContain('who="Ada"');
    expect(undeclared).toContain("not-a-function");
  });

  it("lets an action open a dialog the host registered", async () => {
    const spec = view({
      component: "Stack",
      children: [
        {
          component: "Button",
          props: { onClick: { action: "openDialog", payload: { dialogId: "sheet" } } },
          children: ["Open"],
        },
        { component: "Sheet", props: { id: "sheet" }, children: ["inside"] },
      ],
    });

    render(<ViewRenderer spec={spec} registry={registry} contracts={contracts} />);
    expect(screen.getByTestId("sheet")).toHaveTextContent("closed");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByTestId("sheet")).toHaveTextContent("inside");
  });

  it("leaves a dialog the contracts do not name unreachable by an action", async () => {
    const spec = view({
      component: "Stack",
      children: [
        {
          component: "Button",
          props: { onClick: { action: "openDialog", payload: { dialogId: "sheet" } } },
          children: ["Open"],
        },
        { component: "Sheet", props: { id: "sheet" }, children: ["inside"] },
      ],
    });

    render(<ViewRenderer spec={spec} registry={registry} />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByTestId("sheet")).toHaveTextContent("closed");
  });

  it("gives a component-typed icon slot a component, not an element", () => {
    // Handing an element to a slot the component invokes as `<Icon />` throws
    // inside the component rather than degrading, so only the contract can
    // tell the two apart — the prop name is identical either way.
    const spec = view({ component: "Badged", props: { icon: "Check" } });
    const { declared, undeclared } = bothWays(spec);
    expect(declared).toContain(">component<");
    expect(undeclared).toContain(">element<");
  });

  it("binds a positional render prop from the names the contract declares", () => {
    // The library's own roots take one options object, which is spread whole.
    // A render prop taking positional arguments carries no names at all, so
    // `args` is the only thing that can supply them — and until it was read,
    // a host could declare them, watch the component render, and get a subtree
    // where every reference silently resolved to nothing.
    const spec = view({
      component: "Rows",
      props: { positional: true },
      children: [
        {
          component: "Probe",
          props: { label: "row", who: { $ref: "row.name" }, i: { $ref: "index" } },
        },
      ],
    });
    const { declared } = bothWays(spec);
    expect(declared).toContain('who="Ada"');
    expect(declared).toContain("i=7");
  });

  it("keeps the child's own error boundary out of a child-inspecting parent", () => {
    // A parent that clones its children cannot see past a boundary, so the
    // renderer drops the per-child one — and only the contract can say which
    // parents those are.
    const spec = view({
      component: "Cloner",
      children: [{ component: "Probe", props: { label: "cloned" } }],
    });
    const { declared, undeclared } = bothWays(spec);
    expect(declared).toContain("injected=true");
    expect(undeclared).not.toContain("injected=true");
  });

  it("scopes a DOM `name` only where the contract says it is one", () => {
    const spec = view({ component: "HostField", props: { name: "email" } });
    const { declared, undeclared } = bothWays(spec, { idScope: "turn-7" });
    expect(declared).toContain('name="turn-7-email"');
    // The documented default: a registered component's `name` is never
    // rewritten behind the host's back.
    expect(undeclared).toContain('name="email"');
  });
});

describe("extending the registry without extending the contracts", () => {
  it("keeps every built-in component's own contract intact", () => {
    // The trap of a bare `contracts` object: passing one that names only the
    // host's components silently strips the library's. Extending is the
    // documented act, and this is what it buys.
    const spec = view({
      component: "Stack",
      children: [
        { component: "Calendar", props: { defaultValue: "2026-06-14" } },
        { component: "Probe", props: { since: "2026-06-14" } },
      ],
    });
    const onlyHost: ComponentContracts = { Probe: { coercions: { since: "isoDate" } } };

    render(<ViewRenderer spec={spec} registry={registry} contracts={onlyHost} />);
    // `Calendar` lost its date coercion, so the string never became a Date.
    expect(screen.getByTestId("probe")).toHaveTextContent("since=Date(2026-6-14)");
    expect(screen.queryByRole("gridcell", { selected: true })).toBeNull();
  });
});

describe("NodeRenderer inherits contracts through every nesting form", () => {
  it("reaches a node behind $cond and $each", () => {
    // Contracts descend by prop, not by context, so every recursive call site
    // has to pass them on. Missing one leaves a whole branch of the document
    // rendering as if the host had registered nothing.
    render(
      <ViewRenderer
        spec={view(
          {
            component: "Stack",
            children: [
              {
                $cond: "data.flag",
                then: { component: "Probe", props: { label: "cond", since: "2026-01-02" } },
              },
              {
                $each: "data.rows",
                as: "r",
                node: { component: "Probe", props: { label: "each", since: { $ref: "r" } } },
              },
            ],
          },
          {
            data: {
              flag: { type: "static", value: true },
              rows: { type: "static", value: ["2026-03-04"] },
            },
          },
        )}
        registry={registry}
        contracts={contracts}
      />,
    );

    expect(screen.getByTestId("cond")).toHaveTextContent("since=Date(2026-1-2)");
    expect(screen.getByTestId("each")).toHaveTextContent("since=Date(2026-3-4)");
  });
});
