"use client";

import { useCallback, useMemo, useReducer } from "react";

import type { ViewNode, ViewSpec } from "../spec";
import {
  duplicateNode,
  type EditResult,
  insertNode,
  moveNodeTo,
  nudgeNode,
  removeNode,
  replaceNode,
  setNodeText,
  setProp,
  setThemeOverride,
} from "./commands";
import type { DropTarget } from "./drop";
import { type BuilderDocument, emptyDocument, fromSpec, type NodePath, toSpec } from "./tree";

/**
 * The builder's whole state, and the only thing that changes it.
 *
 * History is a list of documents rather than a list of edits, which costs
 * nothing here: every command returns a new document and shares the parts it did
 * not touch, so a step of undo is a pointer move. It is worth having because the
 * one thing a drag-and-drop editor does more than anything else is drop
 * something in the wrong place.
 */
export type BuilderState = {
  document: BuilderDocument;
  /** The node the inspector is describing, or `null` for the document itself. */
  selection: NodePath | null;
  past: readonly BuilderDocument[];
  future: readonly BuilderDocument[];
};

export type BuilderAction =
  | { type: "insert"; node: ViewNode; target: DropTarget | null }
  | { type: "move"; from: NodePath; target: DropTarget }
  | { type: "remove"; path: NodePath }
  | { type: "duplicate"; path: NodePath }
  | { type: "nudge"; path: NodePath; by: number }
  | { type: "setProp"; path: NodePath; key: string; value: unknown }
  | { type: "setText"; path: NodePath; text: string }
  | { type: "replace"; path: NodePath; node: ViewNode }
  | { type: "setThemeOverride"; token: string; value: string | undefined }
  | { type: "setTitle"; title: string }
  | { type: "select"; path: NodePath | null }
  | { type: "open"; spec: ViewSpec | null }
  | { type: "undo" }
  | { type: "redo" };

/** How many documents back the history goes. */
const HISTORY_LIMIT = 60;

/**
 * Applies an edit, and records it only if it was one.
 *
 * A refused edit returns the same document and no selection, and must leave the
 * history alone: an Undo that steps over a drag the builder itself declined is
 * an Undo the user cannot account for.
 */
const commit = (state: BuilderState, result: EditResult): BuilderState => {
  const selection = result.selection === undefined ? state.selection : result.selection;
  if (result.document === state.document) {
    return selection === state.selection ? state : { ...state, selection };
  }
  return {
    document: result.document,
    selection,
    past: [...state.past, state.document].slice(-HISTORY_LIMIT),
    future: [],
  };
};

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  const { document, selection } = state;

  switch (action.type) {
    case "insert":
      return commit(state, insertNode(document, action.node, action.target));
    case "move":
      return commit(state, moveNodeTo(document, action.from, action.target));
    case "remove":
      return commit(state, removeNode(document, action.path));
    case "duplicate":
      return commit(state, duplicateNode(document, action.path));
    case "nudge":
      return commit(state, nudgeNode(document, action.path, action.by));
    case "setProp":
      return commit(state, setProp(document, action.path, action.key, action.value));
    case "setText":
      return commit(state, setNodeText(document, action.path, action.text));
    case "replace":
      return commit(state, replaceNode(document, action.path, action.node));
    case "setThemeOverride":
      return commit(state, {
        document: setThemeOverride(document, action.token, action.value),
        selection,
      });
    case "setTitle":
      return commit(state, { document: { ...document, title: action.title }, selection });
    case "select":
      return { ...state, selection: action.path };
    case "open":
      return {
        document: action.spec === null ? emptyDocument() : fromSpec(action.spec),
        selection: null,
        past: [...state.past, document].slice(-HISTORY_LIMIT),
        future: [],
      };
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (previous === undefined) return state;
      return {
        document: previous,
        // The path a selection names may not exist in the document being
        // restored, and a stale one silently describes whatever moved into its
        // place. Dropping it is the only answer that cannot be wrong.
        selection: null,
        past: state.past.slice(0, -1),
        future: [document, ...state.future],
      };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (next === undefined) return state;
      return { document: next, selection: null, past: [...state.past, document], future: rest };
    }
  }
}

export type BuilderStore = {
  state: BuilderState;
  dispatch: (action: BuilderAction) => void;
  /** The document as a spec, or `null` while nothing has been dropped on it. */
  spec: ViewSpec | null;
  canUndo: boolean;
  canRedo: boolean;
};

export function useBuilder(initial?: ViewSpec | null, title?: string): BuilderStore {
  const [state, dispatch] = useReducer(builderReducer, initial, (spec) => ({
    document: spec === undefined || spec === null ? emptyDocument(title) : fromSpec(spec),
    selection: null,
    past: [],
    future: [],
  }));

  const spec = useMemo(() => toSpec(state.document), [state.document]);
  const dispatchStable = useCallback((action: BuilderAction) => dispatch(action), []);

  return {
    state,
    dispatch: dispatchStable,
    spec,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
