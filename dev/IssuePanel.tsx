import { Button, IconButton } from "@batthewz/response-ui-react-components";
import { X } from "lucide-react";

import { type SpecState, verdictDetail, verdictSummary } from "./spec-state";

interface IssuePanelProps {
  state: SpecState;
  open: boolean;
  onClose: () => void;
  /** Puts the caret on the character the JSON parser rejected. */
  onJumpToOffset: (offset: number) => void;
}

export function IssuePanel({ state, open, onClose, onJumpToOffset }: IssuePanelProps) {
  return (
    <div
      className="pg-issues"
      data-open={open}
      data-verdict={state.verdict}
      aria-hidden={open ? undefined : true}
    >
      <div className="pg-issues-head">
        <span className="pg-issues-verdict">{verdictSummary(state)}</span>
        <span className="pg-issues-detail">{verdictDetail(state)}</span>
        <IconButton
          type="button"
          aria-label="Hide validation details"
          onClick={onClose}
          tabIndex={open ? undefined : -1}
        >
          <X size={14} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="pg-issues-body">
        {state.parseError ? (
          state.parseOffset === null ? null : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              tabIndex={open ? undefined : -1}
              onClick={() => onJumpToOffset(state.parseOffset ?? 0)}
            >
              Go to the error
            </Button>
          )
        ) : state.issues.length === 0 ? (
          <p className="pg-issues-none">
            Every node resolves to a registered component, every prop value is one the
            component accepts, and no URL or prop was stripped.
          </p>
        ) : (
          <ul className="pg-issue-list">
            {state.issues.map((issue, i) => (
              <li key={`${issue.path}-${i}`} className="pg-issue" data-severity={issue.severity}>
                <span className="pg-issue-severity">{issue.severity}</span>
                <span className="pg-issue-path">{issue.path}</span>
                <span className="pg-issue-message">{issue.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
