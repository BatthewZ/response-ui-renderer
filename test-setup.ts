import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom ships no matchMedia, but response-ui's usePrefersReducedMotion reads it
// through useSyncExternalStore — without this, any component honouring reduced
// motion (StatCard, Tabs, Timeline…) throws on mount and the renderer's error
// boundaries mask it as a render failure.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// Also absent from jsdom. Tabs (and anything measuring overflow) constructs one
// on mount, so without a stub those components throw before rendering anything.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Also absent from jsdom. Any component that keeps an active option in view
// (CommandPalette, Combobox, MultiSelect) calls it from an effect on mount.
if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* jsdom has no layout to scroll */
  };
}

// jsdom implements <dialog> as an element but ships none of its methods, and
// Dialog/Drawer/CommandPalette all call showModal() from a mount effect. Without
// these, opening one throws and the renderer's error boundary reports it as a
// render failure — so nothing could assert a dialog ever opens.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    show?: () => void;
    close?: (returnValue?: string) => void;
  };
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (typeof proto.show !== "function") {
    proto.show = function show(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function close(this: HTMLDialogElement, returnValue?: string) {
      this.open = false;
      if (returnValue !== undefined) this.returnValue = returnValue;
      this.dispatchEvent(new Event("close"));
    };
  }
}

afterEach(() => {
  cleanup();
});
