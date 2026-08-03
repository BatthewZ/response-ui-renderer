# memory — @batthewz/response-ui-renderer

Durable notes for anyone (human or agent) working in this package. Principles and
traps only: no TODOs, no line numbers, no file-by-file inventory.

| File | What it holds |
| --- | --- |
| [driving-a-component-library-from-json.md](driving-a-component-library-from-json.md) | The recurring shapes that defeat a JSON renderer, which of them can be fixed at all, and why a per-node error boundary must never remember |
| [authoring-documents.md](authoring-documents.md) | Making a document look like a product: scoped theme overrides need the document to paint its own canvas, component defaults that fight polish, and how to verify visually |
| [testing.md](testing.md) | How to run the suite, what jsdom lacks, and how to avoid writing a check that cannot fail |
| [gates.md](gates.md) | Every hand-maintained list in this package and the test that keeps it honest, plus the source-hygiene gates and what upgrading the peer library actually requires |
| [payload-size.md](payload-size.md) | How much smaller a document really is than the equivalent markup, where the saving comes from, and the two ways this measurement flatters itself |
| [dev-harness.md](dev-harness.md) | Why the published site's prose pages are documents rather than a docs feature, why a frame owns its chrome and pages draw none, why that chrome must be built from tokens, what a control or a number in the chrome claims by accident, why a help panel has to be a column, the device-preview trap, and the routes the visual workflow depends on |
