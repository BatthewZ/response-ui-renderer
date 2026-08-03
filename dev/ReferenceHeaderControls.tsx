import { Button } from "@batthewz/response-ui-react-components";
import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { ReferenceDialog } from "./ReferenceDialog";

/**
 * The reference page's own bit of the top bar — see `PlaygroundHeaderControls`
 * for why a page's controls live beside it rather than in it.
 *
 * The label names the subject rather than the page: "what is a ViewSpec" is the
 * question someone who has just landed on a wall of generated tables is actually
 * holding, and the page's own title answers a different one.
 */
export function ReferenceHeaderControls() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="What is a ViewSpec?"
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={16} aria-hidden="true" />
        <span className="pg-help-label">What is a ViewSpec?</span>
      </Button>

      <ReferenceDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
