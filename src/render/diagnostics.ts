/**
 * Every class the renderer marks a diagnostic with.
 *
 * The renderer never throws at a bad document — it renders a box saying what is
 * wrong and carries on. That makes "did anything go wrong?" a DOM question, and
 * this is the only answer to it: a corpus gate that looks for particular
 * *sentences* silently misses every diagnostic it did not think to name, and a
 * missing icon renders no text at all.
 *
 * A contract test asserts no shipped module spells one of these literally, so a
 * new diagnostic cannot be rendered without joining this list.
 */
export const RENDER_DIAGNOSTIC_CLASSES = {
  error: "rui-render-error",
  warning: "rui-render-warning",
  missingIcon: "rui-render-missing-icon",
} as const;

/** Matches any diagnostic, for `querySelectorAll`. */
export const RENDER_DIAGNOSTIC_SELECTOR = Object.values(RENDER_DIAGNOSTIC_CLASSES)
  .map((className) => `.${className}`)
  .join(", ");

/**
 * Every diagnostic under `root`, described well enough to act on. Falls back to
 * the class and icon name because a missing icon renders no text — asserting on
 * text alone is how one stayed invisible.
 */
export function findRenderDiagnostics(root: ParentNode): string[] {
  return [...root.querySelectorAll(RENDER_DIAGNOSTIC_SELECTOR)].map((element) => {
    const text = element.textContent?.trim();
    if (text) return text;
    const icon = element.getAttribute("data-icon-name");
    return icon === null ? String(element.getAttribute("class")) : `missing icon: ${icon}`;
  });
}
