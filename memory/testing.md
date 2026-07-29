# Testing

`bun run test` — **not** `bun test`, which runs Bun's own runner against a vitest suite and
fails a large fraction of it for reasons that have nothing to do with the code.
`bun run typecheck` is `tsc --noEmit && eslint src`; both must be clean.

## jsdom omissions

jsdom implements far less than the library uses, and every omission surfaces as a *render
failure* masked by an error boundary, which reads like a renderer bug. `test-setup.ts` stubs
`matchMedia`, `ResizeObserver`, `Element.scrollIntoView` and the `<dialog>` methods.

The `<dialog>` gap is the cautionary one: because jsdom ships no `showModal`, **no test in
this package had ever proven that a dialog opens.** When a component's behaviour seems
untested, check whether the environment can express it at all before concluding it works.

Anything driven by `IntersectionObserver` renders at `opacity: 0` for ever in jsdom. Fixtures
pass `animate: false` so the content is really asserted rather than merely present.

## Checks that cannot fail

Two got written here and both had to be caught by re-reading, not by a failure:

- `expect(result.ok ? [] : result.issues).toEqual([])` compares `[]` to `[]` on every
  conforming document, so an entire tier of warnings passed unseen. Assert the list itself.
- A coverage assertion that derives its expectation from the same predicate it is testing
  agrees with itself no matter what either does.

Watch every new check go red before trusting it. The gates in this package have all been
falsified deliberately at least once; keep that up.

## Assert the whole issue, not just its message

A validation issue is a `path` and a `message`, and for a long time every test asserted only
the message. That left the `path` unverified across the entire validator, and one family of
warnings was reporting a fact about a node's *children* at the node's `props` path — a path
that on a node declaring no props named nothing at all. Nothing failed, because nothing
looked. When a check reports a location, assert the location.

The related design rule: a warning's path should name the thing the message is about. A hint
that says "set this prop" belongs at that prop even when it is absent, because the path is
telling the author where to go; a hint about the node's children belongs at the node.

## The corpus is the reference

`src/examples/coverage/` is authored and must model the advice the package gives — it is
what an agent reads to learn the format. `src/examples/*.viewspec.json` is real generator
output kept byte-identical; do not tidy it.
