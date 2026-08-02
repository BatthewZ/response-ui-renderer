import {
  Badge,
  Button,
  EXAMPLE_THEMES,
  Select,
  Tooltip,
} from "@batthewz/response-ui-react-components";
import { CircleHelp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { exampleSpecs } from "../src/examples";
import { defaultRegistry, listComponentNames, type ThemeMode } from "../src/index";
import type { ViewSpec } from "../src/spec";
import { AboutDialog } from "./AboutDialog";
import { DocumentPane } from "./DocumentPane";
import { EDITOR_HANDOFF_KEY, EDITOR_VIEW } from "./full-page";
import { GateRail } from "./GateRail";
import { PreviewPane } from "./PreviewPane";
import { readSpec } from "./spec-state";

const EXAMPLES: [string, ViewSpec][] = Object.entries(exampleSpecs) as [string, ViewSpec][];
const FIRST_EXAMPLE = EXAMPLES[0][0];

// Dev harness only: the example themes are opt-in, and app.css imports them deliberately.
const THEMES = EXAMPLE_THEMES;

const COMPONENT_COUNT = listComponentNames(defaultRegistry).length;

const serialize = (name: string) =>
  JSON.stringify(exampleSpecs[name as keyof typeof exampleSpecs], null, 2);

export function Playground() {
  const [selected, setSelected] = useState(FIRST_EXAMPLE);
  const [text, setText] = useState(() => serialize(FIRST_EXAMPLE));
  const [theme, setTheme] = useState<string>("default");
  const [themeMode, setThemeMode] = useState<ThemeMode>("root");
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
      <header className="pg-topbar">
        <div className="pg-brand">
          <span className="pg-mark" aria-hidden="true" />
          <span className="pg-brand-name">response-ui</span>
          <span className="pg-brand-part">renderer</span>
        </div>

        <p className="pg-thesis">Declarative JSON, rendered as real components.</p>

        <div className="pg-topbar-controls">
          <Tooltip content="Every name a document can use, compound parts included. Read from the component library at runtime, never listed by hand.">
            <Badge className="pg-topbar-badge">{COMPONENT_COUNT} components</Badge>
          </Tooltip>

          <div className="pg-control">
            <label className="pg-control-label" htmlFor="pg-theme">
              Theme
            </label>
            <Select
              id="pg-theme"
              className="py-r6"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              {THEMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          <div className="pg-control">
            <label className="pg-control-label" htmlFor="pg-mode">
              Scope
            </label>
            <Select
              id="pg-mode"
              className="py-r6"
              value={themeMode}
              onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
            >
              <option value="root">page (root)</option>
              <option value="scoped">view (scoped)</option>
            </Select>
          </div>

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
        </div>
      </header>

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
