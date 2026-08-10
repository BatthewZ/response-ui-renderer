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
typed as a component rather than a node; which components' `name` prop is a DOM form-control
name rather than the component's own vocabulary; that the reference doc matches a fresh
generation; that every live component has a category and is either exercised by the corpus or
excused with a reason; and that the counts quoted in the README are the counts the registry has.

## A filter inside a gate is an allowance, and nobody reviews it

The `name` classification gate reads the library for components declaring their own `name`,
and decided that with `name\?:` — requiring the optional marker. Nothing stated that choice
and nothing questioned it, but it inverted the gate: a `name` that is merely passed through to
a form element is optional, while one the component *depends* on tends to be **required**. The
filter removed exactly the population the gate existed to catch, and two components with a
semantic `name` sat unclassified while the suite stayed green — one of them rendered by the
corpus, its value silently rewritten.

A skip list is visible and gets argued over. A predicate that quietly narrows the input is an
allowance nobody can see, and it is worth more suspicion than the table it guards. When a gate
passes on the first run, make it print what it matched and read that list against the library
yourself — "it found no violations" and "it found nothing" print identically.

Two of these caught real drift the moment they were written — a generated cross-product named
three date props that do not exist, and the doc gate caught a stale table. That is the point.

## A security filter keyed on a name is an inventory, and an inventory needs an omission gate

Every other table here fails loudly when it is wrong: a coercion that no longer matches leaves a
date unparsed, and someone sees it. A table of *places to look for danger* fails silently and in
the safe-looking direction — the render succeeds, the page looks right, and the thing nobody
wrote down went through untouched.

The URL filter was one global list of prop names. Three components rename a URL on the way in and
all three reached a live `href` unexamined; one of them clicks the link itself, so it needed no
gesture. The same shape, twice more: the check ran only at the top level, so a URL inside a props
bag that gets spread onto the element was never seen; and `as` was unconstrained, so a document
could ask for `script` or `iframe` and skip URLs altogether.

Two lessons, and the second is the load-bearing one:

- **A drift test is not an omission test.** Asserting that every name in the table still resolves
  upstream catches a rename and nothing else. It cannot catch the entry that was never written,
  which is the only failure mode that matters for a table like this. The gate has to read the
  library and enumerate the sinks itself, then ask which of them nobody classified.
- **Prefer the question "can a document reach this?" over a skip list.** The sink scan finds two
  real non-findings — the router adapter, which is the indirection rather than a component, and a
  component that mints its own blob URLs and is already excused as not addressable. Both fall out
  of asking the registry and `NOT_ADDRESSABLE`, so neither is named in the gate, and a component
  that later becomes addressable re-arms the test on its own.

The tempting fix is to check the value everywhere and forget the name. Do not read that as
settled: checking the value *at the sink*, where it becomes an attribute, is the stronger shape
and this renderer cannot do it — the check runs at the document's prop-name entry point, one
stage before a component maps its props onto elements. That one-stage gap is the whole cost, and
it is paid in a specific currency: a prop-name check cannot tell a `<form action>` from a data
row's `action` field. Under a scheme *allowlist* that stops being theoretical, because ordinary
prose has a scheme — `"Approve: pending review"`, `"s3://bucket/key"`, `"Re: your ticket"`. Every
one of those was measured being deleted from a rendered table.

So the position is the key, but the position has to be qualified three ways, and each was learned
by measuring damage rather than by reasoning:

- **Only inside a bag the component spreads.** Nested keys are data; a bag's keys are attributes.
- **Only where the component does not say otherwise.** A prop typed `ReactNode` is content no
  matter what it is called, and one component names such a slot `action`.
- **Matching the name the way the DOM matches it**, which is case-insensitively. `HREF` is not a
  React prop, so it goes to `setAttribute` and the HTML parser lowercases it. This was the worst
  hole found anywhere in the exercise — worse than the reported one, which a browser rule had
  blunted — and it existed because the check compared strings the DOM does not.

