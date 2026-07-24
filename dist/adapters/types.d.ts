import { ToastVariant } from '@batthewz/response-ui-react-components';
import { SourceBinding } from '../spec/types';
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
export declare const ALLOWED_HTTP_METHODS: readonly string[];
/** Methods that may carry a request body. */
export declare const METHODS_WITH_BODY: readonly string[];
export declare function normalizeMethod(method: unknown): string;
/**
 * Relative paths and same-origin absolute URLs only. Protocol-relative `//host`
 * is rejected — it resolves to a third-party origin.
 */
export declare function defaultAllowUrl(url: string): boolean;
//# sourceMappingURL=types.d.ts.map