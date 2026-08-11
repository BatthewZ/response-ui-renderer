"use client";

import { Button, Input, Select, Switch, Textarea } from "@batthewz/response-ui-react-components";
import { useId, useState } from "react";

import { isComponentNode, type PropDoc, type ViewNode } from "../spec";
import { describeNode } from "./BuilderLayers";
import type { BuilderCatalog } from "./catalog";
import {
  controlFor,
  describeBinding,
  isBoundValue,
  isPrimaryProp,
  type PropControl,
} from "./prop-controls";
import { childEntries, type NodePath, pathToKey } from "./tree";

/**
 * Everything about the selected node that a document can say.
 *
 * The panel is generated, not written: the prop rows come from the same prop
 * tables the reference prints, the variant buttons from the same `propEnums` the
 * validator checks against, and the `classNames` fields from the same slot keys.
 * So a host's registered component gets this panel too, with no builder-side
 * knowledge of it at all — which is the whole reason none of it is hand-listed.
 */

type InspectorProps = {
  catalog: BuilderCatalog;
  node: ViewNode | null;
  path: NodePath | null;
  /** Whether the node can be moved or removed — the root can be removed only. */
  siblingIndex: number | null;
  siblingCount: number;
  onSetProp: (key: string, value: unknown) => void;
  onSetText: (text: string) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onNudge: (by: number) => void;
  onSelectPath: (path: NodePath) => void;
};

export function BuilderInspector({
  catalog,
  node,
  path,
  siblingIndex,
  siblingCount,
  onSetProp,
  onSetText,
  onRemove,
  onDuplicate,
  onNudge,
  onSelectPath,
}: InspectorProps) {
  const [showAll, setShowAll] = useState(false);

  if (node === null || path === null) {
    return (
      <p className="rui-builder-empty-note">
        Select something on the canvas, or in the structure tree, to edit it.
      </p>
    );
  }

  if (!isComponentNode(node)) {
    const described = describeNode(node);
    return (
      <div className="rui-builder-fields">
        <NodeHeader
          title={described.label}
          kind={described.kind}
          path={path}
          onSelectPath={onSelectPath}
        />
        <p className="rui-builder-note">
          {described.kind === "text"
            ? "Text. Edit it on the component that holds it."
            : "This part of the document binds to data. The builder keeps it as it is — edit it in the JSON."}
        </p>
        <Button type="button" variant="danger" size="sm" onClick={onRemove}>
          Delete
        </Button>
      </div>
    );
  }

  const name = node.component;
  const props = catalog.props(name);
  const slots = catalog.slots(name);
  const note = catalog.note(name);
  const textChildren = catalog.textChildren(name);
  const functionChildren = catalog.functionChildren(name);
  const children = node.children ?? [];
  // `every` on an empty array is true, so a component that takes no children at
  // all would be offered a text editor — and typing in it puts children on a
  // `Divider`, which is a void element and says so by throwing.
  const textOnly =
    children.length > 0 && children.every((child) => typeof child === "string");
  const canHoldText = textOnly || (children.length === 0 && catalog.acceptsChildren(name));

  const contract = catalog.contract(name);
  const rows = propRows(props, catalog.enums(name))
    .map((prop) => ({ prop, control: controlFor(prop, { contract }) }))
    .filter(({ control }) => control.kind !== "forbidden");
  const shown = showAll ? rows : rows.filter(({ prop, control }) => isPrimaryProp(prop, control));
  const hidden = rows.length - shown.length;

  return (
    <div className="rui-builder-fields">
      <NodeHeader title={name} kind="component" path={path} onSelectPath={onSelectPath} />

      <div className="rui-builder-actions">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={siblingIndex === null || siblingIndex === 0}
          onClick={() => onNudge(-1)}
        >
          Move up
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={siblingIndex === null || siblingIndex >= siblingCount - 1}
          onClick={() => onNudge(1)}
        >
          Move down
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={siblingIndex === null}
          onClick={onDuplicate}
        >
          Duplicate
        </Button>
        <Button type="button" size="sm" variant="danger" onClick={onRemove}>
          Delete
        </Button>
      </div>

      {note && <p className="rui-builder-note">{note}</p>}

      {textChildren !== undefined && (
        <p className="rui-builder-note">
          This component parses its children as source text. Write the source below — a component
          dropped inside it contributes nothing and is dropped.
        </p>
      )}

      {functionChildren !== undefined && (
        <p className="rui-builder-note">
          Its children are rendered once per call, with {functionChildren.args.join(", ")} in scope.
        </p>
      )}

      {(textOnly || canHoldText || textChildren !== undefined) && (
        <FieldRow label="Text" hint={children.length === 0 ? "Nothing inside yet" : undefined}>
          {(id) => (
            <Textarea
              id={id}
              rows={textChildren === undefined ? 2 : 6}
              value={children.filter((child) => typeof child === "string").join("")}
              onChange={(event) => onSetText(event.target.value)}
            />
          )}
        </FieldRow>
      )}

      {!textOnly && children.length > 0 && (
        <p className="rui-builder-note">
          Holds {childEntries(node).length} nested{" "}
          {childEntries(node).length === 1 ? "node" : "nodes"} — select one to edit it.
        </p>
      )}

      <h4 className="rui-builder-section">Props</h4>
      {shown.length === 0 && (
        <p className="rui-builder-empty-note">This component declares no props of its own.</p>
      )}
      {shown.map(({ prop, control }) => (
        <PropRow
          key={prop.key}
          prop={prop}
          control={control}
          value={node.props?.[prop.key]}
          onChange={(value) => onSetProp(prop.key, value)}
        />
      ))}
      {hidden > 0 && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowAll(true)}>
          Show {hidden} more {hidden === 1 ? "prop" : "props"}
        </Button>
      )}
      {showAll && rows.length > 0 && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowAll(false)}>
          Show fewer
        </Button>
      )}

      <h4 className="rui-builder-section">Classes</h4>
      <FieldRow
        label="className"
        hint="Written to the document as-is. A utility your CSS build has never seen will not exist at runtime — stay near the design system's own scale."
      >
        {(id) => (
          <Input
            id={id}
            value={typeof node.props?.className === "string" ? node.props.className : ""}
            onChange={(event) => onSetProp("className", event.target.value || undefined)}
          />
        )}
      </FieldRow>

      {slots.map((slot) => (
        <FieldRow key={slot} label={`classNames.${slot}`}>
          {(id) => (
            <Input
              id={id}
              value={slotValue(node.props?.classNames, slot)}
              onChange={(event) =>
                onSetProp("classNames", nextSlots(node.props?.classNames, slot, event.target.value))
              }
            />
          )}
        </FieldRow>
      ))}
    </div>
  );
}

