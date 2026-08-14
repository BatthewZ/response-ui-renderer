# The builder

`ViewBuilder` composes a document by direct manipulation. What follows are the constraints
that keep it honest, not a description of its panels.

## It may not know anything about components

This is the whole of it. A drag-and-drop editor wants a catalogue — which components exist,
what props they take, which of those are variants, what can nest in what — and the package
already answers every one of those questions, for the renderer, the validator and the
reference alike. A second answer written for the builder would be a second source of truth
for the one thing this package exists to hold in one place, and it would be wrong the first
time a component changed upstream.

So: the palette is the registry, the variant buttons are `propEnums`, the `classNames`
fields are `slots`, the sections are `category`, the notes are the contract's notes. The
practical test of whether that has held is not a diff — it is whether a host's own
registered component gets the identical panel with nothing added anywhere. The demo page
registers one for exactly that reason.

The one fact none of the tables carried is what dropping a component should *produce*, and
a contract cannot hold it: a template is a composition, and a compound component that
arrives as a bare root cannot be assembled by dragging its parts in one at a time without
already knowing the order they go in. That comes from documents instead.

## A template lifted out of a document has to be resolved, not guessed

A corpus node is idiomatic precisely because it is bound. Lift it into a new document and
every `$ref` points at data that is not there, every `$field` names a form that was never
declared. Two things follow, and both were learned by rendering the results rather than by
reading them.

Resolve the bindings *where the document that holds the data is still in hand*. The
alternative — reaching a prop with a missing value later and filling it from its declared
type — produces a `Sparkline` handed the word "Values", because a prop with no row in the
prop tables has no type to read. Resolved against the source document it gets the nine
numbers the corpus author put there.

The loop is part of that: an `$each` names its rows and everything under it is written
against one of them, so lifting a node out of a loop means binding the alias to the first
row. Without it a whole class of node resolves to nothing.

**Children that are a *function's* must not be lifted at all.** They are written against
arguments the component supplies at runtime — the row a select is showing, the item a menu
is over — and one instance of them, unrolled, claims to be the first of a selection that is
empty. The component says so by name. The contract already knows which components those
are; a template drops their children and keeps the simple spelling.

## Which occurrence, and how much of it

The first occurrence of a component in a corpus is the wrong one, and obviously so once you
drop it: the first `Stack` in a document is that document's own root, so dragging one in
hands you somebody else's page. Prefer the smallest — and among those the smallest that
*has* children, because a container that arrives empty is both a worse starting point and,
since this is where "can things nest in it?" is read from, a container the builder would
then treat as a leaf.

A few components are only ever used around a whole page, so even their smallest occurrence
is that page. They need a budget, and pruning the deepest level repeatedly until it fits
keeps the skeleton and drops the contents — which is what a shell component's template
should have been.

## The canvas is the render, and the marking must not reach the document

Rendering the document for real is the only version worth building; the interesting part is
pointing at it. Teaching the renderer to mark up its output would be a published behaviour
change for every consumer. Copying the document with one extra prop per node before handing
it over is not: the components forward it to their root element the way they forward any
attribute, the renderer knows nothing about it, and the saved document never carries it.

What that buys is also what it costs. A component that does not forward unknown props is
simply not clickable — its parent is — which is why a structure tree that can reach every
node is not a convenience. And every element on the canvas belongs to the document,
including its buttons and links, so the click has to be taken and spent on the selection
while editing; handing the clicks back is a mode, not a bug fix.

## Both halves of a drag, and neither is the geometry

A drop is two questions: which third of a box the pointer is in, and whether the document
has anywhere to put that. They are separate because two of the three answers are frequently
impossible — a root has no siblings, and a node in a `$each` or `$cond` slot has none
either — and the honest thing to do with a pointer that is plainly over something is to nest
inside it, or inside the nearest thing above it that holds a list, rather than to show no
indicator and swallow the drop.

The failure that compiles, renders and is invisible until someone tries it: a canvas that
can be dropped *onto* but not picked up *from*. Dropping and dragging are wired separately,
and only one of them is exercised by adding a component. There is a test whose whole point
is that a rendered node can be picked up at all, because nothing else here would notice.

## Where it can be tested and where it cannot

jsdom has no layout: `elementFromPoint` answers nothing and every box is zero by zero. So
the drop geometry is tested as functions, and what is asserted through the component is
everything that survives having no viewport — that a palette entry adds what it says it
will, that the inspector edits the selection, that the theme panel writes to the document.
The keyboard path is not a lesser path here: it runs the same command the drag does, and it
is the only one some people have.

The sweep that earns its keep is the one that renders what dropping each component
produces. Three separate bugs — a word where an array belonged, a placeholder where an icon
name belonged, a required prop lost with the binding that supplied it — were all invisible
in the JSON and all obvious the moment something rendered them.

