"use client";

import { type ChangeEvent, createElement, type ReactNode, useId } from "react";

import { Icon } from "../registry/Icon";
import { wantsIconComponent } from "../registry/icon-slots";
import { type ComponentRegistry, lookupComponent } from "../registry/types";
import {
  FIELD_BINDING_KEY,
  isComponentNode,
  isCondNode,
  isEachNode,
  isEventHandlerSpec,
  isFieldBinding,
  isRefNode,
  isRefValue,
  type ViewNode,
} from "../spec/types";
import { FORBIDDEN_PROPS, isDangerousUrl, isUrlProp, MAX_NODE_DEPTH } from "../spec/validate";
import { createEventCallback, type EventHandlerContext } from "./event-handler";
import type { FormState } from "./form-state";
import { NodeErrorBoundary } from "./NodeErrorBoundary";
import { type RefContext, refToText, resolveRef } from "./resolve-ref";
import { useViewData, ViewContextExtender } from "./ViewDataProvider";

type NodeRendererProps = {
  node: ViewNode;
  registry: ComponentRegistry;
  eventContext: EventHandlerContext;
  depth?: number;
};

/** Splits `"contact.email"` and looks up the live form. */
function resolveFormField(
  path: string,
  forms: Record<string, FormState>,
): { fieldName: string; formState: FormState } | null {
  const dot = path.indexOf(".");
  if (dot === -1) return null;
  const formName = path.slice(0, dot);
  const fieldName = path.slice(dot + 1);
  if (!Object.hasOwn(forms, formName)) return null;
  return { fieldName, formState: forms[formName] };
}

/** Iteration keys prefer a stable id so reordering does not remount rows. */
function itemKey(item: unknown, index: number): string {
  if (typeof item === "object" && item !== null) {
    const obj = item as Record<string, unknown>;
    for (const field of ["id", "key", "slug", "uuid"]) {
      if (Object.hasOwn(obj, field)) {
        const value = obj[field];
        if (typeof value === "string" || typeof value === "number") return String(value);
      }
    }
  }
  if (typeof item === "string" || typeof item === "number") return String(item);
  return String(index);
}

function nodeKey(node: ViewNode, index: number): string {
  if (typeof node === "string") return `t${index}`;
  if (isRefNode(node)) return `r${index}-${node.$ref}`;
  if (isEachNode(node)) return `e${index}-${node.$each}`;
  if (isCondNode(node)) return `c${index}-${node.$cond}`;
  if (isComponentNode(node)) {
    const id = node.props?.id ?? node.props?.name ?? node.props?.value;
    if (typeof id === "string" || typeof id === "number") return `${node.component}-${id}`;
    return `${node.component}-${index}`;
  }
  return `n${index}`;
}

/** `icon`, `leftIcon`, `trailingIcon`… — slots typed ReactNode in the library. */
function isIconProp(key: string): boolean {
  return key === "icon" || (key.length > 4 && key.endsWith("Icon"));
}

/** Coerces the DOM value for a `$field`-bound control. */
function readInputValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): unknown {
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    if (target.type === "checkbox") return target.checked;
    if (target.type === "radio") return target.value;
    if (target.type === "number" || target.type === "range") {
      if (target.value === "") return "";
      const num = Number(target.value);
      return Number.isNaN(num) ? target.value : num;
    }
  }
  return target.value;
}

