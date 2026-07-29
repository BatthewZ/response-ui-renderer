# Driving a component library from JSON

The registry derives every addressable name from the library's barrel, so *naming* a
component is never the problem and never drifts. The problem is always **semantic**: a
ViewSpec is JSON, and JSON has no functions, no `Date`, no `Set`, and no React elements.

Everything below was found by auditing the library's own component docs against the
renderer, then proving each claim with a failing test before fixing it. Expect the same
shapes to recur whenever the library grows.

## The categories, in rough order of how often they bite

1. **A callback that is handed a bare value, not a DOM event.** Many controls re-type
   `onChange` to `(value) => void`. Anything that reaches for `event.target` throws inside
   the handler, outside any error boundary. Normalise the reported value in one place and
   share it between form binding and the `event` ref namespace.
2. **A callback whose argument is the only way to learn anything.** A declarative handler
   that discards its arguments makes every controlled component write-only. The `event`
   namespace exists for exactly this; a component that is controlled-only *and* has no
   uncontrolled fallback is completely inert without it.
3. **A prop typed `ReactNode` that is not a child.** Use the explicit `$node` marker rather
   than sniffing for `{ component }`, so a prop can still take a literal object.
4. **A required prop that is a function.** If it is required, the component cannot be
   instantiated at all. Look for the smallest declarative substitute — an accessor prop is
   usually expressible as the key it would have read.
5. **`Date`, `Set` and friends.** Parse ISO strings from local calendar fields, not UTC, or
   every user west of Greenwich gets the wrong day. Reject impossible dates instead of
   letting the constructor roll them forward.

## The one that cannot be fixed, and why it matters

A parent that decides something by comparing a child's element type —
`child.type === SomeComponent` — can **never** work through this renderer. The child's type
is the renderer's own node component, at any depth. Removing wrappers does not help; there
is no depth at which the comparison becomes true.

This is different from a parent that *clones* its child to inject props. That one **is**
recoverable: render the child without its own error boundary and have the node component
forward whatever was injected onto the element it creates.

Telling the two apart matters, because the fix for one does nothing for the other. When a
feature cannot be inferred, the honest move is a validator warning naming the explicit prop
that does the same job — and to fire it only when the document is actually relying on the
inference, or authors learn to ignore warnings.

## Degrade, never throw — but also never lie

The renderer's input is machine-generated, so malformed input is an expected condition and
every node degrades in place. The failure mode to fear is not a crash; it is a component
that renders and quietly does nothing. Prefer a warning that names the fix over silence.

## Coercions are policy, and policy needs a blast radius

`$`-prefixed markers (`$ref`, `$node`, `$field`) are reserved by the format, so they can be
resolved anywhere, including inside array and object props. Implicit coercions cannot: a
handler object shaped like `{ action }` and an icon-name string on an `icon`-shaped key both
collide with ordinary data. Keep implicit rules at the top level of `props`, require nested
ones to be unambiguous, and let documents reach the rest through an explicit marker.
