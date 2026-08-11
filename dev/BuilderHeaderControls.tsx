import { Button } from "@batthewz/response-ui-react-components";
import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { HelpDialog } from "./HelpDialog";

/**
 * The builder's own bit of the top bar.
 *
 * One control and one sentence, in the place the playground keeps the same
 * pair. The sentence matters more than the control: a drag-and-drop editor in a
 * package about *machine*-authored documents invites exactly one wrong reading —
 * that this is how a ViewSpec is meant to be written — and the dialog is where
 * that is answered rather than left to be inferred from a canvas.
 */
export function BuilderHeaderControls() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="What this is"
        onClick={() => setOpen(true)}
      >
        <CircleHelp size={16} aria-hidden="true" />
        <span className="pg-help-label">What this is</span>
      </Button>

      <HelpDialog open={open} onClose={() => setOpen(false)} title="What this is">
        <dt>A document is data, and this is what that buys</dt>
        <dd>
          A ViewSpec is not the transcript of a session in this editor — most are written by a
          model, and that is the point of the format. What the editor demonstrates is the other
          half of the same claim: because a document is <em>data</em> rather than a program, a
          tool can compose it, rearrange it, retheme it and validate it without running any of
          it. Drag something in and read the JSON change.
        </dd>

        <dt>Nothing here is a special case</dt>
        <dd>
          The palette is the registry, derived from the component library&rsquo;s own barrel. The
          variant buttons are the same <code>propEnums</code> the validator checks a document
          against. The <code>classNames</code> fields are the same slot keys the reference prints.
          None of it is a list written for the builder, which is why{" "}
          <code>PriceTag</code> — a component this page registers and the design system has never
          heard of — is in the palette with a full inspector.
        </dd>

        <dt>The canvas is the render</dt>
        <dd>
          It is the same <code>ViewRenderer</code> a host mounts, with the real components. While
          you are editing, a click on it selects rather than activates; <em>Interact</em> hands
          the clicks back so a document&rsquo;s own buttons, forms and menus can be tried.
        </dd>

        <dt>The theme travels in the document</dt>
        <dd>
          The theme panel offers the tokens <code>@batthewz/response-ui-css</code> defines as its
          theme contract, and writes them to the document&rsquo;s <code>themeOverrides</code> —
          CSS custom properties scoped to this view. Nothing is rebuilt and no component is
          touched.
        </dd>

        <dt>What it does not author</dt>
        <dd>
          Data bindings, forms, <code>$each</code> and <code>$cond</code> are not editable here.
          A document that already has them keeps them — they are shown in the structure tree and
          left exactly as they were — but composing them is the JSON editor&rsquo;s job, on the
          playground.
        </dd>
      </HelpDialog>
    </>
  );
}
