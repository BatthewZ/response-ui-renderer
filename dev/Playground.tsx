import { Badge, Button, Tooltip } from "@batthewz/response-ui-react-components";
import { CircleHelp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { exampleSpecs } from "../src/examples";
import { defaultRegistry, listComponentNames } from "../src/index";
import type { ViewSpec } from "../src/spec";
import { AboutDialog } from "./AboutDialog";
import { DocumentPane } from "./DocumentPane";
import { EDITOR_HANDOFF_KEY, EDITOR_VIEW } from "./full-page";
import { GateRail } from "./GateRail";
import { PreviewPane } from "./PreviewPane";
import { PLAYGROUND_PAGE } from "./site";
import { useSiteTheme } from "./site-theme";
import { SiteHeader } from "./SiteHeader";
import { readSpec } from "./spec-state";

const EXAMPLES: [string, ViewSpec][] = Object.entries(exampleSpecs) as [string, ViewSpec][];
const FIRST_EXAMPLE = EXAMPLES[0][0];

const COMPONENT_COUNT = listComponentNames(defaultRegistry).length;

const serialize = (name: string) =>
  JSON.stringify(exampleSpecs[name as keyof typeof exampleSpecs], null, 2);

export function Playground() {
  const [selected, setSelected] = useState(FIRST_EXAMPLE);
  const [text, setText] = useState(() => serialize(FIRST_EXAMPLE));
  const { theme, setTheme, themeMode, setThemeMode } = useSiteTheme();
  const [documentOpen, setDocumentOpen] = useState(true);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

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
    <div className="pg-root">
      <SiteHeader
        page={PLAYGROUND_PAGE}
        theme={theme}
        onThemeChange={setTheme}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
      >
        <Tooltip content="Every name a document can use, compound parts included. Read from the component library at runtime, never listed by hand.">
          <Badge className="pg-topbar-badge">{COMPONENT_COUNT} components</Badge>
        </Tooltip>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="How this works"
          onClick={() => setAboutOpen(true)}
        >
          <CircleHelp size={16} aria-hidden="true" />
          <span className="pg-help-label">How this works</span>
        </Button>
      </SiteHeader>

      <main className="pg-main">
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

      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        componentCount={COMPONENT_COUNT}
      />
    </div>
  );
}
