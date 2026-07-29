/**
 * Normalizes whatever a component hands its callback into a storable value.
 *
 * Native controls report a DOM `ChangeEvent`. Many library controls re-type
 * `onChange`/`onValueChange` to `(value) => void` and call it with a bare
 * string, number, array or `Date` — `Slider`, `RangeSlider`, `NumberInput`,
 * `TagInput`, `SearchInput`, `MultiSelect`, `OTPInput`, `ColorPicker`,
 * `DatePicker`, `Pagination`, `Calendar`. Reaching for `target` on those threw
 * inside the handler, outside any error boundary, so the guard comes first.
 *
 * Shared by `$field` binding and by the `event` ref namespace so a document sees
 * the same value through either route.
 */
export function readReportedValue(reported: unknown): unknown {
  if (typeof reported !== "object" || reported === null || !("target" in reported)) {
    return reported;
  }
  const target: unknown = reported.target;
  if (target instanceof HTMLInputElement) {
    if (target.type === "checkbox") return target.checked;
    if (target.type === "radio") return target.value;
    if (target.type === "number" || target.type === "range") {
      if (target.value === "") return "";
      const num = Number(target.value);
      return Number.isNaN(num) ? target.value : num;
    }
  }
  if (typeof target === "object" && target !== null && "value" in target) {
    return target.value;
  }
  return reported;
}
