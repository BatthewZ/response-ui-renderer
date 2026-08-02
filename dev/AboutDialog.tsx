import { Button, Dialog, FormActions, Kbd } from "@batthewz/response-ui-react-components";

import { MOD_KEY } from "./keys";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
  /** Every name the registry resolves, compound parts included. */
  componentCount: number;
}

export function AboutDialog({ open, onClose, componentCount }: AboutDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="pg-about-title" className="pg-about">
      <h2 id="pg-about-title" className="text-h5 font-bold">
        How this page works
      </h2>

      <dl className="pg-about-list">
        <dt>A document, not code</dt>
        <dd>
          The left panel is a ViewSpec: plain JSON. Edit it and the view rerenders. Nothing on
          the right is hand-written — every element is one of {componentCount} names the
          registry resolves, read from the component library at runtime.
        </dd>

        <dt>Validation is a gate, and it has two tiers</dt>
        <dd>
          An <em>error</em> means the document does not conform, so it will not render. A{" "}
          <em>warning</em> means it renders, but a part of it will not do what it looks like —
          a value outside the set a prop accepts, a stripped URL, a forbidden prop. The gate on
          the divider carries the verdict; open it for the list.
        </dd>

        <dt>The render is live</dt>
        <dd>
          Buttons, forms and menus in it work. This page supplies the host half of the
          contract, so <code>navigate</code> and <code>showToast</code> announce themselves in
          a toast instead of moving you anywhere. A real host points them at its own router.
        </dd>

        <dt>Theme mode is the one real trade-off</dt>
        <dd>
          <strong>root</strong> writes <code>data-theme</code> to <code>&lt;html&gt;</code>, so
          the theme reaches a document written against <code>:root[data-theme]</code> — and
          repaints this shell with it. <strong>scoped</strong> writes it to the view wrapper
          alone, which contains the theme but only works for themes authored with a bare{" "}
          <code>[data-theme]</code> selector.
        </dd>

        <dt>Keyboard</dt>
        <dd>
          <Kbd>{MOD_KEY}</Kbd> <Kbd>B</Kbd> shows and hides the document.{" "}
          <Kbd>{MOD_KEY}</Kbd> <Kbd>↵</Kbd> re-indents it.
        </dd>
      </dl>

      <FormActions>
        <Button type="button" onClick={onClose}>
          Got it
        </Button>
      </FormActions>
    </Dialog>
  );
}
