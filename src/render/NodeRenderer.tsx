"use client";

import { createElement, type ReactNode, useId } from "react";

import { composeProp, inspectsChildren } from "../registry/child-introspection";
import { Icon } from "../registry/Icon";
import { wantsIconComponent } from "../registry/icon-slots";
import {
  parseIsoDate,
  parseIsoDateRange,
  propCoercion,
  toKeyAccessor,
} from "../registry/prop-coercions";
import { type ComponentRegistry, lookupComponent } from "../registry/types";
import {
  FIELD_BINDING_KEY,
  isComponentNode,
  isCondNode,
  isEachNode,
  isEventHandlerSpec,
  isFieldBinding,
  isNestedEventHandlerSpec,
  isNodeValue,
  isRefNode,
  isRefValue,
  type ViewNode,
} from "../spec/types";
import {
  DIALOG_COMPONENTS,
  EVENT_ACTIONS,
  FORBIDDEN_PROPS,
  isDangerousUrl,
  isUrlProp,
  MAX_NODE_DEPTH,
} from "../spec/validate";
import { RENDER_DIAGNOSTIC_CLASSES } from "./diagnostics";
import { createEventCallback, type EventHandlerContext } from "./event-handler";
import type { FormState } from "./form-state";
import { NodeErrorBoundary } from "./NodeErrorBoundary";
import { readReportedValue } from "./reported-value";
import { type RefContext, refToText, resolveRef } from "./resolve-ref";
import { useViewData, ViewContextExtender } from "./ViewDataProvider";

/**
 * The four named props are the renderer's own. Everything else on this element
 * was put there by a parent that clones its child — `Tooltip`, and the
 * `asChild` triggers of `DropdownMenu` / `Popover` / `HoverCard` — and is
 * forwarded onto the element the node produces.
 *
 * Without the forward those components are inert: they inject a ref and their
 * handlers by cloning, and a clone of `NodeRenderer` drops every one of them, so
 * a tooltip never opens.
 */
type NodeRendererProps = {
  node: ViewNode;
  registry: ComponentRegistry;
  eventContext: EventHandlerContext;
  depth?: number;
} & { [injected: string]: unknown };

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

/** Bounds recursion through a prop value, matching `resolveDeep`'s own cap. */
const MAX_PROP_DEPTH = 20;

/** `icon`, `leftIcon`, `trailingIcon`… — slots typed ReactNode in the library. */
function isIconProp(key: string): boolean {
  return key === "icon" || (key.length > 4 && key.endsWith("Icon"));
}

/** `Select` takes `<option>` children, not an `options` array. */
function toOptionElements(options: readonly unknown[]): ReactNode[] {
  return options.map((option, index) => {
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
    const key = typeof value === "string" || typeof value === "number" ? String(value) : index;
    return (
      <option key={key} value={value as string}>
        {label as ReactNode}
      </option>
    );
  });
}

