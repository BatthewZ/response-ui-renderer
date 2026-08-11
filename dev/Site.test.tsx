import { ToastProvider } from "@batthewz/response-ui-react-components";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { Site } from "./Site";

/**
 * The frame is the one thing on the site that navigates, and what it buys is a
 * top bar that survives the navigation. Both halves are invisible to every other
 * gate: a header moved back inside a page still compiles, still renders, and is
 * only wrong in that it is thrown away and rebuilt on every link — and a frame
 * that grew greedier about which clicks it swallows would break opening a page
 * in a new tab, which nothing else here would notice.
 *
 * `fireEvent` returns false when a listener cancelled the event, so "the frame
 * took this click" and "the browser was left to it" are the same assertion read
 * either way round.
 */
function mount(url: string) {
  window.history.replaceState(null, "", url);
  return render(
    <ToastProvider>
      <Site />
    </ToastProvider>,
  );
}

const bar = (container: HTMLElement) => container.querySelector(".pg-topbar");

describe("Site", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("keeps the same top bar across a page navigation", () => {
    const { container } = mount("/?page=overview");
    const before = bar(container);

    fireEvent.click(screen.getByRole("link", { name: "ViewSpec Reference" }));

    expect(window.location.search).toBe("?page=reference");
    expect(bar(container)).toBe(before);
    expect(screen.getByRole("link", { name: "ViewSpec Reference" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps it across a link in the prose as well", () => {
    const { container } = mount("/?page=overview");
    const before = bar(container);
    const [rewritten] = screen.getAllByRole("link", { name: "VIEWSPEC.md" });

    expect(rewritten).toHaveAttribute("href", "?page=reference");
    expect(fireEvent.click(rewritten)).toBe(false);
    expect(window.location.search).toBe("?page=reference");
    expect(bar(container)).toBe(before);
  });

  it("swaps the page under the bar, and the page's own controls into it", () => {
    // Overview contributes none, so it is the page that proves a control is
    // taken away again rather than merely added to.
    mount("/?page=overview");
    expect(screen.queryByRole("button", { name: "How this works" })).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: "Playground" }));

    expect(screen.getByRole("button", { name: "How this works" })).toBeInTheDocument();
    expect(document.querySelector(".pg-page")).toBeNull();
    expect(document.querySelector(".pg-main")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "ViewSpec Reference" }));

    expect(screen.getByRole("button", { name: "What is a ViewSpec?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "How this works" })).toBeNull();
  });

  it("opens the page's dialog from its own control", () => {
    // The dialog is declared beside the button rather than in the page, so this
    // is the assertion that the pair actually survived being handed to the bar.
    mount("/?page=reference");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "What is a ViewSpec?" }));

    const dialog = screen.getByRole("dialog", { name: "What is a ViewSpec?" });
    expect(dialog).toHaveTextContent("written for a model");

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("puts the reader in the page arrived at, and not on the first paint", () => {
    mount("/?page=overview");
    expect(document.activeElement).toBe(document.body);

    fireEvent.click(screen.getByRole("link", { name: "Playground" }));

    expect(document.activeElement).toBe(document.querySelector(".pg-main"));
  });

  it("follows the back button", async () => {
    mount("/?page=overview");
    fireEvent.click(screen.getByRole("link", { name: "Playground" }));
    expect(screen.getByRole("link", { name: "Playground" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    window.history.back();

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
  });

  it("leaves a modified click to the browser, so a page still opens in a new tab", () => {
    mount("/?page=overview");
    const link = screen.getByRole("link", { name: "ViewSpec Reference" });

    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(fireEvent.click(link, { shiftKey: true })).toBe(true);
    expect(fireEvent.click(link, { button: 1 })).toBe(true);
    expect(window.location.search).toBe("?page=overview");
  });

  it("swaps in the builder, which is an application rather than a document", () => {
    // The frame has three kinds of page under it now — two applications and the
    // prose documents — and the branch that chooses between them is the one
    // thing here that a fourth page would quietly get wrong.
    mount("/?page=overview");
    fireEvent.click(screen.getByRole("link", { name: "Builder" }));

    expect(window.location.search).toBe("?page=builder");
    expect(document.querySelector(".pg-builder")).toBeInTheDocument();
    expect(document.querySelector(".pg-page")).toBeNull();
    expect(screen.getByRole("button", { name: "What this is" })).toBeInTheDocument();

    // Its own registry reaches the palette: the demo page registers `PriceTag`,
    // which the design system has never heard of.
    expect(screen.getByRole("button", { name: /^PriceTag\./ })).toBeInTheDocument();
  });

  it("leaves alone every link that does not name a page", () => {
    mount("/?page=playground");

    // The chrome-free route the corpus is verified through, and an outbound link.
    const fullPage = screen.getByRole("link", { name: "Full page" });
    expect(fullPage.getAttribute("href")).toContain("?view=");
    expect(fireEvent.click(fullPage)).toBe(true);

    const outbound = document.createElement("a");
    outbound.href = "https://example.com/?page=overview";
    document.body.append(outbound);
    expect(fireEvent.click(outbound)).toBe(true);
    outbound.remove();
  });
});
