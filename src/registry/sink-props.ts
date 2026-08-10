import { slotOwners } from "./slot-keys";

/**
 * Props that decide what the browser *does*, spelled with a name of the
 * component's own choosing.
 *
 * Two families, one mistake. A filter keyed on the arriving prop name only ever
 * sees the names it was told about, so a component that renames a URL or an
 * element on the way in is invisible to it — and the universal names (`href`,
 * `as`) are the ones every such filter starts with. Both tables below exist
 * because that is precisely what happened: three renamed URLs and three renamed
 * element pickers reached the DOM unexamined.
 *
 * Keyed `"Component.prop"` the way `COMPONENT_TYPED_ICON_SLOTS` is. Unlike that
 * table, an omission here is a security hole rather than a broken render, so
 * `contracts.test.ts` gates these in *both* directions: every name still
 * resolves upstream, and every upstream prop that feeds one of these sinks is
 * named here. The second gate is the one that matters — the first only catches
 * a rename, and it was never a rename that let these through.
 */

/**
 * URL-carrying props the library does not spell with a DOM attribute's name.
 *
 * All three become an `href`. `RequireAuth.redirect` is the sharpest of them:
 * the component renders a hidden link and clicks it in an effect, so its value
 * navigates on render with no user gesture at all.
 */
export const RENAMED_URL_PROPS: ReadonlySet<string> = new Set([
  "AppShell.SidebarLink.to",
  "RequireAuth.redirect",
  "Swimlane.viewAllHref",
]);

/**
 * Props that name the host element to render, spelled as something other than
 * `as`.
 *
 * The library types each of these as a heading union, so upstream they cannot
 * be anything but `h1`–`h6`. That is a *type*, and a document has no compiler:
 * `titleAs: "script"` type-checks nowhere and rendered a `<script>` anyway. The
 * enum check that covers them is a warning by deliberate design — `ok` means
 * conformance — so it cannot be what stops this.
 */
export const RENAMED_ELEMENT_PROPS: ReadonlySet<string> = new Set([
  "AppShell.SidebarSection.titleAs",
  "Swimlane.titleAs",
  "Timeline.Item.titleAs",
]);

/**
 * Props interpolated into a tag name rather than being one.
 *
 * `Accordion` builds its heading as `` `h${headingLevel}` ``, so the document
 * supplies a fragment. `headingLevel: "eader"` rendered a `<header>` and
 * `headingLevel: "1><img src=x onerror=…>"` a render-error box — the `h` prefix
 * caps this well short of script execution, which is why it is a third table
 * and not a second `elementProps` entry: the value is a level, so the element
 * allowlist would reject every legitimate use of it.
 */
export const HEADING_LEVEL_PROPS: ReadonlySet<string> = new Set(["Accordion.headingLevel"]);

/**
 * Props whose name is a URL attribute's but whose value is content.
 *
 * `ActivityFeed.Item.action` is typed `ReactNode` — it is the row's trailing
 * slot, and `action: "approved: build 42"` is a sentence. The universal name
 * check cannot tell it from `<form action>`, and under a scheme allowlist
 * ordinary prose *has* a scheme, so the slot came back empty. The old denylist
 * hid this: `approved:` was not one of its three.
 *
 * Gated in the omission direction like the others: `contracts.test.ts` reads
 * the library for props named like a URL attribute and typed as content, and
 * fails when one is not named here.
 */
export const CONTENT_PROPS: ReadonlySet<string> = new Set(["ActivityFeed.Item.action"]);

/** Components named by either table, for the drift tests. */
export const RENAMED_URL_PROP_OWNERS = slotOwners(RENAMED_URL_PROPS);
export const RENAMED_ELEMENT_PROP_OWNERS = slotOwners(RENAMED_ELEMENT_PROPS);
