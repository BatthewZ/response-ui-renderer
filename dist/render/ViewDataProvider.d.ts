import { ReactNode } from 'react';
import { RendererAdapters } from '../adapters/types';
import { DataBinding } from '../spec/types';
import { FormState } from './form-state';
export type ViewContext = {
    data: Record<string, unknown>;
    forms: Record<string, FormState>;
    /** `$each` aliases plus `state` from the `setState` action. */
    vars: Record<string, unknown>;
    dialogStates: Record<string, boolean>;
    dataErrors: string[];
    dataLoading: boolean;
};
export declare function useViewData(): ViewContext;
type ViewDataProviderProps = {
    dataBindings?: Record<string, DataBinding>;
    adapters: RendererAdapters;
    forms: Record<string, FormState>;
    viewState: Record<string, unknown>;
    dialogStates: Record<string, boolean>;
    children: ReactNode;
};
export declare function ViewDataProvider({ dataBindings, adapters, forms, viewState, dialogStates, children, }: ViewDataProviderProps): import("react").JSX.Element;
/** Layers `$each` iteration variables onto the surrounding context. */
export declare function ViewContextExtender({ vars, children, }: {
    vars: Record<string, unknown>;
    children: ReactNode;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=ViewDataProvider.d.ts.map