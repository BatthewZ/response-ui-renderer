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

## The library's published tarball is not its working tree

Its `docs/` are in `files`, but a given published version may predate a docs rewrite. Derive
from `dist/**/*.d.ts` and the live barrel, which are always present and are the actual
contract for the peer range. Authoring against the sibling repo's working tree produces props
that do not exist in the version consumers install.

## Theming

Never write an example theme name into a selector, type, default, config list, doc table or
fixture — invent one. `default` is the only theme the design system defines. A test asserts
the reference doc names none of them.
