"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

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
    // A new node in this slot deserves a fresh attempt.
    if (prev.label !== this.props.label && this.state.message !== null) {
      this.setState({ message: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  render() {
    if (this.state.message !== null) {
      return (
        <div className="rui-render-error" role="alert">
          <strong>Render error</strong> ({this.props.label}): {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
