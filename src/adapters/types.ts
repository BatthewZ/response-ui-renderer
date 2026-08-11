import type { ToastVariant } from "@batthewz/response-ui-react-components";

import type { SourceBinding } from "../spec/types";

export type ToastOptions = {
  variant?: ToastVariant;
  title?: string;
  duration?: number;
};

/**
 * Everything the renderer needs from its host.
 *
 * The design system's stated position is "headless + injection everywhere"
 * (RouterAdapterProvider, RequireAuth, useForm). This mirrors it: no router,
 * no server contract and no auth model is baked into the wire format, so the
 * same document renders under react-router, Next, TanStack Router or none.
 */
export type RendererAdapters = {
  /** Handles the `navigate` action. No-ops with a console warning if absent. */
  navigate?: (path: string) => void;

  /**
   * Handles the `showToast` action, and reports request failures.
   *
   * Injected rather than read from the library's `useToast()` internally,
   * because that hook throws without a `ToastProvider` — calling it would make
   * the renderer unmountable anywhere a provider is absent. Pass
   * `useToast().toast` from a component that does sit under one.
   *
   * Without it, `showToast` warns to the console.
   */
  toast?: (message: string, options?: ToastOptions) => void;

  /**
   * Performs `api` data bindings and the `apiCall` action. Defaults to
   * `globalThis.fetch`. Override to route through a proxy, attach credentials,
   * or rewrite URLs — the renderer never rewrites them itself.
   */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;

  /**
   * Resolves a `source` data binding. This is the extension point for
   * host-specific data access (credentialed proxies, RPC, in-memory stores).
   * Without it, `source` bindings report a diagnostic instead of loading.
   */
  resolveSource?: (binding: SourceBinding, signal: AbortSignal) => Promise<unknown>;

  /**
   * Gate for every URL the document asks the renderer to request.
   * Defaults to `defaultAllowUrl` (relative or same-origin), because documents
   * are typically machine-generated and therefore untrusted.
   */
  allowUrl?: (url: string) => boolean;
};

/** HTTP methods the renderer will issue. */
export const ALLOWED_HTTP_METHODS: readonly string[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

/** Methods that may carry a request body. */
export const METHODS_WITH_BODY: readonly string[] = ["POST", "PUT", "PATCH"];

export function normalizeMethod(method: unknown): string {
  if (typeof method !== "string") return "GET";
  const upper = method.toUpperCase();
  return ALLOWED_HTTP_METHODS.includes(upper) ? upper : "GET";
}

/**
 * Where a relative URL is resolved against when there is no `location` — during
 * SSR, or in a worker. A reserved TLD (RFC 2606), so it can never be a real
 * origin a document might name and coincidentally match.
 */
const NO_LOCATION_BASE = "https://ssr.invalid/";

/**
 * Relative paths and same-origin absolute URLs only.
 *
 * Resolves and compares the origin rather than testing how the string starts.
 * The leading characters are not what the browser reads: it strips tab, LF and
 * CR *before* parsing, and treats `\` as `/` for http(s), so all three of
 * `/\evil.test/x`, `/\t/evil.test/x` and `/\n/evil.test/x` begin with a single
 * slash, passed a `startsWith("//")` guard, and fetched from a third party with
 * the user's credentials. Widening that guard to cover backslashes would still
 * have missed the two separated by whitespace — the only test that sees what
 * will actually be requested is to resolve it the way the browser will.
 */
export function defaultAllowUrl(url: string): boolean {
  const base =
    typeof globalThis.location === "undefined" ? NO_LOCATION_BASE : globalThis.location.href;
  try {
    // A non-special scheme (`javascript:`, `data:`, `mailto:`) resolves to the
    // opaque origin `"null"`, which matches no base and so is refused here too.
    return new URL(url, base).origin === new URL(base).origin;
  } catch {
    return false;
  }
}
