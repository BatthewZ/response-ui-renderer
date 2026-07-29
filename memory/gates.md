# Gates

This package exists because its predecessor shipped five hand-maintained component lists
that drifted. The registry is therefore *derived* and must stay that way. A few things
genuinely cannot be derived — which props the library types with something JSON cannot
express, and which components inspect their own children. Each of those is a hand-maintained
table, and **every one is gated against the installed library's own source**, which ships
both `src` and `dist/*.d.ts`.

The rule: if you add a table that names a library component or prop, add the test that fails
when the library moves. An allowance in a gate is almost never the right fix.

What is gated today: the components whose open state the renderer owns; the parents that
clone or identity-check their children (checked by reading the library for `cloneElement` and
`child.type ===`); every coerced prop, asserted to still be declared upstream; the icon slots
typed as a component rather than a node; that the reference doc matches a fresh generation;
that every live component has a category and is either exercised by the corpus or excused
with a reason; and that the counts quoted in the README are the counts the registry has.

Two of these caught real drift the moment they were written — a generated cross-product named
three date props that do not exist, and the doc gate caught a stale table. That is the point.

## A gate's own input must be derived too

A hand-maintained table gated by a hand-maintained list of the same names is two things that
can drift, not one. Both slot tables are keyed `"Component.prop"`, so the component half is a
pure function of the table — derive it in one shared place rather than restating it beside
each table. A guard list that is retyped can fall silently behind the table it guards, which
is the exact failure the gates exist to prevent.

Be aware of the tail risk when a gate iterates a derived list: if the table were ever emptied,
`it.each([])` registers no tests and the gate disappears without a failure.

## A generator that compares against itself is not a gate

`--check` regenerates the doc and diffs it against the committed file. That catches a
stale commit and nothing else: anything the generator drops, it drops on both sides, so
the comparison agrees and the gate passes. A whole category of components was missing
from the reference for exactly this reason — bucketed by category, then never emitted,
because the order map the emitter loops over had no entry for it.

Two habits follow. Make the generator throw on input it cannot place rather than skipping
it — silence is what let this sit. And assert the shipped artifact, not the pipeline: the
test that would have caught it reads VIEWSPEC.md and checks every categorised component
appears there. "Has a category" and "reaches the doc" are different claims.

## A covariant type will not catch a list that shrinks

Zod's `ZodType` is covariant in its output, so a schema whose union is a strict *subset*
of the type it is declared against still typechecks. Only an *extra* member is an error.
Adding a case and forgetting a mirror produces a subset — the direction the compiler
cannot see. Derive both from one tuple, and if two expressions of one list must exist,
assert them against each other in a test rather than trusting the types.

## Ask the DOM, not the prose

The renderer never throws at a bad document; it renders a diagnostic and carries on. That
makes "did anything go wrong?" a DOM question. A gate matching particular *sentences* in
`textContent` only finds the failures whose wording it already knew, and misses entirely
any diagnostic that renders no text — a missing icon is an empty span. Query the
diagnostic classes, and keep those class names in one module so a new diagnostic cannot
be rendered without joining the set the query looks for.

## Source files must stay text

A control character written raw into a string literal — a NUL, most likely, while testing
scheme-smuggling URLs — costs the whole file its diff. Git classifies the blob as binary and
renders `Binary files differ`, and `git grep` and ripgrep skip it, so the file drops out of
both review and every search; a repo-wide grep quietly returns nothing for it. This happened
to the validator's test file and went unnoticed. Spell such characters as escapes; the string
value is identical. A gate now names any offending file.

## The library's published tarball is not its working tree

Its `docs/` are in `files`, but a given published version may predate a docs rewrite. Derive
from `dist/**/*.d.ts` and the live barrel, which are always present and are the actual
contract for the peer range. Authoring against the sibling repo's working tree produces props
that do not exist in the version consumers install.

## Theming

Never write an example theme name into a selector, type, default, config list, doc table or
fixture — invent one. `default` is the only theme the design system defines. A test asserts
the reference doc names none of them.