/**
 * The props to draw a row for: the prop table, plus any bounded prop the table
 * does not mention.
 *
 * The two are generated from different things — the table from the library's
 * declaration files, the value sets from its source — and they do not always
 * agree. Five components, `Timeline.Item` among them, carry `propEnums` for a
 * prop with no row, and drawing only the table left the inspector saying "this
 * component declares no props of its own" while holding that component's
 * variants.
 */
function propRows(
  props: readonly PropDoc[],
  enums: Readonly<Record<string, readonly string[]>>,
): readonly PropDoc[] {
  const known = new Set(props.map((prop) => prop.key));
  const extra = Object.keys(enums)
    .filter((key) => !known.has(key))
    .map((key) => ({ key, optional: true, type: enums[key].map((v) => `"${v}"`).join("|") }));
  return [...props, ...extra];
}

function slotValue(classNames: unknown, slot: string): string {
  if (typeof classNames !== "object" || classNames === null) return "";
  const value = (classNames as Record<string, unknown>)[slot];
  return typeof value === "string" ? value : "";
}

function nextSlots(
  classNames: unknown,
  slot: string,
  value: string,
): Record<string, string> | undefined {
  const base: Record<string, string> = {};
  if (typeof classNames === "object" && classNames !== null) {
    for (const [key, existing] of Object.entries(classNames)) {
      if (typeof existing === "string") base[key] = existing;
    }
  }
  if (value === "") delete base[slot];
  else base[slot] = value;
  return Object.keys(base).length === 0 ? undefined : base;
}

function NodeHeader({
  title,
  kind,
  path,
  onSelectPath,
}: {
  title: string;
  kind: string;
  path: NodePath;
  onSelectPath: (path: NodePath) => void;
}) {
  return (
    <header className="rui-builder-node-head">
      <h3 className="rui-builder-node-name" data-kind={kind}>
        {title}
      </h3>
      <nav className="rui-builder-crumbs" aria-label="Ancestors">
        <button type="button" className="rui-builder-crumb" onClick={() => onSelectPath([])}>
          root
        </button>
        {path.map((step, index) => (
          <button
            key={pathToKey(path.slice(0, index + 1))}
            type="button"
            className="rui-builder-crumb"
            onClick={() => onSelectPath(path.slice(0, index + 1))}
          >
            {String(step)}
          </button>
        ))}
      </nav>
    </header>
  );
}

/**
 * A labelled field.
 *
 * The label is pointed at the control by id, so `children` is a function of
 * that id rather than a node: a `<label for>` aimed at the wrapping element
 * instead names something that cannot be labelled, and screen readers announce
 * the field as unlabelled while it looks correct on screen.
 */
