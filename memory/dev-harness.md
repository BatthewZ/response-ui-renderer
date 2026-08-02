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
