/**
 * Slot tables are keyed `"Component.prop"`, or `"Parent.Child.prop"` for a
 * compound part. This is the one place that spelling is parsed.
 */

/**
 * The component half of each key, deduplicated — the input every drift test in
 * `contracts.test.ts` needs. Derived rather than restated alongside each table,
 * so a guard list cannot fall behind the table it guards.
 */
export function slotOwners(keys: Iterable<string>): readonly string[] {
  return [...new Set([...keys].map((key) => key.slice(0, key.lastIndexOf("."))))];
}
