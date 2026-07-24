import { ComponentType, ReactNode } from 'react';
export type IconComponentProps = {
    size?: number | string;
    strokeWidth?: number;
    color?: string;
    className?: string;
    "aria-hidden"?: boolean;
    "aria-label"?: string;
};
/** A name → component map, e.g. lucide-react's `icons` export. */
export type IconSet = Readonly<Record<string, ComponentType<IconComponentProps>>>;
export declare function IconSetProvider({ icons, children, }: {
    icons: IconSet | undefined;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useIconSet(): IconSet | null;
/**
 * `"trending-up"`, `"trending_up"` and `"trendingUp"` all become `"TrendingUp"`.
 * Documents are typically machine-generated and inconsistent about casing;
 * failing on that would be needlessly brittle.
 */
export declare function normalizeIconName(name: string): string[];
export declare function lookupIcon(icons: IconSet | null, name: unknown): ComponentType<IconComponentProps> | null;
export type IconProps = IconComponentProps & {
    name: string;
};
/**
 * The one name in the JSON vocabulary that is not a response-ui export.
 *
 * It exists because response-ui components take `icon` props typed as
 * `ReactNode`, which JSON cannot express — without a name→component resolver,
 * every icon slot in the library is unreachable from a document.
 *
 * The icon set is injected rather than imported here so the core bundle stays
 * free of lucide's ~1600 modules. See `@batthewz/response-ui-renderer/icons`.
 */
export declare function Icon({ name, size, ...rest }: IconProps): import("react").JSX.Element;
//# sourceMappingURL=Icon.d.ts.map