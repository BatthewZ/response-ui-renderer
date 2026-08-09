import { slotOwners } from "./slot-keys";

/**
 * Icon slots that want a component TYPE rather than an element.
 *
 * Most of the library types its icon slots `ReactNode`, so a document's
 * `icon: "Check"` becomes `<Icon name="Check" />`. `AppShell.SidebarLink` types
 * its slot `LucideIcon` and calls it as `<Icon />` internally — handing that one
 * an element throws "Functions are not valid as a React child"'s inverse:
 * React tries to invoke an object as a component.
 *
 * Keyed by `"Component.prop"` (or `"Parent.Child.prop"`). Hand-maintained, and
 * therefore drift-prone — `contracts.test.ts` asserts every component named
 * here still exists, so a rename upstream fails the suite instead of failing
 * silently in a consumer's browser.
 */
export const COMPONENT_TYPED_ICON_SLOTS: ReadonlySet<string> = new Set([
  "AppShell.SidebarLink.icon",
]);

/** Components named by COMPONENT_TYPED_ICON_SLOTS, for the drift test. */
export const COMPONENT_TYPED_ICON_OWNERS = slotOwners(COMPONENT_TYPED_ICON_SLOTS);
