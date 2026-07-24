import { Component, ErrorInfo, ReactNode } from 'react';
type Props = {
    label: string;
    children: ReactNode;
    onError?: (error: Error, info: ErrorInfo) => void;
};
type State = {
    message: string | null;
};
/**
 * Contains a throw to the node that caused it.
 *
 * Documents are typically machine-generated, so a component receiving props it
 * cannot handle is an expected condition, not an exceptional one. Without a
 * boundary per node, one bad prop blanks the entire view — and in a live
 * preview that reads as "the renderer is broken" rather than "this node is".
 */
export declare class NodeErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(error: unknown): State;
    componentDidUpdate(prev: Props): void;
    componentDidCatch(error: Error, info: ErrorInfo): void;
    render(): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | import('react').ReactPortal | import('react').ReactElement<unknown, string | import('react').JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | import("react").JSX.Element | null | undefined;
}
export {};
//# sourceMappingURL=NodeErrorBoundary.d.ts.map