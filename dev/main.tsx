import "./app.css";

import { ToastProvider, useToast } from "@batthewz/response-ui-react-components";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { exampleSpecs } from "../src/examples";
import { lucideIcons } from "../src/icons";
import { type ThemeMode, ViewRenderer } from "../src/index";
import { type ValidationIssue, validateViewSpec, type ViewSpec } from "../src/spec";
import { gridExamples } from "./fixed";

/**
 * Hand-authored — NOT one of the real generator fixtures. Demonstrates the
 * `themeOverrides` capability: CSS variables from response-ui-css set inside the
 * document itself, reskinning real components with no theme file and no rebuild.
 */
const themedOverridesDemo: ViewSpec = {
  version: 1,
  title: "Theme variables in the JSON",
  themeOverrides: {
    "--C-SURFACE-1": "oklch(0.22 0.04 265)",
    "--C-TEXT-PRIMARY": "oklch(0.96 0.01 265)",
    "--C-TEXT-SECONDARY": "oklch(0.78 0.02 265)",
    "--C-PRIMARY": "oklch(0.72 0.16 200)",
    "--C-PRIMARY-HOVER": "oklch(0.66 0.16 200)",
    "--C-TEXT-ON-PRIMARY": "oklch(0.16 0.03 265)",
    "--C-BORDER-DEFAULT": "oklch(0.32 0.04 265)",
    "--RADIUS-MD": "1rem",
  },
  root: {
    component: "Container",
    children: [
      {
        component: "Card",
        props: { padding: "r3" },
        children: [
          {
            component: "Stack",
            props: { gap: "r4" },
            children: [
              { component: "Text", props: { variant: "h3" }, children: ["Reskinned from JSON"] },
              {
                component: "Text",
                props: { variant: "body-2", color: "secondary" },
                children: [
                  "Every colour here comes from themeOverrides in this document — no theme file, no CSS edit. Change a value and it re-renders live.",
                ],
              },
              {
                component: "Row",
                props: { gap: "r4" },
                children: [
                  { component: "Button", props: { variant: "primary" }, children: ["Primary"] },
                  { component: "Badge", props: { variant: "info" }, children: ["Badge"] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

const EXAMPLES: [string, ViewSpec][] = [
  ...(Object.entries(exampleSpecs) as [string, ViewSpec][]),
  ...gridExamples,
  ["themeOverrides demo", themedOverridesDemo],
];

const THEMES = ["default", "events", "grimdark", "tech"] as const;

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

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <Playground />
  </ToastProvider>,
);
