"use client";

import { type ReactNode, useCallback, useId, useMemo, useState } from "react";

import type { RendererAdapters } from "../adapters/types";
import { defaultContracts } from "../registry/default-contracts";
import { type IconSet,IconSetProvider } from "../registry/Icon";
import { defaultRegistry } from "../registry/registry";
import type { ComponentRegistry } from "../registry/types";
import type { ComponentContracts } from "../spec/contracts";
import type { FormDef, ViewSpec } from "../spec/types";
import type { EventHandlerContext } from "./event-handler";
import { EMPTY_FORMS, useFormsState } from "./form-state";
import { normalizeIdScope } from "./id-scope";
import { NodeErrorBoundary } from "./NodeErrorBoundary";
import { NodeRenderer } from "./NodeRenderer";
import type { RefContext } from "./resolve-ref";
import { useViewData, ViewDataProvider } from "./ViewDataProvider";
import { type ThemeMode, ViewThemeScope } from "./ViewThemeScope";

const EMPTY_ADAPTERS: RendererAdapters = Object.freeze({});

export type ViewRendererProps = {
  spec: ViewSpec;
  /** Host wiring for navigation, toasts, network and named data sources. */
  adapters?: RendererAdapters;
  /** Defaults to every `@batthewz/response-ui-react-components` export + `Icon`. */
  registry?: ComponentRegistry;
  /**
   * What each registered name means beyond how to construct it: which of its
   * props are bounded to a set, which need translating out of JSON, whether its
   * `children` is a function it calls or text it parses.
   *
   * Defaults to the built-in library's. Extend a registry and you almost always
   * want to extend this with it — `extendContracts(defaultContracts, yours)` —
   * or your component renders with none of the translations the library's get.
   */
  contracts?: ComponentContracts;
  /** Name → component map for `Icon` nodes and string-valued `icon` props. */
  icons?: IconSet;
  /** Overrides `spec.theme` — for a host-level theme picker. */
  theme?: string;
  /** Where `data-theme` is written. See ThemeMode; `"root"` by default. */
  themeMode?: ThemeMode;
  /** Class on the view's wrapper element. */
  className?: string;
  /** Hides the built-in loading bar and data-error banner. */
  hideDiagnostics?: boolean;
  /**
   * Namespaces the DOM ids a document supplies, so several documents can share
   * a page without their radio groups merging or their labels retargeting.
   *
   * `true` derives a unique prefix per instance — enough for a host composing a
   * list of documents. Pass a string when an id has to be constructible from
   * outside: a deep link, a test, an `aria-labelledby` pointing into the view.
   *
   * Omitted, ids pass through verbatim, which is what a single mounted document
   * wants. It scopes `id`, `htmlFor`, `name`, `list`, `form` and the ARIA id
   * references — never `$field` paths, form names, `$ref`/`state` keys, or the
   * `dialogId` an `openDialog` action names.
   */
  idScope?: boolean | string;
};

function DataDiagnostics({ children }: { children: ReactNode }) {
  const { dataErrors, dataLoading } = useViewData();

  const message = useMemo(() => {
    if (dataErrors.length === 0) return null;
    return dataErrors.some((error) => error.includes("requires authentication"))
      ? "This view uses live data that requires sign-in. Some content may not be shown."
      : "Some data sources failed to load. Some content may not be shown.";
  }, [dataErrors]);

  return (
    <>
      {dataLoading && <div className="rui-view-loading" role="progressbar" aria-label="Loading data" />}
      {message && (
        <div className="rui-view-banner" role="status">
          {message}
        </div>
      )}
      {children}
    </>
  );
}

/** Reads the live context so handlers see current values, not mount-time ones. */
function ViewBody({
  spec,
  registry,
  contracts,
  adapters,
  formDefs,
  dialogs,
  setState,
  hideDiagnostics,
}: {
  spec: ViewSpec;
  registry: ComponentRegistry;
  contracts: ComponentContracts;
  adapters: RendererAdapters;
  formDefs: Readonly<Record<string, FormDef>>;
  dialogs: { open: (id: string) => void; close: (id: string) => void };
  setState: (key: string, value: unknown) => void;
  hideDiagnostics: boolean;
}) {
  const view = useViewData();

  const eventContext = useMemo<EventHandlerContext>(() => {
    const refContext: RefContext = {
      data: view.data,
      forms: Object.fromEntries(
        Object.entries(view.forms).map(([name, form]) => [
          name,
          { values: form.values, errors: form.errors },
        ]),
      ),
      vars: view.vars,
    };
    return { adapters, formStates: view.forms, formDefs, dialogs, setState, refContext };
  }, [adapters, view.data, view.forms, view.vars, formDefs, dialogs, setState]);

  const tree = (
    <NodeRenderer
      node={spec.root}
      registry={registry}
      contracts={contracts}
      eventContext={eventContext}
    />
  );

  return hideDiagnostics ? tree : <DataDiagnostics>{tree}</DataDiagnostics>;
}

/**
 * Renders a ViewSpec document as response-ui components.
 *
 * Mountable anywhere: it needs no router, no ToastProvider and no server. Those
 * are supplied — or not — through `adapters`.
 */
export function ViewRenderer({
  spec,
  adapters = EMPTY_ADAPTERS,
  registry = defaultRegistry,
  contracts = defaultContracts,
  icons,
  theme,
  themeMode = "root",
  className,
  hideDiagnostics = false,
  idScope,
}: ViewRendererProps) {
  const generatedIdScope = useId();
  const resolvedIdScope = normalizeIdScope(idScope, generatedIdScope);

  const formDefs = spec.forms ?? EMPTY_FORMS;
  const formStates = useFormsState(formDefs);

  const [dialogStates, setDialogStates] = useState<Record<string, boolean>>({});
  const [viewState, setViewState] = useState<Record<string, unknown>>(spec.state ?? {});

  // A new document is a new view: stale dialog and state values must not leak
  // across it. Reset during render so the first paint is already correct.
  const [prevSpec, setPrevSpec] = useState(spec);
  if (prevSpec !== spec) {
    setPrevSpec(spec);
    setDialogStates({});
    setViewState(spec.state ?? {});
  }

  const dialogs = useMemo(
    () => ({
      open: (id: string) => setDialogStates((prev) => ({ ...prev, [id]: true })),
      close: (id: string) => setDialogStates((prev) => ({ ...prev, [id]: false })),
    }),
    [],
  );

  const setState = useCallback((key: string, value: unknown) => {
    setViewState((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <ViewThemeScope
      theme={theme ?? spec.theme}
      themeOverrides={spec.themeOverrides}
      mode={themeMode}
      className={className}
    >
      <IconSetProvider icons={icons}>
        <ViewDataProvider
          dataBindings={spec.data}
          adapters={adapters}
          forms={formStates}
          viewState={viewState}
          dialogStates={dialogStates}
          idScope={resolvedIdScope}
        >
          <NodeErrorBoundary label={spec.title}>
            <ViewBody
              spec={spec}
              registry={registry}
              contracts={contracts}
              adapters={adapters}
              formDefs={formDefs}
              dialogs={dialogs}
              setState={setState}
              hideDiagnostics={hideDiagnostics}
            />
          </NodeErrorBoundary>
        </ViewDataProvider>
      </IconSetProvider>
    </ViewThemeScope>
  );
}
