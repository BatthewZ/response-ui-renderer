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
6. **`children` that the component *calls* rather than places.** A render-prop root invokes
   what it is handed, so document nodes arrive as an array and it dies with "children is not
   a function". Recoverable, and worth recovering: render the nodes inside the call and bind
   the arguments as reference names, exactly as `$each` binds a row. The component stays the
   only writer of the data; the document becomes the only writer of the presentation.
7. **`children` that the component *parses* rather than places.** A root typed
   `children: string` is a parser, not a composer. Rendered as nodes its children arrive as
   React elements where a string was expected, and it dies on the first string method — so
   the component is addressable in name and unusable in fact. Resolve the children to text
   instead, before the element is created. Concatenate them **verbatim**: joining on a
   newline reads well for a document that splits a block per child and silently corrupts one
   that interpolates a `$ref` mid-sentence, and nothing distinguishes the two. Note that
   `$each` can only contribute one node's text per item, because the format has no wrapper to
   give it — a document concatenates fragments rather than composing them.
8. **A prop bounded to a set of values.** The compiler enforces these upstream; JSON has
   nothing. The component looks the value up in a table of classes, misses, and renders as
   if the prop were unset — no error, no fallback, nothing in the DOM. Generate the sets
   from the library's declarations and warn, or the failure is invisible on both sides.

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

## A coercion keyed on a prop's name must switch on the prop's resolved value

Blast radius is *where* a rule applies; this is *when*. A document may write `{"$ref": …}` in
any prop position, so a rule that is selected by the key but decides by the value's shape —
"is this a string?", "is this an array?" — has to run on the resolved side of the reference.
Run it against the literal and every indirect spelling silently opts out, while the direct one
in front of you keeps working: the tests pass, the corpus renders, and the failure only appears
in the shape real generators actually emit, which is `$each` over a data array with the value
pulled out by `$ref`. It cost an icon name rendered as body text and two components that threw
on an unresolved marker.

The tell is a test suite that only ever writes the literal. When a rule is keyed on a name,
test the indirect spelling too — it is a different code path, not the same one in disguise.

The exception is a coercion whose input legitimately *contains* markers, like a column def
holding a `$node` cell template: resolution would turn the template into an element before the
coercion could wrap it in the function the library wants. Those must run first. So the ordering
is a real decision per rule — does this coercion consume a marker, or a value? — and not a
default to apply blindly in either direction.

## A per-node error boundary must not remember

The diagnostic a boundary shows has to describe the render it is showing, not one that
happened earlier. Resetting on the slot's identity — the label, the node object — reads as
correct and is not: the whole point of a live editor is that the author fixes the node that
threw *in place*, so its component name, its position and often the node object itself are
exactly what they were. The same holds for a bad value arriving through `$ref`, where the
document never changes at all. Both leave a stale error sitting over a view that now renders
perfectly, and the author is left disbelieving the only feedback the tool gives them.

Treat every render as a fresh attempt: retry when new children arrive, which is whenever
something above re-rendered. That cannot loop, because the boundary's own state change does
not produce new children. A node that is still broken throws once per render, which is the
honest cost of never lying about the current state.

## A React key may be derived from identity, never from data

Keying a child by its position remounts it whenever a sibling moves, so the key is derived
from the node's props instead. The trap is which props qualify. `id` is identity. `name` is
not — a radio group shares one on purpose, which makes the canonical spelling of a group two
siblings with the same key. `value` is not either: it is a rating's score, a meter's reading,
a number two siblings may honestly both be showing. React answers a repeated key by warning
that it may duplicate or omit one of the children, so the document that means both gets one.

The instinct is to fix it upstream, in whatever produced the document — rename the colliding
prop the way a duplicate `id` is renamed. That is right for `id`, which is genuinely unique or
the HTML is wrong, and wrong for everything else: renaming a rating's `value` to make a key
unique changes how many stars it draws. A tool must not corrupt valid data to work around a
rendering detail, and a hand-authored document reaches the same collision with no tool
involved, so the fix belongs where the key is made.

Disambiguate only a key that has already appeared among the *same siblings*. Then a document
that was well-formed keeps byte-identical keys, and the change cannot move what React
reconciles anywhere it was not already broken. Removing the weak props from the chain instead
would renumber keys in documents that never had the problem — a much larger blast radius for
the same defect.
