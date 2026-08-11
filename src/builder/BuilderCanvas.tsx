"use client";

import { type RefObject, useCallback, useLayoutEffect, useState } from "react";

import type { RendererAdapters } from "../adapters/types";
import type { IconSet } from "../registry/Icon";
import type { ComponentRegistry } from "../registry/types";
import { ViewRenderer } from "../render/ViewRenderer";
import type { ComponentContracts, ViewSpec } from "../spec";
import type { DropTarget } from "./drop";
import { elementForPath, instrumentSpec, pathFromElement } from "./instrument";
import { type NodePath, pathToKey } from "./tree";

/**
 * The document, rendered.
 *
 * Not a diagram of it and not a preview beside it: the canvas is the same
 * `ViewRenderer` a host mounts, with the same components, the same theme and the
 * same interactivity, and the builder draws on top of it rather than inside it.
 * That is the only version worth building — a builder whose canvas is an
 * approximation is a builder you have to leave to find out what you made.
 *
 * What it costs is that every element on it belongs to the document, including
 * the buttons and links. In edit mode the canvas takes the click and turns it
 * into a selection; the interact toggle hands the clicks back, which is how a
 * document's own behaviour gets tried out without leaving the page.
 */

type Box = { top: number; left: number; width: number; height: number };

type CanvasProps = {
  spec: ViewSpec | null;
  registry?: ComponentRegistry;
  contracts?: ComponentContracts;
  icons?: IconSet;
  adapters?: RendererAdapters;
  /** The scroller, owned above so a drag can auto-scroll it. */
  stageRef: RefObject<HTMLDivElement | null>;
  innerRef: RefObject<HTMLDivElement | null>;
  selection: NodePath | null;
  hovered: NodePath | null;
  dropTarget: DropTarget | null;
  /** Whether the document's own controls respond to clicks instead of selecting. */
  interactive: boolean;
  onSelect: (path: NodePath | null) => void;
  onHover: (path: NodePath | null) => void;
  /** Picking a rendered node up. Refused in interact mode, and for the root. */
  onDragStart: (path: NodePath, event: React.PointerEvent) => void;
  empty: React.ReactNode;
};

function boxWithin(element: Element, inner: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  const origin = inner.getBoundingClientRect();
  return {
    top: rect.top - origin.top,
    left: rect.left - origin.left,
    width: rect.width,
    height: rect.height,
  };
}

export function BuilderCanvas({
  spec,
  registry,
  contracts,
  icons,
  adapters,
  stageRef,
  innerRef,
  selection,
  hovered,
  dropTarget,
  interactive,
  onSelect,
  onHover,
  onDragStart,
  empty,
}: CanvasProps) {
  const [boxes, setBoxes] = useState<{
    selection: Box | null;
    hovered: Box | null;
    drop: Box | null;
  }>({ selection: null, hovered: null, drop: null });

  const measure = useCallback(() => {
    const inner = innerRef.current;
    if (inner === null) return;
    const at = (path: NodePath | null): Box | null => {
      if (path === null) return null;
      const element = elementForPath(inner, path);
      return element === null ? null : boxWithin(element, inner);
    };
    setBoxes({
      selection: at(selection),
      hovered: hovered !== null && (selection === null || pathToKey(hovered) !== pathToKey(selection)) ? at(hovered) : null,
      drop: at(dropTarget?.path ?? null),
    });
  }, [innerRef, selection, hovered, dropTarget]);

  // After the render, not during it: the boxes describe elements the document
  // just drew, and every edit can move all of them.
  useLayoutEffect(measure, [measure, spec]);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (inner === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [innerRef, measure]);

  return (
    <div className="rui-builder-stage" ref={stageRef} data-interactive={interactive || undefined}>
      <div className="rui-builder-stage-inner" ref={innerRef}>
        {spec === null ? (
          <div className="rui-builder-stage-empty">{empty}</div>
        ) : (
          <div
            className="rui-builder-render"
            onClickCapture={(event) => {
              if (interactive) return;
              // The document's own buttons and links must not fire while the
              // canvas is being edited, and the click still has to mean
              // something — so it is taken here and spent on the selection.
              event.preventDefault();
              event.stopPropagation();
              onSelect(pathFromElement(event.target as Element));
            }}
            onPointerDown={(event) => {
              if (interactive || event.button !== 0) return;
              const path = pathFromElement(event.target as Element);
              // Only a node with a numbered position among siblings can be
              // moved. That excludes the root, which has no last step at all,
              // and a node held in a `$each` or `$cond` slot, whose step is the
              // slot's name — both are drags that could only ever be refused at
              // the end of themselves.
              if (path === null || typeof path[path.length - 1] !== "number") return;
              onDragStart(path, event);
            }}
            // No hover outline while the document's own controls are live: an
            // outline that follows the pointer says "click to select this", and
            // in interact mode a click does not.
            onPointerMove={(event) =>
              onHover(interactive ? null : pathFromElement(event.target as Element))
            }
            onPointerLeave={() => onHover(null)}
          >
            <ViewRenderer
              spec={instrumentSpec(spec)}
              registry={registry}
              contracts={contracts}
              icons={icons}
              adapters={adapters}
              // Ids the document supplies are namespaced, because the builder's
              // own chrome is on the same page and a document is free to name
              // an id the chrome already uses.
              idScope
            />
          </div>
        )}

        <div className="rui-builder-overlay" aria-hidden="true">
          {boxes.hovered && <Outline kind="hover" box={boxes.hovered} />}
          {boxes.selection && <Outline kind="selection" box={boxes.selection} />}
          {boxes.drop && dropTarget && <DropIndicator box={boxes.drop} zone={dropTarget.zone} />}
        </div>
      </div>
    </div>
  );
}

function Outline({ kind, box }: { kind: "hover" | "selection"; box: Box }) {
  return (
    <div
      className="rui-builder-outline"
      data-kind={kind}
      style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
    />
  );
}

/**
 * Where the thing being dragged would land.
 *
 * A line between two siblings and a filled box inside a container are different
 * drawings on purpose: they are different outcomes, and a single highlight that
 * meant either would make nesting a coin toss.
 */
function DropIndicator({ box, zone }: { box: Box; zone: DropTarget["zone"] }) {
  if (zone === "inside") {
    return (
      <div
        className="rui-builder-drop-inside"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      />
    );
  }
  return (
    <div
      className="rui-builder-drop-line"
      style={{
        top: zone === "before" ? box.top : box.top + box.height,
        left: box.left,
        width: box.width,
      }}
    />
  );
}