## A move is two corrections, and the second one deletes work

Removing a node before inserting it shifts more than the index. Every path that
reaches the destination by passing a *later sibling of the removed node* is off
by one from that moment on — so the ordinary drag, "pick this up and drop it in
the box below it", inserted into whatever slid up into the destination's place,
or into nothing at all, and the node was simply gone. `landingIndex` corrects the
index within one parent; `pathAfterRemoval` corrects the path to the parent. Both
are needed and they fire in different cases, which is why having only the first
looked correct in every test written for the first.

The two rules must have one home. The command layer had its own copy of the
index correction, spelled differently, and a version of the move command that did
nothing at all passed the whole suite: its only test asserted that a *refused*
move changes nothing, which an inert function satisfies for ever. A refusal test
and a performance test are not the same test.

## Refusing has to be visible, and free

Three things go wrong when a refusal is silent. The canvas paints "it will nest
here" over a target the drop is about to decline, which is the control that
visibly does nothing. A refused edit that rebuilds an identical tree lands in the
history, so Undo steps over something that never happened — the guard belongs
where the tree is built, not only where it is committed. And a refused edit that
reports "no selection" empties the inspector, so an aborted drag looks like a
deselection. Distinguishing "leave the selection alone" from "clear it" is one
optional field and it removes all three.

## Some damage leaves no trace at all

A node inside an `$each` is written against the row that loop names. Dragged out
of it, the document still conforms, still renders, and contains exactly as many
`$ref`s as before — the component simply draws nothing, for ever. No count, no
validator and no render diagnostic can see it, so the move is refused before it
happens, by comparing the aliases in scope where the node is against the aliases
in scope where it would land. This is the shape of every check worth writing
here: ask what a wrong answer would look like *afterwards*, and if the answer is
"exactly like the right one", the check has to be a guard instead.

## What it does not author, and why that has to survive an edit

Data bindings, forms, `$each` and `$cond` are outside it. A document that already has them
must keep them: they are walked, displayed and written back untouched, and the inspector
shows a bound prop as bound rather than putting a text field over it — a field rendered
there replaces a binding with a literal the moment it is focused and blurred.

## Templates carry real ids, and only ids are the editor's to rename

Insertion templates lifted from real documents bring their `id`s with them, so the second
drop of one puts the same id on the page twice — two `<label for>` aimed at one field. That
is a defect in the *document*, and renaming the copy is the editor's job, along with rewriting
any reference to the old id inside the same dropped subtree, or the dialog exists and nothing
can open it.

Resist widening that to any other prop, however similar the symptom looks. `name` is shared by
a radio group on purpose and `value` is data, so a dropped node that repeats one is a document
saying what it means. When the repeat causes a rendering problem, the problem is the
renderer's; an editor that edits valid data to make the renderer comfortable is silently
lying about what the author asked for.

## The chrome may wear a library component, and the cascade is why it fits

A panel that needs a disclosure, a menu or a control already has one upstream, and building a
second is the same duplication the palette exists to refuse — the behaviour, the heading
semantics and the keyboard handling are the expensive parts, and none of them are chrome. What
stops the seams showing is a cascade fact rather than a specificity fight: the builder's
stylesheet is unlayered, the library's rules are layered, and unlayered CSS outranks any layer
whatever the selectors weigh. So a chrome class on a component's slot simply wins. Nothing
here needs `!important`, and a rule reaching for one is describing a different bug.

The trap is on the other side of the same fact. An unlayered rule wins in *every* state,
including the ones the component only enters when open, hovered or checked — so restating a
property the component animates or toggles switches that behaviour off silently, and the
component still looks right in the state it was inspected in. Restyle the properties the
chrome actually owns — spacing, colour, type, size — and leave the ones carrying the state
alone.

## A palette is not an index, and the difference is most of its length

Offering every addressable name is what a registry is for, and it makes a poor thing to
build from. Roughly two in five of them are compound parts, and a part is not a choice
anybody browsing is making — it is the answer to a question you only have once you have
already put its parent down. Listing them anyway does not merely add length; every one of
them sits between the reader and a component they could actually start with, and the
categories that were supposed to make the list scannable fill up with them.

So a part belongs against the thing it is part of. Two details decide whether that
actually helps. It has to be found by walking *up* from the selection rather than by
reading the selection alone, because the moment you want a cell is while you are on a row
or on the text inside one, and almost never while the table itself is selected. And the
chips there must drop the parent from their face — under a heading that already names it,
the prefix is the one word on every chip carrying no information, and it is the word they
all begin with, which is the worst place to put it. The name a document spells still has
to be the *accessible* name: read out of context, `Row` is not a name anything can use.

