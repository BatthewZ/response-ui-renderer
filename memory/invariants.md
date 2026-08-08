# Invariants, and two rules that look like they apply but must not

Most of this package's rules are enforced by `contracts.test.ts` rather than remembered:
zero runtime dependencies, no host coupling in the wire format (no router import, no server
route, no `connectionId` — host behaviour arrives through the adapters), no CSS-in-JS and no
raw hex in diagnostics, no suppressions anywhere, and `zod` / `lucide-react` imported by
nothing but their own subpath module. A violation fails the suite, so the prose is a
convenience and the test is the contract. What follows is what a test cannot tell you: why
two plausible-looking changes are wrong.

## The two validators agree on conformance and nowhere else

`validateViewSpec` (zero-dep) and `viewSpecSchema` (Zod) must agree on `result.ok`, and a
shared corpus proves it. Below that line they deliberately diverge: `validateViewSpec` is
two-tier, and its warning tier — forbidden props, dangerous URLs, unknown actions inside
props, non-token theme overrides, depth overrun, a value outside a bounded prop's set — has
no Zod counterpart, because Zod types `props` as an open record.

The tempting repair is to promote those warnings to errors so the two line up. Don't: it
would reject documents the renderer renders perfectly well. The asymmetry is the design.
Conformance is the contract; severity is advice.

## Do not wrap a document's `className` in `cn()`

The design system's "always merge classNames through `cn()`" rule reads as though it applies
here. It does not. Every response-ui component already merges its own `className` prop —
`Card`, `Text` and the rest all do `className={cn(…, className)}` — so a call in the renderer
collapses nothing extra. Worse, it cannot be covered by a test that would fail without it,
which makes it a change that looks like diligence and buys nothing.
