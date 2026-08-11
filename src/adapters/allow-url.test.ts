import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultAllowUrl } from "./types";

/**
 * The renderer's third URL policy, and the one with no validator counterpart:
 * `validateViewSpec` cannot judge an endpoint, because a host is free to widen
 * `allowUrl` to its own API domain. That makes this function the only thing
 * standing between a machine-authored document and a credentialed cross-origin
 * request, so it is tested against what a browser actually resolves rather than
 * against how the string looks.
 */

const BASE = "https://app.test/page";

/** Resolves exactly as the fetch would, so a case cannot claim the wrong thing. */
const resolvedOrigin = (url: string): string => {
  try {
    return new URL(url, BASE).origin;
  } catch {
    return "throw";
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const atBase = () => vi.stubGlobal("location", { href: BASE, origin: "https://app.test" });

describe("defaultAllowUrl allows same-origin", () => {
  it.each(["/ok", "ok", "./ok", "../ok", "", "/a/b?q=1#frag", "https://app.test/x", "//app.test/x"])(
    "%j",
    (url) => {
      atBase();
      expect(defaultAllowUrl(url)).toBe(true);
      expect(resolvedOrigin(url)).toBe("https://app.test");
    },
  );
});

describe("defaultAllowUrl refuses anything that leaves the origin", () => {
  /**
   * Every one of these was ALLOWED before the check resolved the URL. The three
   * single-slash rows are the point: they look relative and are not, because
   * the parser deletes tab/LF/CR and reads `\` as `/`.
   */
  const OFF_ORIGIN = [
    "//evil.test/x",
    "\\\\evil.test\\x",
    "/\\evil.test/x",
    "/\\\\evil.test/x",
    "/\t/evil.test/x",
    "/\n/evil.test/x",
    "/\r/evil.test/x",
    "\\/evil.test/x",
    "https://evil.test/x",
    "http://app.test/x",
    "https://app.test.evil.test/x",
    "https://app.test:8443/x",
  ];

  it.each(OFF_ORIGIN)("%j", (url) => {
    atBase();
    expect(defaultAllowUrl(url)).toBe(false);
  });

  it("every one of those really does reach another origin", () => {
    // Without this the table above could be asserting that safe URLs are
    // refused, which would pass just as well and mean the opposite.
    const stillHere = OFF_ORIGIN.filter((url) => resolvedOrigin(url) === "https://app.test");
    expect(stillHere).toEqual([]);
  });
});

describe("defaultAllowUrl refuses a scheme that is not a fetch", () => {
  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "mailto:a@b.example", "blob:https://evil.test/8f2c"])(
    "%j",
    (url) => {
      atBase();
      expect(defaultAllowUrl(url)).toBe(false);
    },
  );
});

describe("defaultAllowUrl without a location", () => {
  // SSR and workers. A relative URL is same-origin wherever it is resolved, so
  // it stays allowed; nothing carrying an authority can be judged, so nothing
  // carrying one is trusted.
  it.each(["/ok", "ok", "./a/b"])("still allows the relative %j", (url) => {
    expect(defaultAllowUrl(url)).toBe(true);
  });

  it.each(["//evil.test/x", "/\\evil.test/x", "/\t/evil.test/x", "https://evil.test/x", "https://app.test/x"])(
    "refuses %j, which it cannot vouch for",
    (url) => {
      expect(defaultAllowUrl(url)).toBe(false);
    },
  );
});
