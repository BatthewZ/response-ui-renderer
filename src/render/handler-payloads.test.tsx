import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ViewSpec } from "../spec/types";
import { ViewRenderer } from "./ViewRenderer";

const spec = (partial: Partial<ViewSpec> & Pick<ViewSpec, "root">): ViewSpec => ({
  version: 1,
  title: "T",
  ...partial,
});

const button = (label: string, onClick: unknown) => ({
  component: "Button",
  props: { onClick },
  children: [label],
});

/**
 * Which payload keys are `$ref`-resolved, exercised through a rendered document
 * rather than a hand-built context — these ran only against a faked
 * EventHandlerContext before, and `apiCall` had never executed in a real render
 * at all.
 *
 * The split is a security boundary, not a detail: `endpoint`, `onSuccess` and
 * `onError` stay literal so fetched data cannot redirect a request or choose
 * what runs next. Everything else resolves.
 */
describe("payload keys that resolve", () => {
  it("resolves a $ref form name on submitForm", async () => {
    const toast = vi.fn();
    const user = userEvent.setup();
    render(
      <ViewRenderer
        adapters={{ toast }}
        spec={spec({
          data: { cfg: { type: "static", value: { name: "contact" } } },
          forms: {
            contact: {
              fields: { a: { initialValue: "x" } },
              onSubmit: { action: "showToast", payload: { message: "submitted" } },
            },
          },
          root: button("Send", { action: "submitForm", payload: { form: { $ref: "cfg.name" } } }),
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(toast).toHaveBeenCalledWith("submitted", expect.anything());
  });

  it("resolves a $ref method on apiCall", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    render(
      <ViewRenderer
        adapters={{ fetch: fetchImpl }}
        spec={spec({
          data: { cfg: { type: "static", value: { verb: "POST" } } },
          root: button("Go", {
            action: "apiCall",
            payload: { endpoint: "/api/x", method: { $ref: "cfg.verb" }, body: { a: 1 } },
          }),
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect([url, init.method, init.body]).toEqual(["/api/x", "POST", JSON.stringify({ a: 1 })]);
  });
});

describe("payload keys that stay literal", () => {
  it("refuses a $ref endpoint rather than following fetched data", async () => {
    const fetchImpl = vi.fn();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <ViewRenderer
        adapters={{ fetch: fetchImpl }}
        spec={spec({
          data: { cfg: { type: "static", value: { url: "/api/evil" } } },
          root: button("Go", { action: "apiCall", payload: { endpoint: { $ref: "cfg.url" } } }),
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("refuses a $ref setState key rather than letting data shape state", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(
      <ViewRenderer
        spec={spec({
          data: { cfg: { type: "static", value: { k: "chosen" } } },
          state: { chosen: "before" },
          root: {
            component: "Stack",
            children: [
              button("Set", { action: "setState", payload: { key: { $ref: "cfg.k" }, value: "after" } }),
              { component: "Text", children: [{ $ref: "state.chosen" }] },
            ],
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Set" }));
    expect(screen.getByText("before")).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("apiCall inside a rendered document", () => {
  it("chains onSuccess after a successful request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const toast = vi.fn();
    const user = userEvent.setup();
    render(
      <ViewRenderer
        adapters={{ fetch: fetchImpl, toast }}
        spec={spec({
          root: button("Go", {
            action: "apiCall",
            payload: {
              endpoint: "/api/x",
              onSuccess: { action: "showToast", payload: { message: "saved" } },
            },
          }),
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith("saved", expect.anything()));
  });

  it("blocks a cross-origin endpoint and says so", async () => {
    const fetchImpl = vi.fn();
    const toast = vi.fn();
    const user = userEvent.setup();
    render(
      <ViewRenderer
        adapters={{ fetch: fetchImpl, toast }}
        spec={spec({
          root: button("Go", { action: "apiCall", payload: { endpoint: "https://evil.example/x" } }),
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("blocked"), expect.anything());
  });
});
