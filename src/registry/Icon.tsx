"use client";

import {
  type ComponentType,
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from "react";

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

const IconSetContext = createContext<IconSet | null>(null);

export function IconSetProvider({
  icons,
  children,
}: {
  icons: IconSet | undefined;
  children: ReactNode;
}) {
  const value = useMemo(() => icons ?? null, [icons]);
  return <IconSetContext.Provider value={value}>{children}</IconSetContext.Provider>;
}

export function useIconSet(): IconSet | null {
  return useContext(IconSetContext);
}

/**
 * `"trending-up"`, `"trending_up"` and `"trendingUp"` all become `"TrendingUp"`.
 * Documents are typically machine-generated and inconsistent about casing;
 * failing on that would be needlessly brittle.
 */
export function normalizeIconName(name: string): string[] {
  const candidates = new Set<string>([name]);
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  if (pascal) {
    candidates.add(pascal);
    candidates.add(pascal.charAt(0).toUpperCase() + pascal.slice(1));
  }
  return [...candidates];
}

export function lookupIcon(icons: IconSet | null, name: unknown): ComponentType<IconComponentProps> | null {
  if (!icons || typeof name !== "string" || name.length === 0) return null;
  for (const candidate of normalizeIconName(name)) {
    if (Object.hasOwn(icons, candidate)) return icons[candidate];
  }
  return null;
}

export type IconProps = IconComponentProps & { name: string };

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
export function Icon({ name, size = 24, ...rest }: IconProps) {
  const icons = useIconSet();
  const Resolved = lookupIcon(icons, name);

  if (!Resolved) {
    return (
      <span
        className="rui-render-missing-icon"
        role="img"
        aria-label={typeof name === "string" ? name : "icon"}
        data-icon-name={String(name)}
      />
    );
  }

  return <Resolved size={size} aria-hidden {...rest} />;
}
