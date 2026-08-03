import { type Ref, useCallback, useEffect, useMemo, useState } from "react";

import { exampleSpecs } from "../src/examples";
import type { ThemeMode } from "../src/index";
import type { ViewSpec } from "../src/spec";
import { DocumentPane } from "./DocumentPane";
import { EDITOR_HANDOFF_KEY, EDITOR_VIEW } from "./full-page";
import { GateRail } from "./GateRail";
import { PreviewPane } from "./PreviewPane";
import { readSpec } from "./spec-state";

const EXAMPLES: [string, ViewSpec][] = Object.entries(exampleSpecs) as [string, ViewSpec][];
const FIRST_EXAMPLE = EXAMPLES[0][0];

const serialize = (name: string) =>
  JSON.stringify(exampleSpecs[name as keyof typeof exampleSpecs], null, 2);

interface PlaygroundProps {
  /** The theme is the frame's, not this page's — see `SiteHeader`. */
  theme: string;
  themeMode: ThemeMode;
  /** The frame focuses this on arrival — see `Site`. */
  ref?: Ref<HTMLElement>;
}

export function Playground({ theme, themeMode, ref }: PlaygroundProps) {
  const [selected, setSelected] = useState(FIRST_EXAMPLE);
  const [text, setText] = useState(() => serialize(FIRST_EXAMPLE));
  const [documentOpen, setDocumentOpen] = useState(true);
  const [issuesOpen, setIssuesOpen] = useState(false);

  const state = useMemo(() => readSpec(text), [text]);
  const pristine = useMemo(() => serialize(selected), [selected]);

  const selectExample = (name: string) => {
    setSelected(name);
    setText(serialize(name));
  };

  const format = useCallback(() => {
    setText((current) => {
      try {
        return JSON.stringify(JSON.parse(current), null, 2);
      } catch {
        return current;
      }
    });
  }, []);

  const showIssues = useCallback(() => {
    setDocumentOpen(true);
    setIssuesOpen(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setDocumentOpen((open) => !open);
      } else if (e.key === "Enter") {
        e.preventDefault();
        format();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [format]);

  const fullPageHref = `?view=${EDITOR_VIEW}&theme=${encodeURIComponent(theme)}&mode=${themeMode}`;

  return (
    <main className="pg-main" ref={ref} tabIndex={-1}>
      <div className="pg-doc" data-open={documentOpen}>
        <DocumentPane
          examples={EXAMPLES}
          selected={selected}
          onSelect={selectExample}
          text={text}
          onChange={setText}
          pristine={pristine}
          onFormat={format}
          state={state}
          issuesOpen={issuesOpen}
          onCloseIssues={() => setIssuesOpen(false)}
        />
      </div>

      <GateRail
        state={state}
        documentOpen={documentOpen}
        onToggleDocument={() => setDocumentOpen((open) => !open)}
        issuesOpen={issuesOpen}
        onToggleIssues={() => (issuesOpen ? setIssuesOpen(false) : showIssues())}
      />

      <PreviewPane
        spec={state.spec}
        state={state}
        specKey={selected}
        theme={theme}
        themeMode={themeMode}
        fullPageHref={fullPageHref}
        onOpenFullPage={() => localStorage.setItem(EDITOR_HANDOFF_KEY, text)}
        onShowIssues={showIssues}
      />
    </main>
  );
}
