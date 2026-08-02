import {
  CopyButton,
  formatBytes,
  IconButton,
  Tooltip,
} from "@batthewz/response-ui-react-components";
import { RotateCcw, WandSparkles } from "lucide-react";
import { useRef } from "react";

import type { ViewSpec } from "../src/spec";
import { IssuePanel } from "./IssuePanel";
import type { SpecState } from "./spec-state";

interface DocumentPaneProps {
  examples: [string, ViewSpec][];
  selected: string;
  onSelect: (name: string) => void;
  text: string;
  onChange: (text: string) => void;
  /** The selected example serialized — the thing "Restore" puts back. */
  pristine: string;
  onFormat: () => void;
  state: SpecState;
  issuesOpen: boolean;
  onCloseIssues: () => void;
}

export function DocumentPane({
  examples,
  selected,
  onSelect,
  text,
  onChange,
  pristine,
  onFormat,
  state,
  issuesOpen,
  onCloseIssues,
}: DocumentPaneProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const edited = text !== pristine;
  const description = examples.find(([name]) => name === selected)?.[1].description;
  const lines = text.split("\n").length;

  const jumpToOffset = (offset: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    editor.setSelectionRange(offset, offset + 1);
    // Scrolling by caret is not something a textarea exposes; line height × line
    // index is exact here because the editor never wraps.
    const line = text.slice(0, offset).split("\n").length - 1;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
    if (Number.isFinite(lineHeight)) {
      editor.scrollTop = Math.max(0, (line - 4) * lineHeight);
    }
  };

  return (
    <section className="pg-doc-inner" aria-label="ViewSpec document">
      <header className="pg-pane-head">
        <h2 className="pg-eyebrow">Document</h2>
        <span className="pg-meta">
          {lines} {lines === 1 ? "line" : "lines"} ·{" "}
          {formatBytes(new TextEncoder().encode(text).length)}
          {edited && " · edited"}
        </span>
        <div className="pg-pane-actions">
          <Tooltip content="Re-indent the document">
            <IconButton
              type="button"
              aria-label="Re-indent the document"
              onClick={onFormat}
              disabled={state.parseError !== null}
            >
              <WandSparkles size={16} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Copy the document">
            <CopyButton value={text} />
          </Tooltip>
          <Tooltip content={edited ? "Restore the example" : "Nothing to restore"}>
            <IconButton
              type="button"
              aria-label="Restore the example"
              onClick={() => onChange(pristine)}
              disabled={!edited}
            >
              <RotateCcw size={16} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        </div>
      </header>

      <div className="pg-examples" role="group" aria-label="Example documents">
        {examples.map(([name, doc]) => (
          <button
            key={name}
            type="button"
            aria-pressed={name === selected}
            className="pg-chip"
            onClick={() => onSelect(name)}
          >
            {doc.title}
          </button>
        ))}
      </div>

      {description && <p className="pg-doc-description">{description}</p>}

      <div className="pg-editor">
        <div className="pg-gutter pg-code" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={editorRef}
          className="pg-code pg-textarea"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          spellCheck={false}
          wrap="off"
          aria-label="ViewSpec JSON"
        />
      </div>

      <IssuePanel
        state={state}
        open={issuesOpen}
        onClose={onCloseIssues}
        onJumpToOffset={jumpToOffset}
      />
    </section>
  );
}
