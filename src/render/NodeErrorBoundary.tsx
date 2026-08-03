"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { RENDER_DIAGNOSTIC_CLASSES } from "./diagnostics";

type Props = {
  label: string;
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
};

type State = { message: string | null };

/**
 * Contains a throw to the node that caused it.
 *
 * Documents are typically machine-generated, so a component receiving props it
 * cannot handle is an expected condition, not an exceptional one. Without a
 * boundary per node, one bad prop blanks the entire view — and in a live
 * preview that reads as "the renderer is broken" rather than "this node is".
 */
export class NodeErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.message === null) return;
    // Anything handed down again is a fresh attempt, so the message describes the
    // render it came from and never a previous one. Keying this on the node, or
    // on the label, holds a stale error over the fix: a document that corrects
    // the prop that threw leaves the component name and the slot exactly as they
    // were, and a value arriving from data changes neither.
    //
    // Retrying costs one throw per render of a node that is still broken, and
    // cannot loop: `children` is a new element only when something above
    // re-rendered, which this boundary's own state cannot cause.
    if (prev.children !== this.props.children || prev.label !== this.props.label) {
      this.setState({ message: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.message !== null) {
      return (
        <div className={RENDER_DIAGNOSTIC_CLASSES.error} role="alert">
          <strong>Render error</strong> ({this.props.label}): {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
