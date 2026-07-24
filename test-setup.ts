import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom ships no matchMedia, but response-ui's usePrefersReducedMotion reads it
// through useSyncExternalStore — without this, any component honouring reduced
// motion (StatCard, Tabs, Timeline…) throws on mount and the renderer's error
// boundaries mask it as a render failure.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// Also absent from jsdom. Tabs (and anything measuring overflow) constructs one
// on mount, so without a stub those components throw before rendering anything.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

afterEach(() => {
  cleanup();
});
