"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";

import type { RendererAdapters } from "../adapters/types";
import { type IconSet,IconSetProvider } from "../registry/Icon";
import { defaultRegistry } from "../registry/registry";
import type { ComponentRegistry } from "../registry/types";
import type { FormDef, ViewSpec } from "../spec/types";
import type { EventHandlerContext } from "./event-handler";
import { EMPTY_FORMS, useFormsState } from "./form-state";
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
  adapters,
  formDefs,
  dialogs,
  setState,
  hideDiagnostics,
}: {
  spec: ViewSpec;
  registry: ComponentRegistry;
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

  const tree = <NodeRenderer node={spec.root} registry={registry} eventContext={eventContext} />;

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
  icons,
  theme,
  themeMode = "root",
  className,
  hideDiagnostics = false,
}: ViewRendererProps) {
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
        >
          <NodeErrorBoundary label={spec.title}>
            <ViewBody
              spec={spec}
              registry={registry}
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
