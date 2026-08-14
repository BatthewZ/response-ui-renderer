"use client";

import { Button, CopyButton } from "@batthewz/response-ui-react-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RendererAdapters } from "../adapters/types";
import type { IconSet } from "../registry/Icon";
import type { ComponentRegistry } from "../registry/types";
import {
  type ComponentContracts,
  errorsOf,
  isComponentNode,
  validateViewSpec,
  type ViewNode,
  type ViewSpec,
  warningsOf,
} from "../spec";
import { BuilderCanvas } from "./BuilderCanvas";
import { BuilderInspector } from "./BuilderInspector";
import { BuilderLayers, LAYER_ROW_ATTR } from "./BuilderLayers";
import { BuilderPalette, type Destination, type PaletteFamily } from "./BuilderPalette";
import { BuilderTheme } from "./BuilderTheme";
import {
  type BuilderCatalog,
  type BuilderCatalogOptions,
  createBuilderCatalog,
} from "./catalog";
import { autoScrollBy, type DragPayload, movedFar } from "./drag";
import { canMove, type DropTarget, dropTargetAt } from "./drop";
import { BUILDER_PATH_ATTR, BUILDER_PATH_SELECTOR } from "./instrument";
import {
  defaultBuilderExclusions,
  defaultBuilderFrequency,
  defaultBuilderTemplates,
} from "./templates";
import { THEME_TOKENS, type ThemeToken } from "./theme-contract";
import {
  childEntries,
  countNodes,
  keyToPath,
  lastStep,
  nodeAt,
  type NodePath,
  parentPath,
  ROOT_PATH,
} from "./tree";
import { useBuilder } from "./use-builder";

/**
 * A drag-and-drop editor that produces a ViewSpec.
 *
 * The point of it is not that a page can be assembled by hand — it is that this
 * format is *data*, structured enough that a tool can compose, rearrange and
 * retheme a document without knowing anything about the components in it. Every
 * name it offers comes from the registry, every variant from the contracts,
 * every theme token from the theme contract. Point it at your own registry and
 * it builds your components on the same terms, with no builder-side knowledge of
 * them at all.
 *
 * What comes out is an ordinary document. Nothing the builder adds to render its
 * canvas reaches it, and it is validated with the same `validateViewSpec` a host
 * would run before storing it.
 */
export type ViewBuilderProps = {
  /** Defaults to every `@batthewz/response-ui-react-components` export + `Icon`. */
  registry?: ComponentRegistry;
  /**
   * What each registered name means. Defaults to the documented contracts.
   * Extending the registry without extending these gives your components a
   * palette entry and an empty inspector.
   */
  contracts?: ComponentContracts;
  /** Name → component for `Icon` nodes and string-valued `icon` props. */
  icons?: IconSet;
  /** Host wiring the canvas renders with, so a document can be tried out. */
  adapters?: RendererAdapters;
  /**
   * A catalogue built elsewhere. Overrides everything that would derive one.
   *
   * It decides what the palette offers and what the inspector draws — it does
   * not decide what the canvas renders with. Pass `registry` and `contracts`
   * alongside it, built from the same inputs, or the palette offers components
   * the canvas cannot construct.
   */
  catalog?: BuilderCatalog;
  /** What dropping a component produces. Defaults to this package's corpus. */
  templates?: BuilderCatalogOptions["templates"];
  /**
   * How often each component is reached for, deciding which the palette leads
   * with. Defaults to the counts across this package's own documents; pass
   * `frequencyFromDocuments(yours)` to lead with what *your* pages are made of,
   * or `{}` for a palette that leads with nothing.
   */
  frequency?: BuilderCatalogOptions["frequency"];
  /** Names to leave out of the palette, mapped to why. */
  excluded?: BuilderCatalogOptions["excluded"];
  /** Palette sections, in reading order. */
  categories?: BuilderCatalogOptions["categories"];
  /** The tokens the theme panel offers. Defaults to the response-ui contract. */
  themeTokens?: readonly ThemeToken[];
  /**
   * A document to open. The builder starts empty without one.
   *
   * Read once, as the name says: the builder owns the document after that, and
   * a later value would throw away whatever had been edited since. Remount it
   * with a `key` to open a different one.
   */
  initialSpec?: ViewSpec | null;
  /** Called with the document after every edit, `null` while it has no root. */
  onChange?: (spec: ViewSpec | null) => void;
  /** Title a new document starts with. */
  title?: string;
  className?: string;
};

