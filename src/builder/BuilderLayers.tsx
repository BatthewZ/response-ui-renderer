"use client";

import { isComponentNode, isCondNode, isEachNode, isRefValue, type ViewNode } from "../spec";
import type { BuilderCatalog } from "./catalog";
import type { DragPayload } from "./drag";
import { childEntries, type NodePath, pathToKey, samePath } from "./tree";

/**
 * The document as a tree of rows.
 *
 * The canvas is the better place to point at most things and the worse place to
 * point at some: a container with no padding is a few pixels tall, a node behind
 * an overlay cannot be reached at all, and a component that does not forward
 * unknown props is not marked in the DOM to begin with. The tree can reach every
 * one of them, and it is also where the shape of a document is legible — which
 * is what someone building a nested layout is actually thinking about.
 */

export const LAYER_ROW_ATTR = "data-rui-builder-row";

type LayersProps = {
  root: ViewNode | null;
  catalog: BuilderCatalog;
  selection: NodePath | null;
  hovered: NodePath | null;
  onSelect: (path: NodePath) => void;
  onHover: (path: NodePath | null) => void;
  onDragStart: (payload: DragPayload, event: React.PointerEvent) => void;
};

/** What a row says a node is. */
export function describeNode(node: ViewNode): { label: string; kind: string; text?: string } {
  if (typeof node === "string") {
    return { label: node.trim() === "" ? "empty text" : node, kind: "text" };
  }
  if (isRefValue(node)) return { label: node.$ref, kind: "ref" };
  if (isEachNode(node)) return { label: `each ${node.$each}`, kind: "each" };
  if (isCondNode(node)) return { label: `if ${node.$cond}`, kind: "cond" };
  if (isComponentNode(node)) {
    const children = node.children ?? [];
    const text = children.every((child) => typeof child === "string")
      ? children.join("").trim()
      : undefined;
    const described: { label: string; kind: string; text?: string } = {
      label: node.component,
      kind: "component",
    };
    if (text !== undefined && text !== "") described.text = text;
    return described;
  }
  return { label: "node", kind: "unknown" };
}

export function BuilderLayers({
  root,
  catalog,
  selection,
  hovered,
  onSelect,
  onHover,
  onDragStart,
}: LayersProps) {
  if (root === null) {
    return <p className="rui-builder-empty-note">Nothing here yet. Drop a component on the canvas.</p>;
  }

  return (
    <div className="rui-builder-tree" role="tree" aria-label="Document structure">
      <LayerRow
        node={root}
        path={[]}
        depth={0}
        catalog={catalog}
        selection={selection}
        hovered={hovered}
        onSelect={onSelect}
        onHover={onHover}
        onDragStart={onDragStart}
      />
    </div>
  );
}

function LayerRow({
  node,
  path,
  depth,
  catalog,
  selection,
  hovered,
  onSelect,
  onHover,
  onDragStart,
}: {
  node: ViewNode;
  path: NodePath;
  depth: number;
} & Omit<LayersProps, "root">) {
  const described = describeNode(node);
  const children = childEntries(node);
  const selected = selection !== null && samePath(selection, path);
  const isHovered = hovered !== null && samePath(hovered, path);
  const draggable = path.length > 0 && typeof path[path.length - 1] === "number";

  return (
    <>
      <div
        className="rui-builder-row"
        role="treeitem"
        aria-selected={selected}
        aria-level={depth + 1}
        tabIndex={selected ? 0 : -1}
        data-selected={selected || undefined}
        data-hovered={isHovered || undefined}
        data-kind={described.kind}
        style={{ paddingInlineStart: `calc(${depth} * var(--rui-builder-indent) + var(--R-SIZE-6))` }}
        {...{ [LAYER_ROW_ATTR]: pathToKey(path) }}
        onClick={() => onSelect(path)}
        onPointerDown={(event) => {
          if (draggable) onDragStart({ kind: "move", path, label: described.label }, event);
        }}
        onPointerEnter={() => onHover(path)}
        onPointerLeave={() => onHover(null)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(path);
          }
        }}
      >
        <span className="rui-builder-row-name">{described.label}</span>
        {described.text !== undefined && (
          <span className="rui-builder-row-text">{described.text}</span>
        )}
        {described.kind === "component" &&
          catalog.acceptsChildren(described.label) &&
          children.length === 0 && <span className="rui-builder-row-hint">empty</span>}
      </div>

      {children.map((child) => (
        <LayerRow
          key={pathToKey([...path, child.step])}
          node={child.node}
          path={[...path, child.step]}
          depth={depth + 1}
          catalog={catalog}
          selection={selection}
          hovered={hovered}
          onSelect={onSelect}
          onHover={onHover}
          onDragStart={onDragStart}
        />
      ))}
    </>
  );
}
