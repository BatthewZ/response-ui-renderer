# Composing several documents on one page

One `ViewRenderer` is a component; N of them are a *composition*, and the failures that
appear only at N are all shared-namespace failures. Nothing throws, both documents are valid,
and the renderer is correct at each one individually.

## The DOM id namespace is the page, not the view

Author-supplied ids pass through verbatim on purpose — that is what lets a document wire its
own label to its own control. So two documents naming a control the same thing collide:
radios with a shared `name` become one browser-level group, and `htmlFor` resolves to the
first matching id in document order, not the nearest one. Component-internal ARIA wiring is
immune, because the library builds it from React's per-instance id hook.

The renderer state that *looks* like it needs namespacing mostly does not: form state, dialog
state and view state already live per instance. Keeping the DOM id and the state key separate
is what lets a document's actions go on naming the ids the document wrote, so prefer
separating them over rewriting payloads to match.

## Why a host cannot do this by walking the spec

The package already knows that a rule keyed on a prop's *name* has to decide on the prop's
*resolved value*. Id scoping is that rule again, and it is the case that proves the
architectural half: a host pre-pass runs before resolution, so it scopes the literal spelling
and silently misses `{"$ref": …}` — and when the value comes from an `api` binding, it does
not exist in any process at transform time. A pre-pass is not merely inconvenient there; it
is incapable.

## `name` means seven things, and only one of them is a DOM name

The obvious rule — "scope `name`, it groups radios" — corrupts an icon's identity, a person's
initials, two kinds of form path and a CSS `view-transition-name`, all silently. Whenever a
rule keys on a prop name that reads as generic, ask what *else* claims that name first.

The direction of the default is the whole design, and it is decided by which miss you can
afford, not by which list is shorter:

- Leave `name` alone unless it is *known* to be a DOM name → a miss leaves that component's
  radios merging. The pre-existing bug, which hosts already live with.
- Scope `name` unless it is *known* to be something else → a miss silently rewrites a value
  the author wrote, in a component that worked before the flag was set.

The populations differ in kind, too. The DOM-`name` set is closed and knowable: the components
that put `name` on a real form element. The semantic set is open — every component the library
may add, plus every component a host registers, which no gate here can see. Defaulting to
"scope it" means enumerating an open set forever, across a package boundary.

## What a scoped id namespace still cannot reach

Scoping rewrites what the document wrote, which is exactly wrong for a reference that points
*out* of the document: at the host's own `<form>`, or an `aria-labelledby` naming page chrome.
It also cannot separate rows within one document, because there is one scope per renderer.
Both are real limits rather than bugs, and both have to be written down where a consumer will
read them — a namespacing feature reads as total, and silence gets taken as coverage.
