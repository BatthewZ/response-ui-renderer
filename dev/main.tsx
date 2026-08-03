import "./app.css";

import { ToastProvider } from "@batthewz/response-ui-react-components";
import { createRoot } from "react-dom/client";

import { exampleSpecs } from "../src/examples";
import { lucideIcons } from "../src/icons";
import { type ThemeMode, ViewRenderer } from "../src/index";
import type { ViewSpec } from "../src/spec";
import { useDemoAdapters } from "./adapters";
import { EDITOR_HANDOFF_KEY, EDITOR_VIEW } from "./full-page";
import { Site } from "./Site";
import { readSpec } from "./spec-state";

/** One document, full-page, exactly as a host would mount it. */
function FullPageView({
  spec,
  theme,
  themeMode,
}: {
  spec: ViewSpec;
  theme: string;
  themeMode: ThemeMode;
}) {
  const adapters = useDemoAdapters();
  return (
    <ViewRenderer
      spec={spec}
      theme={theme}
      themeMode={themeMode}
      icons={lucideIcons}
      adapters={adapters}
    />
  );
}

function resolveRequestedView(name: string | null): ViewSpec | null {
  if (name === null) return null;
  if (name === EDITOR_VIEW) return readSpec(localStorage.getItem(EDITOR_HANDOFF_KEY) ?? "").spec;
  const found = Object.entries(exampleSpecs).find(([key]) => key === name);
  return found ? (found[1] as ViewSpec) : null;
}

const params = new URLSearchParams(window.location.search);
const requested = params.get("view");
const fullPage = resolveRequestedView(requested);

// `?view=` wins over `?page=`: it is the chrome-free route the corpus is
// verified through, and a page frame around it would defeat the point. Which
// page the frame opens on is the frame's business, so it is read there.
createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    {fullPage ? (
      <FullPageView
        spec={fullPage}
        theme={params.get("theme") ?? "default"}
        themeMode={(params.get("mode") as ThemeMode) ?? "root"}
      />
    ) : (
      <Site />
    )}
  </ToastProvider>,
);