Related, and the sharpest edge in the whole area: the scheme test should be an allowlist — every
bypass of the old three-scheme denylist was simply a fourth — but **flipping a denylist to an
allowlist converts every dormant false positive into a live one at the same instant.** A name that
was harmlessly on the list for years starts deleting content, because the old list matched three
strings and the new one matches everything unfamiliar. Budget for that when flipping: enumerate
what the list will now *refuse* before shipping it, not just what it will now catch. `sms:` and
`geo:` are refused as this stands, and they are the near-siblings of an allowed `tel:`.

One more, cheap to state and easy to miss: **the guard must read what React will put in the
attribute, not the type the document happened to use.** `href: ["vbscript:…"]` defeated a
`typeof value === "string"` test and landed in the DOM as that exact string — on a prop name the
filter already knew about.

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

## A derived view over gated tables is itself ungated

Every hand-maintained table here has a gate that fails when the library moves. Assembling
several of them into one per-component record has none: drop a fold and each table's own gate
goes on passing while the renderer silently stops doing something. The assembled view needs its
own test, asserting it carries every entry of every table it folds in. Note the residual risk
honestly rather than claiming it away: such a test iterates each table's *entries*, but the set
of tables is itself hand-listed beside the fold — they are a Map, a Set and several records, with
nothing to enumerate them by. Adding a fold means adding its assertion and nothing forces that,
so keep the two adjacent in one file where the omission is visible, and do not write prose
claiming a completeness the test cannot have.

The same asymmetry applies to the reference. `--check` regenerates and diffs, so it cannot see
whether the *committed* derived data agrees with the *committed* doc — it rewrites both sides
from one in-memory derivation. Read the two committed artifacts and relate them to each other.

It has a third face, which is the one that survives even after you have written that test. The
document is produced by splicing regions into a template, and the template is the committed
document, so every region already holds the right bytes before anything runs: a region the
renderer never writes is indistinguishable from one it writes correctly, and "reproduces the
shipped file byte for byte" goes green on a function that returns its argument. Prove a splice
by making its output legitimately differ — a scoped render — and check each region both ways,
equal to what the region renderer says and unequal to the unscoped document. A region no input
can vary cannot be proven at all, which is the signal to stop splicing it and gate it against
the data file it is curated in instead. See `memory/extending-the-registry.md`.

Two things that survive the fix and should be said plainly. The prose between the regions is
still compared against itself: delete a paragraph from the reference and the whole suite, plus
`--check`, stays green. Nothing here reads the prose, so no test covers whether it is correct or
complete, and a test comment claiming otherwise is worse than no test — it tells the next reader
the check exists. And `--check`'s *failure* direction is itself ungated: it is the only gate on
the derived JSON artifacts, and a mutation that makes it always report success passes the suite.

## A public constant needs a test that imports it the way a consumer does

`exports` carries no wildcard, so the barrel is the only spelling a consumer has — and every
internal test imports these tables by module path, which means deleting a line from the barrel
changed nothing anywhere. A table is only public if a test reaches it through the barrel and
asserts it is the same object the renderer binds.

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

## The RSC gate reads tokens, not meaning

The `"use client"` check matches `useState`, `useId` and friends as bare words anywhere in a
shipped file — **including a comment**. A pure module that merely *describes* a React hook is
told it needs the directive, and adding one would drag it across the boundary for nothing.
Reword the prose. Widening the gate to parse around comments would cost it the property that
makes it trustworthy: it cannot miss a real use.

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

Regeneration does not reach a count a *test* restates, though, and that is the bump failure
with the most misleading shape: the artifacts are correct, every gate that reads them is
green, and what fails is an assertion naming a number upstream just changed — one added prop
moved a component's prop count and a truncated-tail count with it. It reads like the bump
broke the renderer; nothing rendered differently. A count derived from the installed library
belongs in neither a test nor prose, because the committed artifact already carries it and is
already gated — restating it makes a second copy whose only behaviour is to fail on bumps.
Derive the tail from the contracts and assert the literal that is genuinely this package's own
decision, the cap. Keep the vacuity guard the literal was doing double duty as: an assertion
that the fixture is still wide enough to truncate, or the checks it fronts quietly stop
testing anything the day it is not.

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

## What no gate can see: a behaviour change with no type change