export function NodeRenderer({ node, registry, eventContext, depth = 0 }: NodeRendererProps) {
  const view = useViewData();
  const autoDialogId = useId();

  if (depth > MAX_NODE_DEPTH) {
    return (
      <div className="rui-render-error" role="alert">
        Node nesting exceeded {MAX_NODE_DEPTH} levels.
      </div>
    );
  }

  const refContext: RefContext = {
    data: view.data,
    forms: Object.fromEntries(
      Object.entries(view.forms).map(([name, form]) => [
        name,
        { values: form.values, errors: form.errors },
      ]),
    ),
    vars: view.vars,
  };

  if (typeof node === "string") return <>{node}</>;

  if (node == null || typeof node !== "object") {
    return (
      <div className="rui-render-error" role="alert">
        Invalid node: {String(node)}
      </div>
    );
  }

  if (isRefNode(node)) {
    return <>{refToText(resolveRef(node.$ref, refContext))}</>;
  }

  if (isCondNode(node)) {
    const branch = resolveRef(node.$cond, refContext) ? node.then : node.else;
    if (branch === undefined) return null;
    return (
      <NodeErrorBoundary label="$cond">
        <NodeRenderer node={branch} registry={registry} eventContext={eventContext} depth={depth + 1} />
      </NodeErrorBoundary>
    );
  }

  if (isEachNode(node)) {
    const resolved = resolveRef(node.$each, refContext);
    if (!Array.isArray(resolved)) return null;
    const items: unknown[] = resolved;
    return (
      <>
        {items.map((item, index) => (
          <ViewContextExtender
            key={itemKey(item, index)}
            vars={{ [node.as]: item, [`${node.as}Index`]: index }}
          >
            <NodeErrorBoundary label={`$each[${index}]`}>
              <NodeRenderer
                node={node.node}
                registry={registry}
                eventContext={eventContext}
                depth={depth + 1}
              />
            </NodeErrorBoundary>
          </ViewContextExtender>
        ))}
      </>
    );
  }

  if (!isComponentNode(node)) {
    return (
      <div className="rui-render-error" role="alert">
        Node must have one of: component, $ref, $each, $cond.
      </div>
    );
  }

  const Component = lookupComponent(registry, node.component);
  if (!Component) {
    return (
      <div className="rui-render-warning" role="alert">
        Unknown component: <strong>{node.component}</strong>
      </div>
    );
  }

  const props: Record<string, unknown> = {};

  /** Both binding spellings converge here. */
  const applyFieldBinding = (path: string): void => {
    const bound = resolveFormField(path, view.forms);
    if (!bound) return;
    const { fieldName, formState } = bound;
    const current = formState.values[fieldName];

    if (node.component === "Checkbox" || node.component === "Switch") {
      props.checked = Boolean(current);
    } else if (node.component === "Radio") {
      props.checked = current === props.value;
    } else {
      props.value = current == null ? "" : (current);
    }

    props.onChange = (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
      formState.setValue(fieldName, readInputValue(event));
    };
  };

  for (const [key, value] of Object.entries(node.props ?? {})) {
    // Never let a document reach into React's escape hatches.
    if (FORBIDDEN_PROPS.has(key)) continue;

    // Canonical binding: `props: { $field: "contact.email" }`. Applied after the
    // loop so it wins over a literal `value` declared alongside it.
    if (key === FIELD_BINDING_KEY) continue;

    if (isRefValue(value)) {
      props[key] = resolveRef(value.$ref, refContext);
      continue;
    }

    if (isEventHandlerSpec(value)) {
      props[key] = createEventCallback(value, eventContext);
      continue;
    }

    // Accepted spelling: `props: { value: { $field: "contact.email" } }`.
    if (isFieldBinding(value)) {
      applyFieldBinding(value.$field);
      continue;
    }

    if (isUrlProp(key) && isDangerousUrl(value)) continue;

    if (isIconProp(key) && typeof value === "string") {
      // Most slots are typed ReactNode and want an element; a few are typed
      // LucideIcon and are invoked as a component. Handing over the wrong one
      // throws inside the library rather than degrading.
      props[key] = wantsIconComponent(node.component, key)
        ? () => <Icon name={value} />
        : <Icon name={value} />;
      continue;
    }

    props[key] = value;
  }

  const fieldPath = node.props?.[FIELD_BINDING_KEY];
  if (typeof fieldPath === "string") applyFieldBinding(fieldPath);

  // Dialog visibility is owned by the renderer so openDialog/closeDialog work.
  // Without an explicit id the dialog is still controllable by its own onClose,
  // but no action can target it — useId keeps that fallback stable across renders.
  if (node.component === "Dialog" || node.component === "Drawer") {
    const dialogId = typeof node.props?.id === "string" ? node.props.id : autoDialogId;
    props.open = view.dialogStates[dialogId] ?? node.props?.open === true;
    props.onClose = () => eventContext.dialogs.close(dialogId);
  }

  // Select takes <option> children, not an options array.
  let optionChildren: ReactNode[] | undefined;
  if (node.component === "Select" && Array.isArray(props.options)) {
    optionChildren = (props.options as unknown[]).map((option, index) => {
      if (typeof option === "string" || typeof option === "number") {
        return (
          <option key={String(option)} value={option}>
            {option}
          </option>
        );
      }
      const record = (option ?? {}) as Record<string, unknown>;
      const value = record.value;
      const label = record.label ?? value;
      return (
        <option key={typeof value === "string" || typeof value === "number" ? String(value) : index} value={value as string}>
          {label as ReactNode}
        </option>
      );
    });
    delete props.options;
  }

  // `Field name` and `FieldError name` both surface a live validation error.
  if ((node.component === "Field" || node.component === "FieldError") && typeof props.name === "string") {
    const bound = resolveFormField(props.name, view.forms);
    const message = bound ? bound.formState.errors[bound.fieldName] : undefined;
    if (node.component === "Field") {
      if (message) props.error = message;
      delete props.name;
    } else {
      if (message) props.children = message;
      delete props.name;
    }
  }

  const childNodes = node.children?.map((child, index) => (
    <NodeErrorBoundary key={nodeKey(child, index)} label={`${node.component}[${index}]`}>
      <NodeRenderer node={child} registry={registry} eventContext={eventContext} depth={depth + 1} />
    </NodeErrorBoundary>
  ));

  const children = optionChildren ? [...optionChildren, ...(childNodes ?? [])] : childNodes;

  // Passing `children` as a JSX child would clobber a `children` prop that came
  // from a $ref or a literal, so only spread when the document supplied nodes.
  const element =
    children && children.length > 0
      ? createElement(Component, props, children)
      : createElement(Component, props);

  return <NodeErrorBoundary label={node.component}>{element}</NodeErrorBoundary>;
}
