import { Badge, Button, Tooltip } from "@batthewz/response-ui-react-components";
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
 */
export function PlaygroundHeaderControls() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
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

      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        componentCount={COMPONENT_COUNT}
      />
    </>
  );
}
