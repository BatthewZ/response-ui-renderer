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

The same gap has a second half worth knowing before you go looking: a dialog can be opened
and closed through the `openDialog`/`closeDialog` actions, but the `onClose` prop the
renderer injects cannot be reached at all. Firing it needs a native dismiss, and the stub
does not raise one on Escape; the component ships no close control to click instead. A test
that closes via the action passes whether or not that wiring exists — confirmed by breaking
it — so do not read one as covering the other.

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

## A smoke test is only as wide as what it looks for

The corpus gates asserted `textContent` did not contain two particular sentences. The
renderer reports five things, three of them worded differently, and one renders no text at
all. Every one of those passed the gate. When a check stands in for "nothing went wrong",
write down what the full set of wrong looks like and assert against the set — not against
the two examples that were on your mind.

## A diagnostic can render where the query is not looking

The corpus gate asked `findRenderDiagnostics(container)` — the tree `render()` returns.
Every overlay in the library portals to `document.body`, so a dialog, menu, tooltip or
listbox that fails renders its diagnostic *outside* that tree and the gate sees nothing.
Scan from `document.body` whenever the check stands for "nothing went wrong anywhere".

The same portal has a second half: a component named only inside a *closed* overlay is
never mounted by a corpus render, so the parity gate proves the name exists, not that it
works. Anything reached through an overlay needs a render test that opens it.

## The corpus is the reference

`src/examples/coverage/` is authored and must model the advice the package gives — it is
what an agent reads to learn the format. `src/examples/*.viewspec.json` is real generator
output kept byte-identical; do not tidy it.

Migrating one is not tidying, and is sometimes required: when a peer release makes a value
inert, a specimen that no longer renders has stopped being evidence of anything. Make the
smallest edit that restores the behaviour, leave everything else exactly as the generator
wrote it, and record what changed in the changelog. `product-landing` carried
`"gap": "var(--spacing-r4)"` — a real generator reaching for a CSS length because the prop
was typed `string` — and 0.12.0 made that a no-op. That specimen is why the validator now
knows which props take a fixed set of values.
