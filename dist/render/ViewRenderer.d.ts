import { RendererAdapters } from '../adapters/types';
import { IconSet } from '../registry/Icon';
import { ComponentRegistry } from '../registry/types';
import { ViewSpec } from '../spec/types';
import { ThemeMode } from './ViewThemeScope';
export type ViewRendererProps = {
    spec: ViewSpec;
    /** Host wiring for navigation, toasts, network and named data sources. */
    adapters?: RendererAdapters;
    /** Defaults to every `@batthewz/response-ui-react-components` export + `Icon`. */
    registry?: ComponentRegistry;
    /** Name → component map for `Icon` nodes and string-valued `icon` props. */
    icons?: IconSet;
    /** Overrides `spec.theme` — for a host-level theme picker. */
    theme?: string;
    /** Where `data-theme` is written. See ThemeMode; `"root"` by default. */
    themeMode?: ThemeMode;
    /** Class on the view's wrapper element. */
    className?: string;
    /** Hides the built-in loading bar and data-error banner. */
    hideDiagnostics?: boolean;
};
/**
 * Renders a ViewSpec document as response-ui components.
 *
 * Mountable anywhere: it needs no router, no ToastProvider and no server. Those
 * are supplied — or not — through `adapters`.
 */
export declare function ViewRenderer({ spec, adapters, registry, icons, theme, themeMode, className, hideDiagnostics, }: ViewRendererProps): import("react").JSX.Element;
//# sourceMappingURL=ViewRenderer.d.ts.map