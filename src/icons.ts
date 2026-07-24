import { icons } from "lucide-react";

import type { IconSet } from "./registry/Icon";

/**
 * The full lucide set (~1600 icons), ready for `<ViewRenderer icons={…} />`.
 *
 * Deliberately a separate entry point. A document can name any icon, so
 * resolving names at runtime needs the whole map — but a consumer who never
 * renders an `Icon` node should not pay for it, and the design system's stated
 * position is that you pay only for the layer you use.
 *
 * For a smaller bundle, pass a curated map instead:
 *
 * ```ts
 * import { Check, X, TrendingUp } from "lucide-react";
 * <ViewRenderer spec={spec} icons={{ Check, X, TrendingUp }} />
 * ```
 */
export const lucideIcons = icons as unknown as IconSet;

export type { IconSet } from "./registry/Icon";
