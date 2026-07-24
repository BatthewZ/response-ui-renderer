"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  defaultAllowUrl,
  METHODS_WITH_BODY,
  normalizeMethod,
  type RendererAdapters,
} from "../adapters/types";
import type { DataBinding } from "../spec/types";
import type { FormState } from "./form-state";

export type ViewContext = {
  data: Record<string, unknown>;
  forms: Record<string, FormState>;
  /** `$each` aliases plus `state` from the `setState` action. */
  vars: Record<string, unknown>;
  dialogStates: Record<string, boolean>;
  dataErrors: string[];
  dataLoading: boolean;
};

const EMPTY_CONTEXT: ViewContext = {
  data: {},
  forms: {},
  vars: {},
  dialogStates: {},
  dataErrors: [],
  dataLoading: false,
};

const ViewDataContext = createContext<ViewContext>(EMPTY_CONTEXT);

export function useViewData(): ViewContext {
  return useContext(ViewDataContext);
}

type ViewDataProviderProps = {
  dataBindings?: Record<string, DataBinding>;
  adapters: RendererAdapters;
  forms: Record<string, FormState>;
  viewState: Record<string, unknown>;
  dialogStates: Record<string, boolean>;
  children: ReactNode;
};

const isAsync = (binding: DataBinding): boolean =>
  binding.type === "api" || binding.type === "source";

function asyncKeysOf(bindings: Record<string, DataBinding> | undefined): Set<string> {
  const keys = new Set<string>();
  if (!bindings) return keys;
  for (const [key, binding] of Object.entries(bindings)) {
    if (binding && isAsync(binding)) keys.add(key);
  }
  return keys;
}

/** Loads one binding. Rejects with a message already fit for display. */
async function loadBinding(
  key: string,
  binding: DataBinding,
  adapters: RendererAdapters,
  signal: AbortSignal,
): Promise<unknown> {
  if (binding.type === "source") {
    if (!adapters.resolveSource) {
      throw new Error(
        `Data source "${key}" needs a resolveSource adapter for source "${binding.source}"`,
      );
    }
    return adapters.resolveSource(binding, signal);
  }

  if (binding.type !== "api") {
    throw new Error(`Data source "${key}" has an unsupported binding type`);
  }

  const allow = adapters.allowUrl ?? defaultAllowUrl;
  if (!allow(binding.endpoint)) {
    throw new Error(`Data source "${key}" was blocked: endpoint not allowed`);
  }

  const method = normalizeMethod(binding.method);
  const init: RequestInit = { method, signal };
  if (binding.body !== undefined && METHODS_WITH_BODY.includes(method)) {
    init.body = JSON.stringify(binding.body);
  }
  if (binding.headers) {
    init.headers = { ...binding.headers };
  }
  if (init.body && !("Content-Type" in (init.headers ?? {}))) {
    init.headers = { ...(init.headers as Record<string, string>), "Content-Type": "application/json" };
  }

  const doFetch = adapters.fetch ?? ((url: string, opts: RequestInit) => fetch(url, opts));
  const res = await doFetch(binding.endpoint, init);
  if (!res.ok) {
    throw new Error(
      res.status === 401 || res.status === 403
        ? `Data source "${key}" requires authentication`
        : `Data source "${key}" failed to load (${res.status})`,
    );
  }
  return (await res.json()) as unknown;
}

export function ViewDataProvider({
  dataBindings,
  adapters,
  forms,
  viewState,
  dialogStates,
  children,
}: ViewDataProviderProps) {
  const staticData = useMemo(() => {
    const entries: Record<string, unknown> = {};
    if (!dataBindings) return entries;
    for (const [key, binding] of Object.entries(dataBindings)) {
      if (binding?.type === "static") entries[key] = binding.value;
    }
    return entries;
  }, [dataBindings]);

  const [asyncData, setAsyncData] = useState<Record<string, unknown>>({});
  const [dataErrors, setDataErrors] = useState<string[]>([]);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => asyncKeysOf(dataBindings));

  // Drop results from the previous document during render, so a new spec never
  // paints with the old spec's rows.
  const [prevBindings, setPrevBindings] = useState(dataBindings);
  if (prevBindings !== dataBindings) {
    setPrevBindings(dataBindings);
    setAsyncData({});
    setDataErrors([]);
    setPendingKeys(asyncKeysOf(dataBindings));
  }

  useEffect(() => {
    if (!dataBindings) return;
    const controller = new AbortController();

    for (const [key, binding] of Object.entries(dataBindings)) {
      if (!binding || !isAsync(binding)) continue;

      loadBinding(key, binding, adapters, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setAsyncData((prev) => ({ ...prev, [key]: result }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          const message =
            err instanceof Error ? err.message : `Data source "${key}" failed to load`;
          setDataErrors((prev) => (prev.includes(message) ? prev : [...prev, message]));
        })
        .finally(() => {
          if (controller.signal.aborted) return;
          setPendingKeys((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        });
    }

    return () => controller.abort();
  }, [dataBindings, adapters]);

  const data = useMemo(() => ({ ...staticData, ...asyncData }), [staticData, asyncData]);

  const context = useMemo<ViewContext>(
    () => ({
      data,
      forms,
      vars: { state: viewState },
      dialogStates,
      dataErrors,
      dataLoading: pendingKeys.size > 0,
    }),
    [data, forms, viewState, dialogStates, dataErrors, pendingKeys],
  );

  return <ViewDataContext.Provider value={context}>{children}</ViewDataContext.Provider>;
}

/** Layers `$each` iteration variables onto the surrounding context. */
export function ViewContextExtender({
  vars,
  children,
}: {
  vars: Record<string, unknown>;
  children: ReactNode;
}) {
  const parent = useViewData();
  const extended = useMemo<ViewContext>(
    () => ({ ...parent, vars: { ...parent.vars, ...vars } }),
    [parent, vars],
  );
  return <ViewDataContext.Provider value={extended}>{children}</ViewDataContext.Provider>;
}