type SidePanel = "components" | "layers";
type EditPanel = "props" | "theme";

export function ViewBuilder({
  registry,
  contracts,
  icons,
  adapters,
  catalog: suppliedCatalog,
  templates = defaultBuilderTemplates,
  frequency = defaultBuilderFrequency,
  excluded = defaultBuilderExclusions,
  categories,
  themeTokens = THEME_TOKENS,
  initialSpec = null,
  onChange,
  title,
  className,
}: ViewBuilderProps) {
  const catalog = useMemo(
    () =>
      suppliedCatalog ??
      createBuilderCatalog({ registry, contracts, categories, templates, frequency, excluded }),
    [suppliedCatalog, registry, contracts, categories, templates, frequency, excluded],
  );

  const { state, dispatch, spec, canUndo, canRedo } = useBuilder(initialSpec, title);
  const { document: doc, selection } = state;

  const [hovered, setHovered] = useState<NodePath | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [drag, setDrag] = useState<{ payload: DragPayload; x: number; y: number } | null>(null);
  const [side, setSide] = useState<SidePanel>("components");
  const [edit, setEdit] = useState<EditPanel>("props");
  const [interactive, setInteractive] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<{ payload: DragPayload; x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  // Held in a ref rather than named as a dependency. The documented way to use
  // this prop is an inline arrow, so a host that stores the document re-renders,
  // hands over a new function, and — if the identity were a dependency — is
  // called again for a change that did not happen. That is an infinite loop
  // reached by following the example.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.(spec);
  }, [spec]);

  const validation = useMemo(
    () => (spec === null ? null : validateViewSpec(spec, { registry })),
    [spec, registry],
  );
  const errors = validation === null ? [] : errorsOf(validation.issues);
  const warnings = validation === null ? [] : warningsOf(validation.issues);

  /**
   * Whether a node takes children — the question every drop asks.
   *
   * A structural node never does: `$each` and `$cond` hold exactly one node
   * each, and putting a second one in a slot would silently drop the first.
   */
  const accepts = useCallback(
    (node: ViewNode) => isComponentNode(node) && catalog.acceptsChildren(node.component),
    [catalog],
  );

  /**
   * The node under the pointer, and where in it the drop would land — or
   * nothing, when the drop would be refused.
   *
   * What is being dragged is part of the question, not only where the pointer
   * is. A node cannot be dropped inside itself, and one that reads a loop's rows
   * cannot leave that loop; painting the "it will nest here" indicator over
   * either and then declining the drop is a control that visibly does nothing.
   */
  const targetAt = useCallback(
    (x: number, y: number, payload: DragPayload): DropTarget | null => {
      const root = doc.root;
      if (root === null) return null;

      const allowed = (target: DropTarget | null): DropTarget | null => {
        if (target === null) return null;
        if (payload.kind === "new") return target;
        return canMove(root, payload.path, target) ? target : null;
      };

      const element = window.document.elementFromPoint(x, y);
      if (element === null) return null;

      const stage = stageRef.current;
      const overStage = stage !== null && stage.contains(element);
      const marked = overStage
        ? element.closest(BUILDER_PATH_SELECTOR)
        : element.closest(`[${LAYER_ROW_ATTR}]`);

      if (marked === null) {
        // Over the canvas but not over anything in the document — the margin
        // around it. That reads as "put it at the end", which is what it does.
        return overStage && accepts(root) ? allowed({ path: ROOT_PATH, zone: "inside" }) : null;
      }

      const key = marked.getAttribute(overStage ? BUILDER_PATH_ATTR : LAYER_ROW_ATTR);
      if (key === null) return null;

      const rect = marked.getBoundingClientRect();
      return allowed(
        dropTargetAt(root, keyToPath(key), { offset: y - rect.top, height: rect.height }, accepts),
      );
    },
    [doc.root, accepts],
  );

  const startDrag = useCallback((payload: DragPayload, event: React.PointerEvent) => {
    if (event.button !== 0) return;
    pressRef.current = { payload, x: event.clientX, y: event.clientY };
    draggedRef.current = false;
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const press = pressRef.current;
      if (press === null) return;

      if (!draggedRef.current && !movedFar(press, event)) return;
      draggedRef.current = true;
      event.preventDefault();

      setDrag({ payload: press.payload, x: event.clientX, y: event.clientY });
      setDropTarget(targetAt(event.clientX, event.clientY, press.payload));

      const stage = stageRef.current;
      if (stage !== null) {
        const bounds = stage.getBoundingClientRect();
        const by = autoScrollBy(event.clientY, { top: bounds.top, bottom: bounds.bottom });
        if (by !== 0) stage.scrollBy({ top: by });
      }
    };

    const onUp = (event: PointerEvent) => {
      const press = pressRef.current;
      pressRef.current = null;
      if (press === null || !draggedRef.current) return;

      const target = targetAt(event.clientX, event.clientY, press.payload);
      setDrag(null);
      setDropTarget(null);

      if (press.payload.kind === "new") {
        dispatch({ type: "insert", node: catalog.template(press.payload.name), target });
      } else if (target !== null) {
        dispatch({ type: "move", from: press.payload.path, target });
      }
    };

    const onCancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      pressRef.current = null;
      draggedRef.current = false;
      setDrag(null);
      setDropTarget(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onCancel);
    };
  }, [catalog, dispatch, targetAt]);

  /**
   * Adding by click rather than by drag.
   *
   * The palette is a list of buttons, so this is what happens when one is
   * activated from the keyboard — and it is also the faster gesture once you
   * know where things go. It drops into the selection, or at the end of the
   * document when there is none, which is the same decision the drag makes with
   * the pointer instead.
   */
  const insertByClick = useCallback(
    (name: string) => {
      // A drag that ended on this chip also fires a click; one gesture, one edit.
      if (draggedRef.current) {
        draggedRef.current = false;
        return;
      }
      const root = doc.root;
      const node = catalog.template(name);
      if (root === null) {
        dispatch({ type: "insert", node, target: null });
        return;
      }
      const at = selection ?? ROOT_PATH;
      const selected = nodeAt(root, at);
      const inside = selected !== null && accepts(selected);
      dispatch({
        type: "insert",
        node,
        target: inside ? { path: at, zone: "inside" } : { path: at, zone: "after" },
      });
    },
    [accepts, catalog, dispatch, doc.root, selection],
  );

  /** What a click on the palette would do — on every chip, and once in words. */
  const destination = useMemo((): Destination => {
    const root = doc.root;
    if (root === null) {
      return {
        phrase: "the empty canvas, as the document root",
        // Short on purpose: the canvas already spells this out at length, and a
        // line that wraps here moves every chip under it down a row.
        line: "Starts the document",
      };
    }
    const at = selection ?? ROOT_PATH;
    const selected = nodeAt(root, at);
    if (selected === null) return { phrase: "the document", line: "Adds to the document" };
    const name = isComponentNode(selected) ? selected.component : "the selection";
    return accepts(selected)
      ? { phrase: `inside ${name}`, line: `Adds inside ${name}` }
      : { phrase: `after ${name}`, line: `Adds after ${name}` };
  }, [accepts, doc.root, selection]);

  /**
   * The compound component the selection sits in, and the parts it takes.
   *
   * Found by walking *up* rather than by reading the selection alone, because
   * the moment you want a `Table.Cell` is while you are somewhere inside a
   * table — on a row, or on the text in a cell — and almost never while the
   * table itself is what is selected. The nearest ancestor that has parts wins,
   * so a `Card` nested in a cell offers the card's parts and not the table's.
   */
  const family = useMemo((): PaletteFamily | null => {
    const root = doc.root;
    if (root === null || selection === null) return null;

    let path: NodePath | null = selection;
    while (path !== null) {
      const node = nodeAt(root, path);
      if (node !== null && isComponentNode(node)) {
        const parts = catalog.parts(node.component);
        if (parts.length > 0) {
          const dot = node.component.indexOf(".");
          return {
            name: dot === -1 ? node.component : node.component.slice(0, dot),
            parts,
          };
        }
      }
      path = parentPath(path);
    }
    return null;
  }, [catalog, doc.root, selection]);

  const selected = selection === null || doc.root === null ? null : nodeAt(doc.root, selection);
  const siblingStep = selection === null ? null : lastStep(selection);
  const siblingIndex = typeof siblingStep === "number" ? siblingStep : null;
  const siblingParent = selection === null ? null : parentPath(selection);
  const siblingCount =
    siblingParent === null || doc.root === null
      ? 0
      : childEntries(nodeAt(doc.root, siblingParent) ?? "").length;

  /**
   * Keyboard shortcuts, bound to the builder rather than to the window.
   *
   * This is a component inside somebody's application, not a page. Undo on the
   * window is the host's undo as much as it is this one's, and Backspace with a
   * button focused anywhere at all would delete a node out of a document the
   * reader may not even be looking at. Both only fire when the focus is inside.
   *
   * Typing is excluded on top of that: Delete inside a class-name field has to
   * delete a character.
   */
  useEffect(() => {
    const element = rootRef.current;
    if (element === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (typing) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selection !== null) {
        event.preventDefault();
        dispatch({ type: "remove", path: selection });
      }
    };

    element.addEventListener("keydown", onKeyDown);
    return () => element.removeEventListener("keydown", onKeyDown);
  }, [dispatch, selection]);

  const json = spec === null ? "" : `${JSON.stringify(spec, null, 2)}\n`;

  return (
    <div
      className={className === undefined ? "rui-builder" : `rui-builder ${className}`}
      data-dragging={drag !== null || undefined}
      ref={rootRef}
    >
      <aside className="rui-builder-side" aria-label="Components and structure">
        <PanelTabs
          value={side}
          onChange={setSide}
          tabs={[
            { id: "components", label: "Components" },
            { id: "layers", label: `Structure (${countNodes(doc.root)})` },
          ]}
        />
        {side === "components" ? (
          <BuilderPalette
            catalog={catalog}
            destination={destination}
            family={family}
            dragging={drag?.payload.kind === "new" ? drag.payload.name : null}
            onDragStart={startDrag}
            onInsert={insertByClick}
          />
        ) : (
          <div className="rui-builder-scroll">
            <BuilderLayers
              root={doc.root}
              catalog={catalog}
              selection={selection}
              hovered={hovered}
              onSelect={(path) => dispatch({ type: "select", path })}
              onHover={setHovered}
              onDragStart={startDrag}
            />
          </div>
        )}
      </aside>

      <main className="rui-builder-main">
        <header className="rui-builder-toolbar">
          <input
            className="rui-builder-title"
            value={doc.title}
            aria-label="Document title"
            onChange={(event) => dispatch({ type: "setTitle", title: event.target.value })}
          />

          {/* An empty document is not a valid one — it is nothing yet. Painting
              it with the clean verdict would have the page congratulate someone
              on a document they have not started. */}
          <span
            className="rui-builder-status"
            data-verdict={
              spec === null
                ? "empty"
                : errors.length > 0
                  ? "error"
                  : warnings.length > 0
                    ? "warning"
                    : "clean"
            }
          >
            {spec === null
              ? "Empty"
              : errors.length > 0
                ? `${errors.length} ${errors.length === 1 ? "error" : "errors"}`
                : warnings.length > 0
                  ? `${warnings.length} ${warnings.length === 1 ? "warning" : "warnings"}`
                  : "Valid document"}
          </span>

          <div className="rui-builder-toolbar-actions">
            <Button type="button" size="sm" variant="ghost" disabled={!canUndo} onClick={() => dispatch({ type: "undo" })}>
              Undo
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={!canRedo} onClick={() => dispatch({ type: "redo" })}>
              Redo
            </Button>
            <Button
              type="button"
              size="sm"
              variant={interactive ? "primary" : "secondary"}
              aria-pressed={interactive}
              onClick={() => setInteractive((on) => !on)}
            >
              {interactive ? "Interacting" : "Interact"}
            </Button>
            <Button type="button" size="sm" variant="secondary" aria-pressed={showJson} onClick={() => setShowJson((on) => !on)}>
              JSON
            </Button>
            {/* An icon-only control by design upstream: it owns its own label
                and swaps it for a copied state, so there is no `children` to
                give it. The document is what leaves the builder, so this is the
                one button that matters. */}
            {spec !== null && <CopyButton value={json} aria-label="Copy the document as JSON" />}
          </div>
        </header>

        {(errors.length > 0 || warnings.length > 0) && (
          <ul className="rui-builder-issues">
            {[...errors, ...warnings].slice(0, 6).map((issue) => (
              <li key={`${issue.severity}${issue.path}${issue.message}`} data-severity={issue.severity}>
                <code>{issue.path}</code> {issue.message}
              </li>
            ))}
          </ul>
        )}

        <BuilderCanvas
          spec={spec}
          registry={registry}
          contracts={contracts}
          icons={icons}
          adapters={adapters}
          stageRef={stageRef}
          innerRef={innerRef}
          selection={selection}
          hovered={hovered}
          dropTarget={dropTarget}
          interactive={interactive}
          onSelect={(path) => dispatch({ type: "select", path })}
          onHover={setHovered}
          onDragStart={(path, event) => {
            const node = doc.root === null ? null : nodeAt(doc.root, path);
            const label = node !== null && isComponentNode(node) ? node.component : "node";
            startDrag({ kind: "move", path, label }, event);
          }}
          empty={
            <div className="rui-builder-invite">
              <h2>Drag a component here</h2>
              <p>
                The first one becomes the document root. Everything you drop after it goes inside
                whatever you aim at, however deep.
              </p>
            </div>
          }
        />

        {showJson && (
          <pre className="rui-builder-json" aria-label="The document">
            {json === "" ? "// nothing yet" : json}
          </pre>
        )}
      </main>

      <aside className="rui-builder-side" aria-label="Properties and theme">
        <PanelTabs
          value={edit}
          onChange={setEdit}
          tabs={[
            { id: "props", label: "Properties" },
            {
              id: "theme",
              label: `Theme (${Object.keys(doc.themeOverrides ?? {}).length})`,
            },
          ]}
        />
        <div className="rui-builder-scroll">
          {edit === "props" ? (
            <BuilderInspector
              catalog={catalog}
              node={selected}
              path={selection}
              siblingIndex={siblingIndex}
              siblingCount={siblingCount}
              onSetProp={(key, value) =>
                selection && dispatch({ type: "setProp", path: selection, key, value })
              }
              onSetText={(text) => selection && dispatch({ type: "setText", path: selection, text })}
              onRemove={() => selection && dispatch({ type: "remove", path: selection })}
              onDuplicate={() => selection && dispatch({ type: "duplicate", path: selection })}
              onNudge={(by) => selection && dispatch({ type: "nudge", path: selection, by })}
              onSelectPath={(path) => dispatch({ type: "select", path })}
            />
          ) : (
            <BuilderTheme
              tokens={themeTokens}
              overrides={doc.themeOverrides ?? {}}
              viewRef={innerRef}
              onChange={(token, value) => dispatch({ type: "setThemeOverride", token, value })}
            />
          )}
        </div>
      </aside>

      {drag !== null && (
        <div
          className="rui-builder-ghost"
          style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}
          aria-hidden="true"
        >
          {drag.payload.kind === "new" ? drag.payload.name : drag.payload.label}
        </div>
      )}
    </div>
  );
}

function PanelTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: readonly { id: T; label: string }[];
}) {
  return (
    <div className="rui-builder-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className="rui-builder-tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
