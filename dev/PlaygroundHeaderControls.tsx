import { Button } from "@batthewz/response-ui-react-components";
import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { defaultRegistry, listComponentNames } from "../src/index";
import { AboutDialog } from "./AboutDialog";

const COMPONENT_COUNT = listComponentNames(defaultRegistry).length;

/**
 * The playground's own bits of the top bar.
 *
 * They live beside the playground rather than in it because the bar is mounted
 * once, by the frame, and outlives any page — so a page contributes controls to
 * it instead of drawing one of its own. The dialog is here with the button that
 * opens it: it is `<dialog>`, so it paints in the top layer and cares nothing
 * for the flex row it is declared in.
 *
 * A "{n} components" badge sat here and has been removed. The number is the size
 * of the registry, but a badge beside a rendered view reads as a count of what is
 * in that view, and nothing about its placement corrected the first reading. The
 * count is still made — the dialog states it in a sentence that says what it
 * counts, which is the only place it means anything.
 */
export function PlaygroundHeaderControls() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
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

      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        componentCount={COMPONENT_COUNT}
      />
    </>
  );
}
