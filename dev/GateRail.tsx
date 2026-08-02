import { IconButton, Kbd, Tooltip } from "@batthewz/response-ui-react-components";
import {
  Check,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  TriangleAlert,
  X,
} from "lucide-react";

import { type SpecState, type Verdict, verdictDetail, verdictSummary } from "./spec-state";

// Bare glyphs: the node is already a ring, and a ringed icon inside it reads as
// two circles rather than one state.
const gateIcons: Record<Verdict, LucideIcon> = {
  clean: Check,
  warning: TriangleAlert,
  error: X,
};

interface GateRailProps {
  state: SpecState;
  documentOpen: boolean;
  onToggleDocument: () => void;
  issuesOpen: boolean;
  onToggleIssues: () => void;
}

/**
 * The divider between the document and the render, made load-bearing: validation
 * is literally the gate between the two, so the verdict lives on the seam rather
 * than in a card competing with either side.
 */
export function GateRail({
  state,
  documentOpen,
  onToggleDocument,
  issuesOpen,
  onToggleIssues,
}: GateRailProps) {
  const GateIcon = gateIcons[state.verdict];
  const count = state.issues.length;
  const PanelIcon = documentOpen ? PanelLeftClose : PanelLeftOpen;

  return (
    <div className="pg-rail" data-verdict={state.verdict}>
      <Tooltip
        content={
          <span className="flex items-center gap-r6">
            {documentOpen ? "Hide the document" : "Show the document"}
            <Kbd>⌘B</Kbd>
          </span>
        }
      >
        <IconButton
          type="button"
          aria-label={documentOpen ? "Hide the document" : "Show the document"}
          aria-expanded={documentOpen}
          onClick={onToggleDocument}
          className="pg-rail-control"
        >
          <PanelIcon size={16} aria-hidden="true" />
        </IconButton>
      </Tooltip>

      <div className="pg-rail-gate">
        <Tooltip
          content={
            <span className="block max-w-[16rem]">
              <strong>{verdictSummary(state)}</strong> — {verdictDetail(state)}
            </span>
          }
        >
          <button
            type="button"
            // Remounting on a verdict change replays the entry animation, so the
            // gate reacts visibly the moment the document stops conforming.
            key={state.verdict}
            onClick={onToggleIssues}
            aria-expanded={issuesOpen}
            data-verdict={state.verdict}
            className="pg-gate"
          >
            <GateIcon size={18} aria-hidden="true" />
            <span className="sr-only">
              {verdictSummary(state)}. {issuesOpen ? "Hide" : "Show"} details.
            </span>
            {count > 0 && (
              <span aria-hidden="true" className="pg-gate-count">
                {count}
              </span>
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
