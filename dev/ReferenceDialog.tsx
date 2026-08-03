import { HelpDialog } from "./HelpDialog";

interface ReferenceDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * What the reference page is for, for the reader who arrived at a wall of tables
 * with no idea who wrote it or who it is addressed to.
 *
 * The answer is that they are not the addressee. Everything about the page that
 * reads as odd — the terseness, the tables, the absence of tutorial — follows
 * from its being a prompt payload, and saying so once turns all of it from a
 * documentation failure into the format it is.
 */
export function ReferenceDialog({ open, onClose }: ReferenceDialogProps) {
  return (
    <HelpDialog open={open} onClose={onClose} title="What is a ViewSpec?">
      <dt>A view, described as data</dt>
      <dd>
        A ViewSpec is a JSON document naming components, their props and their
        children — no markup, no script, no styles. Mount it with{" "}
        <code>ViewRenderer</code> and you get a page built from real
        design-system components. Because it is data rather than a program, it
        can be validated before it renders, diffed, patched and stored, and
        every stored document picks up the next version of the component
        library.
      </dd>

      <dt>This page is written for a model, not for you</dt>
      <dd>
        It is the whole format plus every component, its compound parts, its
        props, its slot keys and the values each bounded prop accepts — meant to
        be handed to an LLM whole, as a system prompt or a tool document, so it
        can author a document that renders. That is why it is terse and tabular
        and skips the worked tutorial: every line is a line someone pays for on
        each generation. Read it as a reference, by all means; it is addressed
        to the thing doing the writing.
      </dd>

      <dt>
        It is generated, so it cannot describe a library that is not there
      </dt>
      <dd>
        Nothing here is a hand-kept list. The names come from the barrel of{" "}
        <code>@batthewz/response-ui-react-components</code> — the component
        library this package renders — and the types from that package's
        shipped declarations, regenerated on every upgrade, and a test fails if
        the committed page and a fresh generation disagree. A reference that
        drifts teaches a model to write documents that no longer render.
      </dd>

      <dt>The loop is closed at both ends</dt>
      <dd>
        <code>validateViewSpec</code> checks what the model produced — errors
        mean it will not render, warnings mean a part of it will not do what it
        looks like — and <code>viewSpecJsonSchema()</code> hands the format to a
        provider as a structured-output schema, which shapes generation into
        valid documents rather than repairing them afterwards. Both are built
        from the same source as this page.
      </dd>
    </HelpDialog>
  );
}
