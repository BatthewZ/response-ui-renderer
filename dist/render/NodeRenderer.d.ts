import { ComponentRegistry } from '../registry/types';
import { ViewNode } from '../spec/types';
import { EventHandlerContext } from './event-handler';
type NodeRendererProps = {
    node: ViewNode;
    registry: ComponentRegistry;
    eventContext: EventHandlerContext;
    depth?: number;
};
export declare function NodeRenderer({ node, registry, eventContext, depth }: NodeRendererProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=NodeRenderer.d.ts.map