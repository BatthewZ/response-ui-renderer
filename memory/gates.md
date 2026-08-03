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
`child.type ===`); the components whose `children` is a function, and the argument names they
hand it; every coerced prop, asserted to still be declared upstream; the icon slots
typed as a component rather than a node; that the reference doc matches a fresh generation;
that every live component has a category and is either exercised by the corpus or excused
with a reason; and that the counts quoted in the README are the counts the registry has.

Two of these caught real drift the moment they were written — a generated cross-product named
three date props that do not exist, and the doc gate caught a stale table. That is the point.

## An example in prose is a claim, and rots the same way a number does

Counts in the README are gated because a number in prose drifts silently. A quickstart is the
same kind of claim and a worse failure: it is the one example a reader is guaranteed to run,
and it lives in a file nothing executes. Gate it by *reading the example out of the document*
— parse the fenced block, validate it, render it, exercise what the prose promises it does.
Restating the example in the test instead creates a second copy, and the copy is what stays
green while the README goes wrong.

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

The same asymmetry sets an ordering trap on a peer bump, and the doc gate's advice walks you
straight into it. A component the curated notes do not name is dropped from the doc rather
than rejected, so regenerating *before* categorising the new arrivals produces a doc that is
internally consistent and silently short — the staleness gate goes green while the
categorisation gate stays red, and the reassuring half is the one that just stopped meaning
anything. Categorise first, regenerate second. More generally, when a bump fires several
gates at once, fix the one naming the missing decision before the one naming the stale
artifact; regeneration is what launders an unmade decision into a passing check.

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

The converse trap is that a fix committed in the sibling repo is invisible here until it is
*published*. A version number that did not move cannot deliver it: the range already resolves
to a tarball on the registry, so an install is a no-op and the old behaviour persists while
the source next door plainly shows it fixed. Reading the sibling's working tree to explain
what the renderer just drew will mislead you every time — read `node_modules`, which is what
actually rendered.

## Editing the manifest is not upgrading

Bumping a range changes an intent; the lockfile and `node_modules` are what the build,
the tests and the generators read. Skip the install and every gate keeps passing against the
old library — the most convincing kind of green, because nothing failed. Whenever a range
moves, install, then confirm the installed version is the one you asked for before trusting
any result.

An upgrade also invalidates derived artifacts. Anything generated from the library — the
reference doc most of all — has to be regenerated in the same change, because upstream adding
a prop makes the committed copy stale by definition. That gate firing after a bump is it
working, not a flake, and regenerating is the fix.

## What no gate can see: a prop that was deleted upstream

Every gate here asks "does what we name still exist?". None asks the reverse — whether a
prop a *document* names still exists — and it cannot, because most components spread their
rest props onto a DOM element, so an unknown key is indistinguishable from a legitimate
`data-*` or `id`. A release that deletes a prop therefore leaves the corpus rendering
green and wrong: the value lands as a DOM attribute and the dimension it was setting is
simply absent.

Two things follow. Sweep the corpus by hand against the upstream changelog's *Breaking*
section on every peer bump — it is the only pass that will catch this. And prefer, where
the library gives you the choice, a prop whose wrong value is *loud*: a bounded union is
generated into `prop-enums.json` and warned about, so it degrades to a message rather than
to silence.

## Slot keys and value sets are generated, not written

`classNames` keys and every prop bounded to a fixed set of strings are parsed out of the
library's shipped declarations by the doc generator, into VIEWSPEC.md and into
`src/spec/prop-enums.json` — one artifact, so the reference a model authors from and the
check the validator applies cannot disagree. Regenerate after any peer bump.

The generator throws rather than skips when it finds a `classNames` it cannot attribute to
an addressable component, and that throw has already paid for itself three times: it found
three separate props-type naming conventions upstream (`XProps`, the unprefixed `PartProps`,
and `XOwnProps`), each of which had been silently costing components their entire Props
column in the reference. Components that live in a sibling's file — `AvatarGroup`,
`EmptyState*` — were invisible for the same reason, because lookup was by file basename.
Resolve declarations by type name, not by filename.

That throw only covers a `classNames` the generator *found*. Matching the declaration's
shape literally is the other half, and it failed silently: a component that names its slot
union through a local alias (`classNames?: Slots`) matched nothing, so three components lost
all of their keys with `--check` still green. Resolve an alias at every position a type can
appear, and treat "this component has no slots" as a claim worth doubting whenever the
library's own source shows a `classNames` prop.

## Theming

Never write an example theme name into a selector, type, default, config list, doc table or
fixture — invent one. `default` is the only theme the design system defines. A test asserts
the reference doc names none of them.

The reference doc's Theming section *inlines* the css package's theme contract — the token
tables and their invariants — so a document-authoring model needs no second source. That
mirror is hand-written prose, and the doc gate only regenerates the generated regions, so no
gate sees the upstream contract move. A css bump that touches the theme contract requires a
manual sweep of that section, the same way a peer bump requires sweeping the corpus against
the changelog. The mirror also carries renderer-only caveats the css doc rightly does not:
overrides are inline `--*` properties, so `color-scheme`, `@keyframes` and the 40rem
media-query step-ups are all unreachable from a document.