export function NodeRenderer({
  node,
  registry,
  eventContext,
  depth = 0,
  ...injected
}: NodeRendererProps) {
  const view = useViewData();
  const autoDialogId = useId();

  if (depth > MAX_NODE_DEPTH) {
    return (
      <div className={RENDER_DIAGNOSTIC_CLASSES.error} role="alert">
        Node nesting exceeded {MAX_NODE_DEPTH} levels.
      </div>
    );
  }

  if (typeof node === "string") return <>{node}</>;

  if (node == null || typeof node !== "object") {
    return (
      <div className={RENDER_DIAGNOSTIC_CLASSES.error} role="alert">
        Invalid node: {String(node)}
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

  /** Every nested node descends one level and inherits the same registry and context. */
  const renderChild = (child: ViewNode, key?: string) => (
    <NodeRenderer
      key={key}
      node={child}
      registry={registry}
      eventContext={eventContext}
      depth={depth + 1}
    />
  );

  if (isRefNode(node)) {
    return <>{refToText(resolveRef(node.$ref, refContext))}</>;
  }

  if (isCondNode(node)) {
    const branch = resolveRef(node.$cond, refContext) ? node.then : node.else;
    if (branch === undefined) return null;
    return (
      <NodeErrorBoundary label="$cond">
        {/* `$cond` resolves to exactly one node, so anything a cloning parent
            injected is still addressed to a single element and must carry on
            down — otherwise a Tooltip around a `$cond` silently never opens. */}
        <NodeRenderer
          {...injected}
          node={branch}
          registry={registry}
          eventContext={eventContext}
          depth={depth + 1}
        />
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
            <NodeErrorBoundary label={`$each[${index}]`}>{renderChild(node.node)}</NodeErrorBoundary>
          </ViewContextExtender>
        ))}
      </>
    );
  }

  if (!isComponentNode(node)) {
    return (
      <div className={RENDER_DIAGNOSTIC_CLASSES.error} role="alert">
        Node must have one of: component, $ref, $each, $cond.
      </div>
    );
  }

  const Component = lookupComponent(registry, node.component);
  if (!Component) {
    return (
      <div className={RENDER_DIAGNOSTIC_CLASSES.warning} role="alert">
        Unknown component: <strong>{node.component}</strong>
      </div>
    );
  }

  const props: Record<string, unknown> = {};

  /** Both binding spellings converge here, after every literal prop is in place. */
  const applyFieldBinding = (path: string): void => {
    const bound = resolveFormField(path, view.forms);
    if (!bound) return;
    const { fieldName, formState } = bound;
    const current = formState.values[fieldName];

    // Switch declares `onChange?: never` and destructures it away; it reports
    // through `onCheckedChange`, so a binding wired to `onChange` renders the
    // stored value and can never write back.
    if (node.component === "Switch") {
      props.checked = Boolean(current);
      props.onCheckedChange = (checked: boolean) => {
        formState.setValue(fieldName, checked);
      };
      return;
    }

    if (node.component === "Checkbox") {
      props.checked = Boolean(current);
    } else if (node.component === "Radio") {
      props.checked = current === props.value;
    } else {
      props.value = current ?? "";
    }

    props.onChange = (reported: unknown) => {
      formState.setValue(fieldName, readReportedValue(reported));
    };
  };

  /**
   * Resolves the format's markers wherever they appear inside a prop value.
   *
   * `$ref` and `$node` recurse unconditionally — the `$` prefix is reserved by
   * the wire format, so finding one inside an array is unambiguous. A nested
   * handler must be exactly handler-shaped, because nested values are normally
   * data and a row carrying an `action` string must stay a row.
   */
  const coerceNested = (value: unknown, path: string, valueDepth: number): unknown => {
    if (valueDepth > MAX_PROP_DEPTH) return value;

    if (isRefValue(value)) return resolveRef(value.$ref, refContext);

    if (isNodeValue(value)) {
      return (
        <NodeErrorBoundary key={path} label={`${node.component}.${path}`}>
          {renderChild(value.$node)}
        </NodeErrorBoundary>
      );
    }

    if (isNestedEventHandlerSpec(value, EVENT_ACTIONS)) {
      return createEventCallback(value, eventContext);
    }

    if (Array.isArray(value)) {
      return value.map((item, index) => coerceNested(item, `${path}.${index}`, valueDepth + 1));
    }

    if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        out[key] = coerceNested(item, `${path}.${key}`, valueDepth + 1);
      }
      return out;
    }

    return value;
  };

  /**
   * A column's `render` is `(row, index) => ReactNode`. A document supplies a
   * `$node` template instead, rendered once per row with the row bound as
   * `row` / `rowIndex` — the same names `$each` would give it.
   */
  const coerceColumnDef = (column: unknown): unknown => {
    if (typeof column !== "object" || column === null || Array.isArray(column)) return column;
    const def = column as Record<string, unknown>;
    if (!isNodeValue(def.render)) return def;
    const template = def.render.$node;
    return {
      ...def,
      render: (row: unknown, index: number) => (
        <ViewContextExtender vars={{ row, rowIndex: index }}>
          {renderChild(template)}
        </ViewContextExtender>
      ),
    };
  };

  // Deferred so the binding lands after every literal prop and every other
  // handler: an `onChange` declared alongside a binding must not displace it.
  let boundFieldPath: string | undefined;

  for (const [key, value] of Object.entries(node.props ?? {})) {
    // Never let a document reach into React's escape hatches.
    if (FORBIDDEN_PROPS.has(key)) continue;

    // Canonical binding: `props: { $field: "contact.email" }`. Applied after the
    // loop so it wins over a literal `value` declared alongside it.
    if (key === FIELD_BINDING_KEY) continue;

    // A top-level handler is not required to be handler-shaped-and-nothing-else:
    // the spelling is long-established and the position is unambiguous.
    if (isEventHandlerSpec(value)) {
      props[key] = createEventCallback(value, eventContext);
      continue;
    }

    // Accepted spelling: `props: { value: { $field: "contact.email" } }`.
    if (isFieldBinding(value)) {
      boundFieldPath = value.$field;
      continue;
    }

    // Icon-name strings are coerced by key shape, so — unlike the `$` markers —
    // this stays at the top level: a data row with an `icon` column must not
    // silently become an element. Nested slots use `$node` instead.
    if (isIconProp(key) && typeof value === "string") {
      // Most slots are typed ReactNode and want an element; a few are typed
      // LucideIcon and are invoked as a component. Handing over the wrong one
      // throws inside the library rather than degrading.
      props[key] = wantsIconComponent(node.component, key)
        ? () => <Icon name={value} />
        : <Icon name={value} />;
      continue;
    }

    const coercion = propCoercion(node.component, key);
    if (coercion === "isoDate") {
      props[key] = parseIsoDate(value);
      continue;
    }
    if (coercion === "isoDateRange") {
      props[key] = parseIsoDateRange(value);
      continue;
    }
    if (coercion === "keyAccessor") {
      props[key] = toKeyAccessor(value);
      continue;
    }
    if (coercion === "columnDefs" && Array.isArray(value)) {
      props[key] = value.map((column) => coerceColumnDef(column));
      continue;
    }

    const resolved = coerceNested(value, key, 0);

    // Checked AFTER resolution, not before: a `$ref` is an object until it is
    // resolved, so testing the literal passes every indirect spelling straight
    // through. `data` can be an api binding, which makes a remote response able
    // to put a `data:text/html` URL in an href. React blocks `javascript:`
    // itself, which masked this — `vbscript:` and `data:` have no such backstop.
    if (isUrlProp(key) && isDangerousUrl(resolved)) continue;

    props[key] = resolved;
  }

  // The bare key is canonical, so it wins when both spellings appear.
  const bareFieldPath = node.props?.[FIELD_BINDING_KEY];
  if (typeof bareFieldPath === "string") boundFieldPath = bareFieldPath;
  if (boundFieldPath !== undefined) applyFieldBinding(boundFieldPath);

  // Dialog visibility is owned by the renderer so openDialog/closeDialog work.
  // Without an explicit id the dialog is still controllable by its own onClose,
  // but no action can target it — useId keeps that fallback stable across renders.
  if (DIALOG_COMPONENTS.has(node.component)) {
    const dialogId = typeof node.props?.id === "string" ? node.props.id : autoDialogId;
    props.open = view.dialogStates[dialogId] ?? node.props?.open === true;
    props.onClose = () => eventContext.dialogs.close(dialogId);
  }

  let optionChildren: ReactNode[] | undefined;
  if (node.component === "Select" && Array.isArray(props.options)) {
    optionChildren = toOptionElements(props.options);
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

  // A cloning parent injected these; they must reach the real element.
  for (const [key, value] of Object.entries(injected)) {
    if (FORBIDDEN_PROPS.has(key) && key !== "ref") continue;
    props[key] = composeProp(key, props[key], value);
  }

  // A parent that clones or identity-checks its children cannot see past a
  // boundary. The view's own top-level boundary still contains a throw; only the
  // per-sibling isolation is traded away, and only at these positions.
  const parentInspectsChildren = inspectsChildren(node.component, node.props);

  const childNodes = node.children?.map((child, index) => {
    const key = nodeKey(child, index);
    return parentInspectsChildren ? (
      renderChild(child, key)
    ) : (
      <NodeErrorBoundary key={key} label={`${node.component}[${index}]`}>
        {renderChild(child)}
      </NodeErrorBoundary>
    );
  });

  const children = optionChildren ? [...optionChildren, ...(childNodes ?? [])] : childNodes;

  // Spread rather than passing the array, so one child arrives as one element
  // exactly as JSX would deliver it. Components typed `children: ReactElement`
  // — `Tooltip` — reject an array of one and render nothing at all.
  //
  // Omitted entirely when the document supplied no nodes, so a `children` prop
  // that came from a $ref or a literal is not clobbered by an empty list.
  const element =
    children && children.length > 0
      ? createElement(Component, props, ...children)
      : createElement(Component, props);

  return <NodeErrorBoundary label={node.component}>{element}</NodeErrorBoundary>;
}