The sibling's most consequential releases can move every gate here by nothing at all. A change
that alters *where* a component puts something in the DOM, what a prop's existing value now
means, or how long a node stays mounted has no signature to notice: the generated reference
regenerates byte-identical, the types check, and the corpus renders green — correctly, because
none of those artifacts describes runtime behaviour. Green after a peer bump means "nothing we
model changed", never "nothing changed".

So the upstream changelog is the input, not the diffstat, and the sections that matter are
`Changed` and `Fixed` rather than `Breaking` alone. Read them for three shapes in particular,
each of which lands in this package's *prose* and nowhere else: a portal target moving, because
this package's docs make inheritance claims about the wrapper that only hold while portalled
content stays where it was; the meaning of a value a document can literally write, `null` above
all, since JSON can express it and a prop that quietly changed from "wait" to "no override"
flips a document from broken to working with nothing here to show for it; and a timing change,
which is invisible until a host's own tests advance a clock.

The corollary is the ordering. Docs describing an unreleased upstream are a bet on work that
may still change shape, so write them against the sibling's changelog once its bug rows are
closed, and land them in the same commit as the range bump — never before it, or the package
documents behaviour no installable combination provides.

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

Spell that list of naming conventions once. The component table kept its own narrower copy
and so disagreed with the pass that harvests value sets from the very same declarations: a
component declaring `XOwnProps` had its enumerated values in `prop-enums.json` and an empty
Props column in the reference at the same time. Every gate stayed green — the row existed,
it was simply blank — until a test related the two derived artifacts to each other. When one
generator writes two artifacts from one source, cross-check them; each alone only proves the
generator agrees with itself.

That throw only covers a `classNames` the generator *found*. Matching the declaration's
shape literally is the other half, and it failed silently: a component that names its slot
union through a local alias (`classNames?: Slots`) matched nothing, so three components lost
all of their keys with `--check` still green. Resolve an alias at every position a type can
appear, and treat "this component has no slots" as a claim worth doubting whenever the
library's own source shows a `classNames` prop.

## What a declaration cannot say goes in the curated note

A prop's type carries its shape and nothing else. Ranges, defaults and clamping are invisible
to it — `value: number` says nothing about the bar it drives being bounded by `max`, nor that
`max` is `100` when omitted — and a document author working from the table has no source to
learn it from. Those facts belong in the curated note, which is the one field a human writes
and which ships to consumers as `COMPONENT_NOTES` as well as into the reference.

State the mechanism, not a number a reader will overgeneralise: a range is `0`–`max`, and
what happens outside it is clamping, not an error. Writing "0–100" turns a default into a
rule and quietly deletes the rescaled case the library supports. Prefer, in order: a fact the
declarations can be made to carry upstream, then the note; never a hand-kept table that
restates something already derivable.

Typing the sentence straight into VIEWSPEC.md does not count as recording it. Everything
between the GENERATED markers is rewritten wholesale by the next `docs:viewspec`, so a hand
edit there survives exactly until the next peer bump and then vanishes with no gate saying
so — the doc's staleness check compares a regeneration against the file it just overwrote.

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

## The generated contracts describe the INSTALLED library, not the one next door

`prop-enums.json`, `component-docs.json` and VIEWSPEC.md are generated from
`node_modules/@batthewz/response-ui-react-components/dist/**/*.d.ts`. That directory is a real
installed package, not a link to a sibling checkout — so a prop added upstream in the same
working tree is invisible here until the new version is actually installed, and regenerating
before then produces artifacts that silently omit it.

Two consequences worth planning around rather than discovering:

- **Release order is fixed.** Upstream publishes first; only then can this package install it,
  regenerate, and have `docs:viewspec --check` mean anything. Bumping the peer range without
  reinstalling leaves a range that claims a version the artifacts were never generated against.
- **Green here is not proof the artifacts are current** if the installed copy was staged by
  hand to test a change ahead of publication. `--check` compares a generation against the same
  installed input, so it agrees with itself either way. The thing to verify after the real
  install is that regeneration is byte-identical — that comparison, and not the local green,
  is what says the two packages agree.
