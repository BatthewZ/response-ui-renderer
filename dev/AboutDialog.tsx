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
        <dt>What this is</dt>
        <dd>
          A JSON renderer for{" "}
          <code>@batthewz/response-ui-react-components</code> — the component library is what
          you are looking at, and this package is only the layer that lets a document address
          it. Both sit on <code>@batthewz/response-ui-css</code>, which is where the theming
          and the responsive scales come from: a view is themed and reflows because the
          components are, not because anything here draws a pixel of its own.
        </dd>

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

        <dt>The theme is the document's</dt>
        <dd>
          Every example here sets its own <code>themeOverrides</code> — the block near the top
          of the JSON. They are CSS custom properties written onto the view's wrapper, so a
          document reskins itself and nothing outside it. Edit one and watch the view follow.
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
