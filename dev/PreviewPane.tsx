import {
  Button,
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
  Tooltip,
} from "@batthewz/response-ui-react-components";
import { ExternalLink, FileJson, FileWarning } from "lucide-react";

import { lucideIcons } from "../src/icons";
import { type ThemeMode, ViewRenderer } from "../src/index";
import type { ViewSpec } from "../src/spec";
import { useDemoAdapters } from "./adapters";
import { type SpecState, verdictDetail, verdictSummary } from "./spec-state";

interface PreviewPaneProps {
  spec: ViewSpec | null;
  state: SpecState;
  /** Identifies the document, so switching example remounts and resets its form state. */
  specKey: string;
  theme: string;
  themeMode: ThemeMode;
  fullPageHref: string;
  /** Hands the editor's exact text to the tab about to open. */
  onOpenFullPage: () => void;
  onShowIssues: () => void;
}

export function PreviewPane({
  spec,
  state,
  specKey,
  theme,
  themeMode,
  fullPageHref,
  onOpenFullPage,
  onShowIssues,
}: PreviewPaneProps) {
  const adapters = useDemoAdapters();

  return (
    <section className="pg-preview" aria-label="Rendered view">
      <header className="pg-pane-head">
        <h2 className="pg-eyebrow">Rendered view</h2>
        {spec && <span className="pg-meta pg-truncate">{spec.title}</span>}
        <div className="pg-pane-actions">
          {/* Only while something renders: the full-page route has no chrome to
              explain a document that does not. */}
          {spec && (
            <Tooltip content="Open exactly this document on its own page, with no demo chrome">
              <Button
                as="a"
                size="sm"
                variant="secondary"
                href={fullPageHref}
                target="_blank"
                rel="noreferrer"
                onClick={onOpenFullPage}
              >
                <ExternalLink size={14} aria-hidden="true" />
                Full page
              </Button>
            </Tooltip>
          )}
        </div>
      </header>

      <div className="pg-stage">
        {spec ? (
          <ViewRenderer
            key={specKey}
            spec={spec}
            theme={theme}
            themeMode={themeMode}
            icons={lucideIcons}
            adapters={adapters}
          />
        ) : (
          <div className="pg-stage-empty">
            <EmptyState>
              <EmptyStateIcon>
                {state.empty ? <FileJson size="1em" /> : <FileWarning size="1em" />}
              </EmptyStateIcon>
              <EmptyStateTitle>{verdictSummary(state)}</EmptyStateTitle>
              <EmptyStateDescription>
                {state.parseError ?? verdictDetail(state)}
              </EmptyStateDescription>
              {!state.empty && (
                <EmptyStateActions>
                  <Button type="button" variant="secondary" onClick={onShowIssues}>
                    Show what to fix
                  </Button>
                </EmptyStateActions>
              )}
            </EmptyState>
          </div>
        )}
      </div>
    </section>
  );
}
