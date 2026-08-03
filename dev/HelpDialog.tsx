import {
  Button,
  Dialog,
  FormActions,
  IconButton,
} from "@batthewz/response-ui-react-components";
import { X } from "lucide-react";
import { type ReactNode, useId } from "react";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** `<dt>` / `<dd>` pairs. The list itself belongs to the shell. */
  children: ReactNode;
}

/**
 * The dialog behind a help button in the top bar.
 *
 * Shared because there is one of these per page and they have to be the same
 * object: the button is the same affordance wherever it appears, so a reader who
 * opens the second one after the first should recognise it and not have to read
 * the furniture again. Only the title and the entries differ.
 *
 * The heading id is generated rather than fixed — nothing stops two of these
 * being mounted at once, and a duplicated id would silently give one dialog the
 * other's accessible name.
 *
 * Closing it is deliberately three ways: Escape, a click outside the panel, and
 * a control that is on screen the whole time. On a phone the panel is most of
 * the viewport and the prose is longer than it, so a dismissal at the end of the
 * reading is a dismissal you have to go and find — and the reader most likely to
 * want out is the one who has not read it.
 */
export function HelpDialog({
  open,
  onClose,
  title,
  children,
}: HelpDialogProps) {
  const titleId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      className="pg-about"
      // The component ships no light dismiss, and a backdrop click still targets
      // the dialog element, so the coordinates are the only tell — the pattern
      // its own examples document. The target check comes first because it is
      // free and because the padding band around the panel is part of the panel:
      // without it, only the geometry separates "missed the text" from "meant
      // the backdrop".
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const panel = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= panel.left &&
          event.clientX <= panel.right &&
          event.clientY >= panel.top &&
          event.clientY <= panel.bottom;
        if (!inside) onClose();
      }}
    >
      <header className="pg-about-head">
        <h2 id={titleId} className="text-h5 font-bold">
          {title}
        </h2>

        {/* First focusable in the panel, so `showModal()` opens the dialog at
            its title rather than scrolled to the button at the end. */}
        <IconButton type="button" aria-label="Close" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </IconButton>
      </header>

      <div className="pg-about-body">
        <dl className="pg-about-list">{children}</dl>
      </div>

      <FormActions>
        <Button type="button" onClick={onClose}>
          Got it
        </Button>
      </FormActions>
    </Dialog>
  );
}
