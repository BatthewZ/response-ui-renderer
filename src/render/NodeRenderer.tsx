"use client";

import { createElement, type ReactNode, useId } from "react";

import { composeProp, inspectsChildren } from "../registry/child-introspection";
import { defaultContracts } from "../registry/default-contracts";
import { argsToVars } from "../registry/function-children";
import { Icon } from "../registry/Icon";
import { parseIsoDate, parseIsoDateRange, toKeyAccessor } from "../registry/prop-coercions";
import { type ComponentRegistry, lookupComponent } from "../registry/types";
import { type ComponentContracts, contractFor, ownProp } from "../spec/contracts";
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
  EVENT_ACTIONS,
  FORBIDDEN_PROPS,
  isAttributeBagProp,
  isDangerousUrl,
  isElementProp,
  isForbiddenAsElement,
  isForbiddenHeadingLevel,
  isForbiddenProp,
  isHeadingLevelProp,
  isNestedForbiddenKey,
  isNestedUrlKey,
  isUrlProp,
  MAX_NODE_DEPTH,
} from "../spec/validate";
import { childrenToText } from "./children-text";
import { RENDER_DIAGNOSTIC_CLASSES } from "./diagnostics";
import { createEventCallback, type EventHandlerContext } from "./event-handler";
import type { FormState } from "./form-state";
import { isIdScopedProp, scopeIdValue } from "./id-scope";
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
  /**
   * What each registered name means beyond how to construct it. Defaults to the
   * built-in library's; extend it whenever the registry is extended, or a
   * host's component renders with none of the translations the library's get.
   */
  contracts?: ComponentContracts;
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

/**
 * Disambiguates a key that has already been used by an earlier sibling.
 *
 * `nodeKey` reaches past `id` into props that are not identity at all, and two
 * honest siblings can therefore derive the same key: `value` is a `Rating`'s
 * score and a `Meter`'s reading, so two ratings of 4 collide, and a radio group
 * shares one `name` on purpose. React answers a repeated key by warning that it
 * may duplicate or omit one of the children, so a document that means both is
 * not owed that — the repeat is resolved here.
 *
 * Only a key that has *already appeared among these siblings* is changed, which
 * is what keeps this off documents that were well-formed to begin with: their
 * keys, and so what React reconciles across a reorder, are exactly what they
 * were before. Fixing it the other way — dropping `value` from the chain — would
 * renumber keys in documents that never had a problem.
 */
