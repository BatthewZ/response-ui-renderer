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
 * Relative paths and same-origin absolute URLs only. Protocol-relative `//host`
 * is rejected — it resolves to a third-party origin.
 */
export function defaultAllowUrl(url: string): boolean {
  if (url.startsWith("//")) return false;
  if (url.startsWith("/")) return true;
  if (typeof globalThis.location === "undefined") return false;
  try {
    return new URL(url, globalThis.location.href).origin === globalThis.location.origin;
  } catch {
    return false;
  }
}