function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="rui-builder-field">
      <label className="rui-builder-label" htmlFor={id}>
        {label}
      </label>
      <div className="rui-builder-control">{children(id)}</div>
      {hint !== undefined && (
        <p className="rui-builder-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

function PropRow({
  prop,
  control,
  value,
  onChange,
}: {
  prop: PropDoc;
  control: PropControl;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = `${prop.key}${prop.optional ? "" : " *"}`;

  if (isBoundValue(value)) {
    return (
      <FieldRow label={label}>
        {(id) => (
          <div className="rui-builder-bound" id={id}>
            <span>{describeBinding(value)}</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)}>
              Clear
            </Button>
          </div>
        )}
      </FieldRow>
    );
  }

  switch (control.kind) {
    case "enum":
      return (
        <FieldRow label={label}>
          {(id) =>
            control.values.length <= 6 && control.values.every((v) => v.length <= 12) ? (
              // A pressed button says "this is the value" where a select would
              // hide five of six variants behind a click. Pressing the pressed
              // one clears the prop, which is the only way back to the
              // component's own default once a variant has been chosen.
              <div className="rui-builder-segments" role="group" aria-labelledby={id}>
                {control.values.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="rui-builder-segment"
                    aria-pressed={value === option}
                    onClick={() => onChange(value === option ? undefined : option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <Select
                id={id}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => onChange(event.target.value || undefined)}
              >
                <option value="">unset</option>
                {control.values.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            )
          }
        </FieldRow>
      );

    case "boolean":
      return (
        <FieldRow label={label}>
          {(id) => (
            <Switch
              id={id}
              checked={value === true}
              onCheckedChange={(checked) => onChange(checked ? true : undefined)}
            />
          )}
        </FieldRow>
      );

    case "number":
      return (
        <FieldRow label={label}>
          {(id) => (
            <Input
              id={id}
              type="number"
              value={typeof value === "number" ? String(value) : ""}
              onChange={(event) =>
                onChange(event.target.value === "" ? undefined : Number(event.target.value))
              }
            />
          )}
        </FieldRow>
      );

    case "text":
    case "node":
      return (
        <FieldRow label={label}>
          {(id) => (
            <Input
              id={id}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => onChange(event.target.value || undefined)}
            />
          )}
        </FieldRow>
      );

    case "action":
      return (
        <ActionRow label={label} actions={control.actions} value={value} onChange={onChange} />
      );

    case "json":
      return <JsonRow label={label} type={control.type} value={value} onChange={onChange} />;

    case "forbidden":
      // Filtered out before it gets here — the renderer never passes it to an
      // element, so a control for it would edit nothing.
      return null;
  }
}

/**
 * A handler, in the only spelling a document has for one.
 *
 * The action names are the renderer's own vocabulary, so this can never offer
 * one the renderer would refuse; the payload is free-form because each action
 * takes a different one, and the validator is what has the last word on it.
 */
function ActionRow({
  label,
  actions,
  value,
  onChange,
}: {
  label: string;
  actions: readonly string[];
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const current = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const action = typeof current.action === "string" ? current.action : "";
  const payload = current.payload === undefined ? "" : JSON.stringify(current.payload, null, 2);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  return (
    <FieldRow label={label} hint={invalid ? "Not valid JSON — the payload is unchanged." : undefined}>
      {(id) => (
        <>
          <Select
            id={id}
            value={action}
            onChange={(event) =>
              onChange(
                event.target.value === "" ? undefined : { ...current, action: event.target.value },
              )
            }
          >
            <option value="">no action</option>
            {actions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          {action !== "" && (
            <Textarea
              rows={3}
              aria-label={`${label} payload`}
              value={draft ?? payload}
              error={invalid}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={(event) => {
                const text = event.target.value.trim();
                setDraft(null);
                if (text === "") {
                  setInvalid(false);
                  onChange({ action });
                  return;
                }
                try {
                  onChange({ action, payload: JSON.parse(text) as unknown });
                  setInvalid(false);
                } catch {
                  setInvalid(true);
                }
              }}
            />
          )}
        </>
      )}
    </FieldRow>
  );
}

/**
 * A value with a shape no control can stand in for — a column definition, a set
 * of options, a date range.
 *
 * Editing it as JSON is not a fallback so much as the truth: this is a JSON
 * document, and the type is shown beside the field so there is something to
 * write against. A parse failure leaves the document alone and says so, rather
 * than writing a string where an object was.
 */
function JsonRow({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const text = value === undefined ? "" : JSON.stringify(value, null, 2);

  return (
    <FieldRow label={label} hint={invalid ? `Not valid JSON. Expected ${type}.` : type}>
      {(id) => (
        <Textarea
          id={id}
          rows={3}
          value={draft ?? text}
          error={invalid}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => {
            const next = event.target.value.trim();
            setDraft(null);
            if (next === "") {
              setInvalid(false);
              onChange(undefined);
              return;
            }
            try {
              onChange(JSON.parse(next) as unknown);
              setInvalid(false);
            } catch {
              setInvalid(true);
            }
          }}
        />
      )}
    </FieldRow>
  );
}