function uniqueChildKey(key: string, used: Set<string>): string {
  let candidate = key;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${key}#${suffix++}`;
  used.add(candidate);
  return candidate;
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
  contracts = defaultContracts,
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
      contracts={contracts}
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
          contracts={contracts}
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

  const contract = contractFor(contracts, node.component);
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
  /**
   * Drops the attribute keys a spread bag must not carry, at any depth.
   *
   * Separate from `coerceNested` because a `$ref` returns a whole object the
   * walk never entered: `imgProps: { "$ref": "bag" }` resolved to a record with
   * `srcDoc` and `srcSet` in it and handed the lot to the element. Same lesson
   * the top-level filter learned about references, one level down.
   */
  const scrubBag = (value: unknown, valueDepth: number): unknown => {
    if (valueDepth > MAX_PROP_DEPTH) return value;
    if (Array.isArray(value)) return value.map((item) => scrubBag(item, valueDepth + 1));
    if (typeof value !== "object" || value === null) return value;
    if (Object.getPrototypeOf(value) !== Object.prototype) return value;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (isNestedForbiddenKey(key)) continue;
      if (isNestedUrlKey(key) && isDangerousUrl(item)) continue;
      out[key] = scrubBag(item, valueDepth + 1);
    }
    return out;
  };

  const coerceNested = (
    value: unknown,
    path: string,
    valueDepth: number,
    /** True once inside a prop the component spreads onto an element. */
    inBag: boolean,
  ): unknown => {
    if (valueDepth > MAX_PROP_DEPTH) return value;

    if (isRefValue(value)) {
      const resolved = resolveRef(value.$ref, refContext);
      return inBag ? scrubBag(resolved, valueDepth) : resolved;
    }

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
      return value.map((item, index) => coerceNested(item, `${path}.${index}`, valueDepth + 1, inBag));
    }

    if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value)) {
        // Only inside a bag the component spreads onto an element. Applied to
        // every nested key instead, this emptied `DataTable` cells holding
        // "Approve: pending review" — `action` and `cite` are ordinary field
        // names and ordinary prose parses as a scheme. Attributes here, data
        // everywhere else.
        if (inBag && isNestedForbiddenKey(key)) continue;
        const childInBag = inBag || isAttributeBagProp(key);
        const nested = coerceNested(item, `${path}.${key}`, valueDepth + 1, childInBag);
        if (inBag && isNestedUrlKey(key) && isDangerousUrl(nested)) continue;
        out[key] = nested;
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
    if (isForbiddenProp(key)) continue;

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

    const coercion = ownProp(contract.coercions, key);

    // The one coercion that must run BEFORE resolution: a column's `render` is a
    // `$node` template, and `coerceNested` would render it to an element where
    // the column def needs the function that wraps it.
    //
    // Guarded on the prop not being a sink, because this branch `continue`s and
    // so stands in front of every check below it. No in-tree contract coerces a
    // URL prop this way, but `extendContracts` lets a host declare one, and a
    // filter that a caller can step around by naming a coercion is not a filter.
    if (
      coercion === "columnDefs" &&
      Array.isArray(value) &&
      !isUrlProp(key, contract) &&
      !isElementProp(key, contract)
    ) {
      props[key] = value.map((column) => coerceColumnDef(column));
      continue;
    }

    const resolved = coerceNested(value, key, 0, isAttributeBagProp(key));

    // Everything below reads the RESOLVED value, not the literal: a `$ref` is an
    // object until it is resolved, so a rule that tests the literal silently
    // passes every indirect spelling straight through. Not a per-rule choice — a
    // document may write `{"$ref": …}` in any prop position, so any check that is
    // selected by the key but decides by the value's *shape* belongs on this side.
    //
    // For the URL filter that is a security property: `data` can be an api
    // binding, which makes a remote response able to put a `data:text/html` URL
    // in an href. React blocks `javascript:` itself, which masked this —
    // `vbscript:` and `data:` have no such backstop.
    //
    // `contract` is what makes this see a prop the component renames on the way
    // in: `Swimlane.viewAllHref` and `AppShell.SidebarLink.to` are both an href
    // at the element, and the universal DOM names alone never looked at either.
    if (isUrlProp(key, contract) && isDangerousUrl(resolved)) continue;

    // Which element to render is the same kind of decision as which URL to
    // follow, and was open in the same way. `as: "script"` needs no URL at all —
    // its children are the payload — and `as: "iframe"` carries `srcDoc`, which
    // is raw HTML in the embedder's own origin. Dropping the prop leaves the
    // component on its default element, which renders.
    if (isElementProp(key, contract) && isForbiddenAsElement(resolved)) continue;

    // `Accordion.headingLevel` is interpolated as `h${level}`, so the document
    // supplies a fragment rather than a tag: "eader" rendered a <header>. The
    // `h` prefix caps this short of script execution, which is why it is a
    // narrower check and not the element allowlist.
    if (isHeadingLevelProp(key, contract) && isForbiddenHeadingLevel(resolved)) continue;

    // The same shape again: several documents on one page share a DOM id
    // namespace, and only the resolved value can be prefixed — a host walking
    // the spec first sees `{"$ref": …}`, and an `api` binding has no value yet.
    if (view.idScope && isIdScopedProp(contract, key)) {
      props[key] = scopeIdValue(resolved, view.idScope);
      continue;
    }

    // Icon-name strings are coerced by key shape, so — unlike the `$` markers —
    // this stays at the top level: a data row with an `icon` column must not
    // silently become an element. Nested slots use `$node` instead.
    if (isIconProp(key) && typeof resolved === "string") {
      // Most slots are typed ReactNode and want an element; a few are typed
      // LucideIcon and are invoked as a component. Handing over the wrong one
      // throws inside the library rather than degrading.
      props[key] = contract.iconComponentProps?.includes(key)
        ? () => <Icon name={resolved} />
        : <Icon name={resolved} />;
      continue;
    }

    if (coercion === "isoDate") {
      props[key] = parseIsoDate(resolved);
      continue;
    }
    if (coercion === "isoDateRange") {
      props[key] = parseIsoDateRange(resolved);
      continue;
    }
    if (coercion === "keyAccessor") {
      props[key] = toKeyAccessor(resolved);
      continue;
    }

    props[key] = resolved;
  }

  // The bare key is canonical, so it wins when both spellings appear.
  const bareFieldPath = node.props?.[FIELD_BINDING_KEY];
  if (typeof bareFieldPath === "string") boundFieldPath = bareFieldPath;
  if (boundFieldPath !== undefined) applyFieldBinding(boundFieldPath);

  // Dialog visibility is owned by the renderer so openDialog/closeDialog work.
  // Without an explicit id the dialog is still controllable by its own onClose,
  // but no action can target it — useId keeps that fallback stable across renders.
  //
  // The state key is the document's LITERAL id, deliberately not the scoped one
  // that reached the DOM: `dialogStates` is already per-ViewRenderer, so it needs
  // no namespacing, and keeping the two separate is what lets an `openDialog`
  // payload go on naming the id the document wrote.
  if (contract.dialog) {
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

  // A root that parses `children` takes the document's children as one string.
  // Rendered as nodes they would arrive as elements where a string was expected
  // and the parser dies, taking the whole subtree with it.
  //
  // Only when the document supplied children, so a `children` prop that came
  // from a `$ref` or a literal still stands — that is the other spelling of the
  // same thing, and it already resolves to a string on its own.
  if (contract.textChildren !== undefined && node.children && node.children.length > 0) {
    return (
      <NodeErrorBoundary label={node.component}>
        {createElement(Component, { ...props, children: childrenToText(node.children, refContext) })}
      </NodeErrorBoundary>
    );
  }

  // A parent that clones or identity-checks its children cannot see past a
  // boundary. The view's own top-level boundary still contains a throw; only the
  // per-sibling isolation is traded away, and only at these positions.
  const parentInspectsChildren = inspectsChildren(contract, node.props);

  const usedChildKeys = new Set<string>();
  const childNodes = node.children?.map((child, index) => {
    const key = uniqueChildKey(nodeKey(child, index), usedChildKeys);
    return parentInspectsChildren ? (
      renderChild(child, key)
    ) : (
      <NodeErrorBoundary key={key} label={`${node.component}[${index}]`}>
        {renderChild(child)}
      </NodeErrorBoundary>
    );
  });

  const children = optionChildren ? [...optionChildren, ...(childNodes ?? [])] : childNodes;

  // `MultiSelect` and `CommandPalette` type `children` as a function they call
  // with their own filtered list, so nodes handed over as nodes are invoked and
  // throw. Render them inside the call instead, with the arguments bound as
  // reference names — the component stays the only writer of the data, the
  // document becomes the only writer of the presentation.
  //
  // Omitting children leaves this untouched, so the component's default tree is
  // exactly what it was.
  const functionChildren = contract.functionChildren;
  const asFunctionChildren =
    functionChildren && children && children.length > 0
      ? (...received: unknown[]) => (
          <ViewContextExtender vars={argsToVars(received, functionChildren.args)}>
            {children}
          </ViewContextExtender>
        )
      : undefined;

  // Spread rather than passing the array, so one child arrives as one element
  // exactly as JSX would deliver it. Components typed `children: ReactElement`
  // — `Tooltip` — reject an array of one and render nothing at all.
  //
  // Omitted entirely when the document supplied no nodes, so a `children` prop
  // that came from a $ref or a literal is not clobbered by an empty list.
  const element = asFunctionChildren
    ? createElement(Component, { ...props, children: asFunctionChildren })
    : children && children.length > 0
      ? createElement(Component, props, ...children)
      : createElement(Component, props);

  return <NodeErrorBoundary label={node.component}>{element}</NodeErrorBoundary>;
}
