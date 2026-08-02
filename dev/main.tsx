import "./app.css";

import {
  EXAMPLE_THEMES,
  ToastProvider,
  useToast,
} from "@batthewz/response-ui-react-components";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { exampleSpecs } from "../src/examples";
import { lucideIcons } from "../src/icons";
import { type ThemeMode, ViewRenderer } from "../src/index";
import { type ValidationIssue, validateViewSpec, type ViewSpec } from "../src/spec";

const EXAMPLES: [string, ViewSpec][] = Object.entries(exampleSpecs) as [string, ViewSpec][];

// Dev harness only: the example themes are opt-in, and app.css imports them deliberately.
const THEMES = EXAMPLE_THEMES;

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (issues.length === 0) {
    return <p style={{ color: "var(--C-STATUS-SUCCESS)", margin: 0 }}>✓ no issues</p>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
      {issues.map((issue, i) => (
        <li
          key={i}
          className="pg-issue"
          style={{
            color: issue.severity === "error" ? "var(--C-STATUS-ERROR)" : "var(--C-STATUS-WARNING)",
          }}
        >
          <strong>{issue.severity}</strong> {issue.path}: {issue.message}
        </li>
      ))}
    </ul>
  );
}

function Playground() {
  const { toast } = useToast();
  const [text, setText] = useState(() => JSON.stringify(exampleSpecs.contactForm, null, 2));
  const [theme, setTheme] = useState<string>("default");
  const [themeMode, setThemeMode] = useState<ThemeMode>("root");

  const { spec, parseError, issues } = useMemo(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return { spec: null, parseError: (e as Error).message, issues: [] as ValidationIssue[] };
    }
    const result = validateViewSpec(parsed);
    return {
      spec: result.ok ? result.spec : null,
      parseError: result.ok ? null : "does not conform",
      issues: result.issues,
    };
  }, [text]);

  return (
    <div className="pg-root">
      <div className="pg-panel">
        <div className="pg-controls">
          <strong>example:</strong>
          {EXAMPLES.map(([name, doc]) => (
            <button key={name} onClick={() => setText(JSON.stringify(doc, null, 2))}>
              {name}
            </button>
          ))}
        </div>
        <div className="pg-controls">
          <strong>theme:</strong>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {THEMES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <strong>mode:</strong>
          <select value={themeMode} onChange={(e) => setThemeMode(e.target.value as ThemeMode)}>
            <option value="root">root</option>
            <option value="scoped">scoped</option>
          </select>
        </div>
        <textarea
          className="pg-editor"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
        <div className="pg-cell pg-validation">
          <strong>validation</strong>
          {parseError && issues.length === 0 ? (
            <p style={{ color: "var(--C-STATUS-ERROR)" }}>JSON error: {parseError}</p>
          ) : (
            <IssueList issues={issues} />
          )}
        </div>
      </div>

      <div className="pg-cell pg-preview">
        <strong style={{ color: "var(--C-TEXT-MUTED)" }}>rendered output</strong>
        <div style={{ marginTop: "0.75rem" }}>
          {spec ? (
            <ViewRenderer
              spec={spec}
              theme={theme}
              themeMode={themeMode}
              icons={lucideIcons}
              adapters={{
                navigate: (path) => toast(`navigate → ${path}`, { variant: "info" }),
                toast,
                fetch: (url, init) => fetch(url, init),
              }}
            />
          ) : (
            <p style={{ color: "var(--C-STATUS-ERROR)" }}>Fix the spec to render.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** `?view=<example name>` renders one document full-page — no playground chrome. */
function FullPageView({ spec, theme, themeMode }: {
  spec: ViewSpec;
  theme: string;
  themeMode: ThemeMode;
}) {
  const { toast } = useToast();
  return (
    <ViewRenderer
      spec={spec}
      theme={theme}
      themeMode={themeMode}
      icons={lucideIcons}
      adapters={{
        navigate: (path) => toast(`navigate → ${path}`, { variant: "info" }),
        toast,
        fetch: (url, init) => fetch(url, init),
      }}
    />
  );
}

const params = new URLSearchParams(window.location.search);
const requestedView = params.get("view");
const fullPage = EXAMPLES.find(([name]) => name === requestedView);

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    {fullPage ? (
      <FullPageView
        spec={fullPage[1]}
        theme={params.get("theme") ?? "default"}
        themeMode={(params.get("mode") as ThemeMode) ?? "root"}
      />
    ) : (
      <Playground />
    )}
  </ToastProvider>,
);
