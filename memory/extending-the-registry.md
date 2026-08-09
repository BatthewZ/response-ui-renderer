# Extending the registry, and why the metadata had to travel with it

The registry answers one question — what does this name render? — and for a long time that was
mistaken for the whole extension story. Every *other* rule the renderer applies was keyed on a
component name in a frozen module-level table, and every one of those tables listed only the
peer library. So a host could register a component, watch it render, and never learn that it
was getting no prop coercion, no function- or text-children handling, no dialog ownership, no
per-component validation and no row in any reference. Nothing failed. That is the shape of the
failure: an extension point that is real for the thing it names and absent for everything the
thing needs.

The repair is one record per **addressable name** — the same spelling the registry and a
document use, dotted parts included — holding every fact the package knows about a component
beyond how to construct it. It is passed to the renderer, the validator and the reference
generator, so declaring a component once is the whole act.

## The knowledge is a view over the tables, never a second copy

Each hand-maintained table is either generated from the library's declarations or gated against
them. Restating them in the new shape would create exactly the drift the gates exist to catch,
so the assembled record is *computed* from them and the tables stay the source and stay
exported. What that leaves exposed is the assembly: drop a fold and every table's own gate still
passes while a behaviour quietly disappears. The assembled view therefore needs its own gate,
asserting it carries each table entry for entry. Whenever you derive one artifact from several,
the derivation is the part nothing else is watching.

## Two rules resisted the move, and saying so is part of the change

Three of the five per-component validation rules became contract-driven. Two did not: a
component whose *bare-form* binding spelling is special, and the parents that decide something by
comparing a child's element type. Both encode structure — which child, which prop — rather than
data, so a contract field for them would have to carry a predicate, and a warning that fires
where an author can do nothing about it is a warning they learn to ignore.

The trap is not the boundary; it is writing prose that forgets the boundary exists. Documentation
drafted while the general case is fresh reaches for "exactly the way the library's own are" and
ships an absolute claim over a partial delivery. When you deliberately leave something out, the
sentence naming what stayed behind belongs in the same commit as the thing you built — in the
public docblock, not only in a note like this one.

## An exported helper that explains a rule must read the rule

`enumeratedValues` existed to tell a prompt builder what a bounded prop accepts, and read the flat
table directly. The moment the validator started reading the merged record instead, the two
disagreed for exactly the components the change existed to serve. Whenever a check moves to a new
source, sweep for the *other* exported functions that answer the same question — a second source
of truth is easiest to create at the moment you are eliminating one.

## Merge per field, and never globally

A registration API invites two mistakes. The first is replacing a component's whole record when
the caller only meant to add to it — attaching a note must not erase the value sets. Merge per
field; a field the caller supplies replaces that field whole, because a partial set is
indistinguishable from a complete one.

The second is a global `register()`. It looks friendlier and it is ordering-dependent,
untestable in isolation, and impossible for two renderers on one page to disagree about. Keep
the extension a *value* passed to the same call that already takes the registry.

## Severity is decided by the mirror, not by how bad the mistake is

An unknown component name is the most useful thing validation can report, and it is still a
warning rather than an error, because `ok` must mean conformance and nothing else — the Zod
mirror cannot know a registry, and the two must agree on `ok`. Anything that depends on what a
host registered belongs in the warning tier by construction. When a new check tempts you toward
`error`, the question is not how serious it is but whether a validator with no registry could
reach the same verdict.

Name checking is also opt-in for a reason that generalises: with no registry supplied there is
no way to tell a typo from a component the validator was simply never told about, and inventing
warnings for a host's own components is worse than staying quiet.

## Every position a node can appear in is a position that needs checking

A prop may hold a whole node — the format has a marker for it — and the renderer renders it
through the same path as a child. The validator walked children and control-flow branches and
stopped there, so a typo inside one validated clean while producing precisely the inline runtime
warning validation exists to pre-empt. When a format lets one construct appear in two places, a
check written for one place is half a check; find the render path's own recursion and mirror its
shape, including its depth cap.

## A suggestion is worth more than a verdict, and transposition is the case

"Unknown component" leaves an author re-reading a hundred-name catalogue. The nearest registered
name turns the message into a fix. Use optimal string alignment rather than plain Levenshtein:
an adjacent transposition is the commonest typo there is and costs *two* substitutions under
plain Levenshtein, so the one shape a generator most often produces would be the one shape that
got no suggestion. Suggest a compound part only for a compound part — a root component cannot go
where a part was asked for.

## Ship a renderer of declared facts, not a scraper of someone else's types

The obvious way to let a host document its own registry is to ship the doc generator and let it
be pointed somewhere else. Don't. The generator's value is `.d.ts` parsing calibrated to one
library's declaration conventions, and it throws on shapes it cannot place — behaviour that is
correct here and unkeepable as a promise to a foreign library.

Split it instead: the script *derives* facts and writes them as data; a shipped function
*renders* those facts as markdown. The reference doc is then produced by calling the shipped
function, so a host's components are documented by the identical code and there is no second
renderer to drift. It also buys a strong check on any refactor of the formatting — the committed
doc must regenerate byte for byte — and a gate that reads the two committed artifacts and relates
them, which the generator's own `--check` cannot do because it rewrites both sides from one
derivation.
