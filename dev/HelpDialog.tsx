import {
  Button,
  Dialog,
  FormActions,
} from "@batthewz/response-ui-react-components";
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
    >
      <h2 id={titleId} className="text-h5 font-bold">
        {title}
      </h2>

      <dl className="pg-about-list">{children}</dl>

      <FormActions>
        <Button type="button" onClick={onClose}>
          Got it
        </Button>
      </FormActions>
    </Dialog>
  );
}
