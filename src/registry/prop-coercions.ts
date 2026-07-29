/**
 * Props the library types with something JSON cannot express, and the smallest
 * translation that makes them reachable from a document.
 *
 * Keyed `"Component.prop"` the way `COMPONENT_TYPED_ICON_SLOTS` is, and gated
 * the same way: `contracts.test.ts` asserts every component named here still
 * exists upstream, so a rename fails the suite rather than a consumer's page.
 */
export type PropCoercion = "isoDate" | "isoDateRange" | "keyAccessor" | "columnDefs";

/**
 * Every `Date`-typed prop, per component. Spelled out rather than generated
 * from one list because the four do not agree: only the two calendars take a
 * `month`, and `DatePicker` takes neither it nor `defaultMonth`. A generated
 * cross-product named three props that do not exist, which the contract test
 * caught — the shape of the table has to match the library, not be tidy.
 */
const DATE_PROPS: Readonly<Record<string, readonly string[]>> = {
  Calendar: ["value", "defaultValue", "min", "max", "month", "defaultMonth"],
  DatePicker: ["value", "defaultValue", "min", "max"],
  RangeCalendar: ["min", "max", "month", "defaultMonth"],
  DateRangePicker: ["min", "max", "defaultMonth"],
};

/** Components whose `value`/`defaultValue` is a `{ start, end }` pair. */
const RANGE_VALUE_COMPONENTS = ["RangeCalendar", "DateRangePicker"];

function buildCoercions(): Map<string, PropCoercion> {
  const table = new Map<string, PropCoercion>();

  for (const [component, props] of Object.entries(DATE_PROPS)) {
    for (const prop of props) table.set(`${component}.${prop}`, "isoDate");
  }
  for (const component of RANGE_VALUE_COMPONENTS) {
    table.set(`${component}.value`, "isoDateRange");
    table.set(`${component}.defaultValue`, "isoDateRange");
  }
  for (const component of ["DataTable", "VirtualizedDataTable"]) {
    // `rowKey` is REQUIRED and is a function, so without this neither component
    // can be instantiated from a document at all.
    table.set(`${component}.rowKey`, "keyAccessor");
    table.set(`${component}.columns`, "columnDefs");
  }

  return table;
}

export const PROP_COERCIONS: ReadonlyMap<string, PropCoercion> = buildCoercions();

/** Components named by PROP_COERCIONS, for the drift test. */
export const PROP_COERCION_OWNERS: readonly string[] = [
  "Calendar",
  "DatePicker",
  "RangeCalendar",
  "DateRangePicker",
  "DataTable",
  "VirtualizedDataTable",
];

export function propCoercion(component: string, prop: string): PropCoercion | undefined {
  return PROP_COERCIONS.get(`${component}.${prop}`);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `"2026-06-14"` → that day in the viewer's own timezone.
 *
 * Built from local calendar fields rather than parsed as UTC: the library's own
 * date inputs emit and submit local `YYYY-MM-DD`, so parsing as UTC would shift
 * the selected day by one for anybody west of Greenwich.
 *
 * A date that does not exist (`"2026-02-30"`) is returned untouched rather than
 * silently rolled forward into March.
 */
export function parseIsoDate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const match = ISO_DATE.exec(value);
  if (!match) return value;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  const roundTrips =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return roundTrips ? date : value;
}

/** `{ start: "2026-06-14", end: "2026-06-21" }` → a `DateRange` of real dates. */
export function parseIsoDateRange(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const range = value as Record<string, unknown>;
  if (!("start" in range) && !("end" in range)) return value;
  return {
    ...range,
    start: range.start == null ? null : parseIsoDate(range.start),
    end: range.end == null ? null : parseIsoDate(range.end),
  };
}

/**
 * `"id"` → `(row, index) => row.id`, falling back to the index.
 *
 * The fallback matters: a document cannot know that every row really carries the
 * column it named, and a duplicate or undefined key silently corrupts React's
 * reconciliation rather than throwing.
 */
export function toKeyAccessor(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return (row: unknown, index: number): string | number => {
    if (typeof row === "object" && row !== null && Object.hasOwn(row, value)) {
      const key = (row as Record<string, unknown>)[value];
      if (typeof key === "string" || typeof key === "number") return key;
    }
    return index;
  };
}