## Which components lead has to be counted, not chosen

A palette that opens on the dozen components most documents are built from is worth more
than any amount of sorting, and the temptation is to write the dozen down. Don't: a
hand-kept list of favourites goes stale first, and — worse in a package whose whole claim
is that a host's components are first-class — it is a statement about how a library is
used that this package has no standing to make about somebody else's.

Count them out of the documents instead. Two things keep the count honest. Only components
written *more than once* can lead, or a corpus where everything appears once (which is what
a coverage corpus is by construction) yields an arbitrary top-N under a heading claiming
they are the ones you want; a corpus that repeats nothing should yield no section, and
saying nothing is the truthful outcome. And an occurrence is a node an author wrote, not a
node that rendered — counting renders makes whichever component happened to sit in the
longest loop look like the thing the library is built out of.

Check the cut lands on a cliff rather than inside a flat stretch, and assert the cliff
rather than the list: a limit that falls mid-run is drawing an arbitrary line and calling
everything above it essential.

## One arrangement, or a section becomes a different section mid-task

A leading section and a category list are two ways of placing the same component, and the
place has to be one place. Two failures follow from letting them diverge. Listing a
component in both is a duplicate accessible name and a reader wondering which one is the
real one. And arranging a *search's* results by a different rule from the browse list moves
things about underneath somebody mid-task — a section collapsed a moment ago is a different
section a keystroke later, and the state that tracks which are shut is now describing
sections that are not there. Arrange once, from one function, and hand it whichever entries
are on show.

## The panel knew where the drop would land, and only said so to a screen reader

A control's accessible name is a good place to put what it will do, and a bad place for it
to be the *only* copy. Where the next component lands had been computed and written into
every chip's label for as long as the palette existed, which meant the reader it never
reached was the one using the mouse. When a fact is already derived and already announced,
showing it costs a line — and the visible copy should then be hidden from assistive
technology, or the same sentence is read twice, once somewhere it cannot be acted on.

## A derivation scoped to a component's own name will silently drop its parts

The prop tables were read off the declarations under a component's own name, while the
compound parts were registered as addressable names and nothing else. Every part therefore
arrived with an empty table, and the inspector reported that as *the part declares no props
of its own* — which is what makes this kind of gap hard to see. An absent derivation and a
genuine absence render identically, so the panel was confidently stating something it had
never looked for, and the check that the reference stays up to date agreed, because the
generator dropped the props on both sides.

It matters most where it looks least important. A part is usually a wrapper that really does
declare nothing but `classNames`, so the empty tables read as plausible — but the exceptions
are the parts whose single prop is the entire reason a document names them, and an image
source is the whole of `MediaCard.Image`. The general rule: when a derivation is keyed on a
name, check what it does for every *kind* of name the registry holds, and prefer to fail
loudly on a name it cannot place over returning nothing for it.

## An invariant only bites over a population that carries data

Enriching a derivation is the thing most likely to make an unrelated test fail, and that is
the derivation working. The check that every insertion template fills every required prop had
been passing over the parts for as long as the parts declared no required props to fill — it
was true and empty. The moment the tables were real it found a palette entry requiring an
object that nothing could synthesise, which had been broken the whole time and would break in
the reader's hands rather than in the suite. Treat a new failure after a derivation change as
a discovery until proven otherwise, and be suspicious of an invariant whose population you
have never counted.

## Match a type by its meaning, not by its exact spelling

A control chosen by an exact match on `string` does not fire for `string|null`, and the value
falls through to whatever the last branch is — here a raw JSON box, on the one prop its
component exists to carry, so setting it meant typing the quotes. A union of a type with
nothing but absence is still that type to whoever fills the field in.

Where the *name* has to be consulted — a URL is a string that deserves its own control, and
only the name says which strings those are — gate it behind the declared type rather than
matching the name alone. `action` is a URL on a form element and a callback everywhere else,
and the declaration is the only thing that knows which.

## Whether a drop can succeed is derivable, so derive it

A palette entry that can only ever be dragged in to fail is worse than one that is not there,
and which entries those are is a fact about the contract and the template rather than a list
worth keeping: an entry whose template still lacks a required prop after seeding cannot land
in a usable state. Deriving it means a host's own component is judged by the same rule with
nothing taught here, and it moves on its own when the prop becomes optional or a template
gains a value for it — which a hand-written exclusion would not.

Say it out loud, though. Withholding is the right call and a component disappearing from a
palette with no explanation is the silent drop the rest of this package throws to prevent, so
name the entry and the prop that could not be filled. The same applies to the test: assert the
*rule* that every withheld name has a reason, not the list of today's names, or the test has
to be edited to agree with the upstream fix it should have been checking.
