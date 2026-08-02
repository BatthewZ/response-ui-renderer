# Authoring documents that look like products

Lessons from designing the example corpus against real rendered output. They apply to
any ViewSpec this package renders, not just the shipped examples.

## Theme overrides do not reach the page

`themeOverrides` land on the view's wrapper, so the host's `<body>` keeps the `:root`
canvas. A full-page document that overrides to a dark palette therefore renders light
gutters, and its light-on-dark headings sit invisibly on the host's light body. The
document must paint its own floor: put `bg-canvas` plus a min-height utility on the
root node. This is a document concern, not a renderer bug — the wrapper must stay
transparent so small embedded views don't stamp background rectangles into host pages.

## A coherent override palette is all-or-nothing

Overriding to dark means overriding the whole coupled set from the theme contract —
canvas, all four surface rungs (keeping their order), all text roles, borders, both
fill pairs with their `on-*` text, the status pairs, and deeper shadows. A partial set
leaves some component reading a default token and produces one unreadable region.

## Component defaults that fight a polished layout

- `Timeline` defaults to the centred alternating layout; inside a narrow column it
  crushes into slivers. Pass a side alignment.
- `Badge` draws a per-variant status glyph by default. When variants are used as
  taxonomy colours rather than statuses, null the icon or every label reads as a
  warning.
- A horizontal `Divider` inside an `items-center` flex column collapses to zero width
  (nothing stretches it); stretch it back explicitly.
- Grid cells stretch row-height; a short card beside a tall one grows hollow. Top-align
  the grid when the cards' contents differ in kind.
- The spacing scale is inverted — `r1` is the largest step. A "small icon chip" sized
  with `r1` is enormous.

## Verifying visually

The dev harness renders any example full-page (no playground chrome) via the `view`
query parameter, with `theme`/`mode` also accepted — screenshot that, not the split
playground. A document being edited in the playground reaches the same route through
the playground's own full-page link, so an uncommitted draft can be judged the same
way. Two traps when judging screenshots: a hero image still loading looks like
a broken design (check `img.complete` before concluding), and a computed style can
disagree with your reading of the pixels — sample the pixels before "fixing" colours.

## The corpus needs an icon set

Documents in the corpus use `Icon` nodes, so anything rendering them for real (tests
included) must inject an icon set; without one every icon degrades to a missing-icon
diagnostic and a no-diagnostics assertion fails.
