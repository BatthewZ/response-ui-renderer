# The dev harness

The harness is the package's only visual surface, and it is published — it is shown to
people evaluating the package, not just to whoever is editing the renderer. What follows
are the constraints that keep it honest, not a description of its layout.

## The prose pages are documents, and that is the point

The site's written pages are not a documentation feature bolted beside the demo: each one
is a ViewSpec handed to the same `ViewRenderer` the playground previews into, composing
the same registry a consumer's document reaches. That is the claim the package makes,
stated in the only form that cannot be exaggerated — if rendering a document from JSON
stopped working, the reference explaining how to do it would stop rendering.

It follows that the pages may not reach for anything a consumer's document could not. A
host-side special case for prose — a markdown branch in the renderer, a documentation
component, a prop the registry does not derive — would quietly turn the demonstration into
an assertion. What the host may legitimately do is what any host does: supply the data. It
imports the markdown, splits it, and binds it, exactly as it would bind anything else.

Two consequences worth keeping: the component library renders no heading ids, so anchors
have to come from wrappers the *document* creates, which is why the source is sectioned
before it is bound rather than parsed whole. And a link inside parsed prose is an ordinary
anchor, never the `navigate` action — a link naming a repository file walks a reader off a
site that only deploys the rendering, so those are rewritten to page URLs before parsing.

## The frame outlives the page, and pages must not draw chrome

Following a link between pages used to be a real page load, which rebuilt the whole shell:
the top bar flashed, its controls lost what they were holding, and the theme was re-read
from storage every time. A frame that owns the bar and swaps only what is under it fixes
all three, and costs the URLs nothing — a plain left-click is intercepted and pushed, so
every page is still a real URL that cold-loads, is shareable, and needs no rewrite rule.

Two rules come out of it. A page renders no chrome of its own: a page that draws the top
bar is a page that throws it away, so a page with controls of its own hands them to the
frame instead. And the interception stays narrow — a modified click, a middle click, a link
with a `target`, a URL naming no page — because the whole point of the `href` being real is
that everything a real link does still works.

What the browser used to do for free now has an owner, and it is the frame. A swap leaves
the scroller exactly where the last page left it, so the next one opens partway down
unless something resets it; a fragment is only ever acted on at load, when the document it
names is still JSON that has not been rendered; and focus stays on the link that was
followed, so a reader on a screen reader is told nothing happened at all. Arriving at a
page is a single behaviour and belongs wherever the navigation does — not spread across
the pages, each of which would owe it and one of which would forget.

## Its chrome is built from the design system, and that is load-bearing

Every colour, radius, shadow and duration in the harness is a token, and its controls
are the library's own components. That is not tidiness: in `root` theme mode a document's
theme is written to `<html>`, so the shell repaints along with the render, and the
difference between the two theme modes becomes something you can see rather than read
about. A raw hex anywhere in the harness breaks that demonstration silently — the shell
simply stops following the theme, and nothing fails.

The same reason forbids naming an example theme in harness code. Its picker reads the
list the library exports for exactly this purpose; a hardcoded name would give the
shipped examples a privilege a consumer's theme cannot have.

## A width-constrained preview cannot show a narrow-viewport render

Rendering the view inside a fixed-width box looks like a device preview and is not one:
the design system's breakpoints, and every `sm:`-style utility a document uses, are
*viewport* media queries. A 390px box in a 1600px window still gets desktop layout, so
the preview shows a squeezed desktop rather than the phone rendering it appears to
promise. Honest device preview needs an iframe, which in turn needs the stylesheets
cloned into it and `root` theme mode taught about the frame's own document — pay that
price deliberately or leave the feature out. Resizing the window on the full-page route
is the truthful cheap version.

## A scroll container holding a rendered document must also be a containing block

`overflow` clips, but it does not anchor. The library's visually-hidden text — a badge's
status word, a copy button's live region — is `position: absolute` with no offsets, so
without a positioned ancestor it resolves against the viewport, slips straight through
the clip, and stretches the *page* to the height of content that is scrolled out of
sight. The symptom is a second scrollbar on the window and a run of blank canvas below
the app, proportional to how tall the document is; it looks like a layout bug in the
document and is not one. Any pane that scrolls a render needs `position: relative`
alongside its `overflow`. This is not specific to the harness — a host embedding
`ViewRenderer` in a scrolling panel owes its container the same.

## The prose pages have one measure, and the pane that scrolls them hides the proof

Every block on a prose page fills the container: paragraphs, tables and code blocks share
both edges, and the container is the only place to change how wide the page reads. Giving
prose a narrower reading measure of its own was tried and removed — it is defensible
typography and it reads as ragged, because the eye tracks the mismatch between a
paragraph's right edge and the code block's below it rather than the line length.

The same pane that scrolls a document also conceals what a document does wrong at a phone's
width. A pane with `overflow-y: auto` computes `overflow-x` to `auto` as well, so it
absorbs a horizontal overflow that never reaches the window: `documentElement.scrollWidth`
equals its `clientWidth` while the content plainly drags sideways. Measure the pane, not the
document element — and attribute the overflow by toggling the candidate CSS and diffing
`scrollWidth - clientWidth` per block, since every table and code block on the page is
legitimately wider than its box and a right-edge scan returns all of them.

## Both full-page routes matter

The `view` query parameter renders one document with no chrome — that is how the corpus
is visually verified, and how a screenshot of a document is taken. It resolves committed
examples by name, and one reserved name that renders whatever the editor currently holds,
handed over through `localStorage` (a document is far past a URL's practical length, and
a tab opened with `rel="noreferrer"` does not inherit `sessionStorage`). Changing either
route breaks the visual-verification workflow described in
[authoring-documents.md](authoring-documents.md).

## The harness is covered by the gates

`dev/` is inside the TypeScript project and is linted alongside `src/`, so `bun run
typecheck` fails on a broken harness, and the no-suppressions gate reads it too — a
suppression there would otherwise silence a gate that now applies. The dependency and
import gates deliberately stop at `src/`: the harness may use devDependencies the
published package must not. It is still excluded from the published tarball —
it is a demo, not API — and its build output is ignored, so `dev:build` is only ever a
check that the thing compiles.

The test runner reaches `dev/` as well, but only where the harness holds logic rather than
layout. Deriving an outline from a document that is itself regenerated is the case that
earned it: a heading that moves inside a code fence would split a page mid-fence and render
the remainder as code, and compiling proves nothing about that. Assertions there are worth
writing against an oracle computed a different way — re-walking the source the way the
splitter walks it produces a test that agrees with the bug.

Which clicks the frame takes over is the second case, and it is the more slippery one:
swallowing too much and swallowing too little both compile, both render, and neither shows
up until someone tries to open a page in a new tab. A cancelled click and a click left to
the browser are the same assertion read from either side, so the discrimination itself is
what the test states — including that the bar is the same node afterwards, which is the
whole reason the frame exists.
