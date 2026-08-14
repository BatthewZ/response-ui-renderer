import { DEFAULT_CATEGORIES, defaultReferenceContracts, type ReferenceCategory } from "../reference/contracts";
import { defaultRegistry, listComponentNames } from "../registry/registry";
import type { ComponentRegistry } from "../registry/types";
import {
  EMPTY_REF_CONTEXT,
  type RefContext,
  refToText,
  resolveDeep,
  resolveRef,
} from "../render/resolve-ref";
import {
  type ComponentContract,
  type ComponentContracts,
  type ComponentNode,
  contractFor,
  type EachNode,
  EVENT_ACTIONS,
  FIELD_BINDING_KEY,
  isComponentNode,
  isCondNode,
  isEachNode,
  isEventHandlerSpec,
  isFieldBinding,
  isNestedEventHandlerSpec,
  isRefValue,
  type PropDoc,
  type ViewNode,
} from "../spec";

/**
 * What a builder knows about the components it can offer, and where it learned
 * it.
 *
 * Every fact here is derived from something the renderer already reads: the
 * registry says which names exist, the contracts say what their props are,
 * which of them are bounded to a set of variants, which `classNames` slots they
 * expose, and how their children behave. Nothing is hand-listed, which is the
 * only reason a host that registers its own components gets a palette, an
 * inspector and a set of variant controls for them on the same terms as the
 * built-in library — the same claim `ViewRenderer`, `validateViewSpec` and the
 * reference generator each make, made once more.
 *
 * A catalogue is a value, not a module-level singleton: two builders on one page
 * may be pointed at different registries.
 */

export type PaletteEntry = {
  /** The addressable name, as a document spells it: `"Card"`, `"Table.Row"`. */
  name: string;
  /** `"Table.Row"` reads as `Row` under a `Table` heading. */
  label: string;
  /** The root of a compound part, or `null` for a component in its own right. */
  parent: string | null;
  category: string;
  /** The one thing an author would otherwise get wrong, from the contract. */
  note?: string;
  /** Whether the palette offers this as somewhere to drop *into*. */
  container: boolean;
};

export type PaletteGroup = {
  category: string;
  /** The category's standing advice, shown once above its components. */
  blurb: string;
  entries: readonly PaletteEntry[];
};

export type BuilderCatalog = {
  /**
   * What the palette browses: the components in their own right, arranged.
   *
   * A compound part is **not** here. It is reached through the root it belongs
   * to or through a search, because a palette that lists it alongside the
   * components is mostly a list of things that only work somewhere specific —
   * with the built-in registry, 72 of 168 entries are parts, and none of them
   * is a choice anyone browsing is making.
   */
  groups: readonly PaletteGroup[];
  /**
   * Any set of entries in that same arrangement: the components that recur
   * first, then the categories in reading order, empty sections left out.
   *
   * The arrangement is one function rather than two so a component keeps its
   * section whether it was browsed to or searched for. Grouping search results
   * separately moved things about under the reader mid-task, and made a
   * collapsed section a different section a keystroke later.
   */
  arrange(entries: readonly PaletteEntry[]): readonly PaletteGroup[];
  entries: readonly PaletteEntry[];
  entry(name: string): PaletteEntry | undefined;
  /** Substring match on the addressable name, so `table.r` finds `Table.Row`. */
  search(query: string): readonly PaletteEntry[];
  /** The parts a compound component is assembled from. */
  parts(name: string): readonly PaletteEntry[];
  /** The node dropping `name` produces. */
  template(name: string): ComponentNode;
  acceptsChildren(name: string): boolean;
  /** The props table, required first. */
  props(name: string): readonly PropDoc[];
  /**
   * Everything the contracts hold about a name.
   *
   * The inspector needs the whole record, not a chosen few fields: which props
   * name an element, which are a heading level, which need coercing. Handing it
   * a reshaped subset is how three of `controlFor`'s branches became
   * unreachable and a bounded prop got a JSON textarea.
   */
  contract(name: string): ComponentContract;
  /** Props bounded to a fixed set of values — the variants. */
  enums(name: string): Readonly<Record<string, readonly string[]>>;
  /** `classNames` slot keys. */
  slots(name: string): readonly string[];
  note(name: string): string | undefined;
  /** Set when `children` is source text the component parses, not nodes. */
  textChildren(name: string): string | undefined;
  /** Set when `children` is a function the component calls, with these args. */
  functionChildren(name: string): { readonly args: readonly string[]; readonly note: string } | undefined;
};

export type BuilderCatalogOptions = {
  /** Defaults to every `@batthewz/response-ui-react-components` export + `Icon`. */
  registry?: ComponentRegistry;
  /**
   * What each name means beyond how to construct it. Defaults to the documented
   * contracts — the ones carrying prop tables and slot keys, which is what an
   * inspector needs. Pass `extendContracts(defaultReferenceContracts, yours)`
   * alongside an extended registry, or your components arrive with a name and
   * nothing else.
   */
  contracts?: ComponentContracts;
  /** Palette sections, in reading order. Defaults to the reference's own. */
  categories?: readonly ReferenceCategory[];
  /**
   * What dropping a component produces, by name. Defaults to templates derived
   * from this package's coverage corpus; `templatesFromDocuments` builds the
   * same thing out of documents of your own.
   */
  templates?: Readonly<Record<string, ViewNode>>;
  /**
   * How often each component is reached for, by name, deciding which lead the
   * palette. Defaults to the counts across every document this package ships;
   * `frequencyFromDocuments` builds the same thing out of documents of your own.
   *
   * Without it there is no leading section at all, which is the honest answer:
   * the components a palette should open on is a claim about how a library is
   * actually used, and nothing here can invent one.
   */
  frequency?: Readonly<Record<string, number>>;
  /**
   * Names to leave out, mapped to why — the shape of `NOT_ADDRESSABLE`.
   * Defaults to the components this package documents as needing host code.
   * They are omitted rather than shown disabled: a palette entry that can only
   * ever be dragged in to fail is worse than one that is not there.
   */
  excluded?: Readonly<Record<string, string>>;
};

const UNCATEGORIZED = "Other";

/** The section the components a document is mostly built from lead with. */
const ESSENTIALS = "Essentials";

/**
 * How many components that section holds.
 *
 * A number about the panel, not about the design system — the same kind of
 * number as the drag threshold. It is however many chips can be taken in
 * without reading them one at a time, and past that the section stops being a
 * shortcut and becomes another list to scan.
 */
const ESSENTIALS_LIMIT = 14;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `"data.user.firstName"` → `"First name"`, for text a binding used to supply. */
export function placeholderFromRef(ref: string): string {
  const leaf = ref.split(".").filter((part) => !/^\d+$/.test(part)).pop() ?? ref;
  const spaced = leaf.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * The literal members of a declared type, when it is a union of string literals.
 *
 * `propEnums` is the authority and covers most of them, because it is generated
 * from the library's declarations. This reads the *type* instead, which is how a
 * host's own component gets variant buttons from nothing but its prop table.
 */
export function literalUnion(type: string): string[] | null {
  const parts = type.split("|").map((part) => part.trim());
  const literals = parts.filter((part) => /^"[^"]*"$/.test(part));
  return literals.length === parts.length && literals.length > 1
    ? literals.map((part) => part.slice(1, -1))
    : null;
}

/**
 * Every component named in a set of documents, as the node that first names it —
 * with the values the document would have resolved for it already in place.
 *
 * The templates come from real documents rather than from a table, because a
 * template is a composition and a contract cannot hold one: a `Table` has to
 * arrive with a head, a row and cells, and a compound component that lands as a
 * bare root cannot be assembled by dragging its parts in one at a time without
 * already knowing the order they go in.
 *
 * The resolution is what makes them usable somewhere else. A corpus node is
 * idiomatic precisely because it is bound — `icon: {"$ref": "milestone.icon"}` —
 * and those bindings mean nothing in a document that has no `data`. Resolving
 * them here, where the document that holds the data is still in hand, turns each
 * one into the literal it stood for: the real icon name, the real series of
 * numbers, the real label. Guessing at them later, from a prop's declared type,
 * is how a `Sparkline` ends up handed the word "Values".
 *
 * Exported so a host can do exactly what this package does with its own corpus —
 * hand the builder the documents it already has, and get idiomatic templates for
 * its own components out of them.
 */
export function templatesFromDocuments(
  documents: Iterable<unknown>,
): Record<string, ComponentNode> {
  const templates: Record<string, ComponentNode> = {};

  /**
   * Keeps the best occurrence of each component seen so far.
   *
   * The *first* is the wrong one, and obviously so once you drop it: the first
   * `Stack` in a corpus is the document's own root, so dragging one in hands you
   * the whole page. The smallest is the right starting point — and the smallest
   * *that has children*, where one exists, because a container that arrives
   * empty is both a worse template and, since this is where the builder reads it
   * from, a container it would then treat as a leaf.
   */
  const offer = (node: ComponentNode, context: RefContext): void => {
    const candidate = prune(resolveNode(node, context));
    const held = templates[node.component];
    if (held === undefined || better(candidate, held)) templates[node.component] = candidate;
  };

  const better = (candidate: ComponentNode, held: ComponentNode): boolean => {
    const candidateNests = (candidate.children?.length ?? 0) > 0;
    const heldNests = (held.children?.length ?? 0) > 0;
    if (candidateNests !== heldNests) return candidateNests;
    return size(candidate) < size(held);
  };

  const walk = (node: unknown, context: RefContext): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, context);
      return;
    }
    if (!isPlainObject(node)) return;

    const viewNode = node as ViewNode;

    if (isEachNode(viewNode)) {
      walk(viewNode.node, withFirstRow(context, viewNode));
      return;
    }

    if (isComponentNode(viewNode)) offer(viewNode, context);

    for (const value of Object.values(node)) walk(value, context);
  };

  /** The node with its own bindings resolved, children and all. */
  const resolveNode = (node: ComponentNode, context: RefContext): ComponentNode => {
    const resolved: ComponentNode = { component: node.component };
    if (node.props) resolved.props = resolveDeep(node.props, context) as Record<string, unknown>;
    if (node.children) {
      resolved.children = node.children.map((child) => resolveChild(child, context));
    }
    return resolved;
  };

  const resolveChild = (child: ViewNode, context: RefContext): ViewNode => {
    if (typeof child === "string") return child;
    if (isEachNode(child)) return resolveChild(child.node, withFirstRow(context, child));
    if (isCondNode(child)) return resolveChild(child.then, context);
    if (isRefValue(child)) return refToText(resolveRef(child.$ref, context)) ?? placeholderFromRef(child.$ref);
    if (isComponentNode(child)) return resolveNode(child, context);
    return child;
  };

  for (const document of documents) {
    walk(rootOf(document), contextOf(document));
  }
  return templates;
}

/**
 * How many times each component is named across a set of documents.
 *
 * The measure of what a library is actually built out of, and the only
 * defensible answer to which components a palette should open on: `Stack` and
 * `Text` are reached for on every page, and a `Sparkline` is reached for by the
 * one page that wants a sparkline. Counting says so; a hand-kept list of
 * favourites would be one more thing to maintain and the first thing to go
 * stale — and it would be a claim this package makes about a host's components
 * on no evidence at all.
 *
 * An occurrence is a node an author *wrote*, so a component inside an `$each`
 * counts once however many rows the loop has: what is being measured is how
 * often somebody reaches for it, not how often it renders.
 *
 * Exported so a host can do what this package does with its own documents.
 */
export function frequencyFromDocuments(documents: Iterable<unknown>): Record<string, number> {
  // Null-prototype, because the keys are component names and a document chooses
  // them: `counts["constructor"]` on an object literal is a function, and
  // `function + 1` is `NaN`.
  const counts: Record<string, number> = Object.create(null) as Record<string, number>;

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isPlainObject(node)) return;
    if (isComponentNode(node as ViewNode)) {
      const name = (node as ComponentNode).component;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    for (const value of Object.values(node)) walk(value);
  };

  for (const document of documents) walk(rootOf(document));
  return counts;
}

/**
 * The loop's alias, bound to the first row.
 *
 * An `$each` names its rows and everything under it is written against one of
 * them, so a node lifted out of a loop carries the values the loop would have
 * given it — the first row's, which is the one a reader of that document has
 * already seen rendered.
 */
function withFirstRow(context: RefContext, node: EachNode): RefContext {
  const rows: unknown = resolveRef(node.$each, context);
  const first: unknown = Array.isArray(rows) ? (rows as unknown[])[0] : undefined;
  return {
    ...context,
    vars: { ...context.vars, [node.as]: first, [`${node.as}Index`]: 0 },
  };
}

/** Nodes in a subtree — the measure of how much a drop would bring with it. */
function size(node: ViewNode): number {
  if (!isComponentNode(node)) return 1;
  return 1 + (node.children ?? []).reduce((total, child) => total + size(child), 0);
}

function depth(node: ViewNode): number {
  if (!isComponentNode(node)) return 1;
  return 1 + (node.children ?? []).reduce((deepest, child) => Math.max(deepest, depth(child)), 0);
}

/**
 * The most a single drop may bring with it.
 *
 * A few components are only ever used around a whole page — an `ErrorBoundary`,
 * an `AppShell` — so even their smallest occurrence in a corpus is that page.
 * Dropping one should hand over the shell, not somebody else's document.
 *
 * Chosen the way the drag threshold is: it is a number about the gesture, not
 * about the design system. Forty nodes is a component with its parts and their
 * contents; past that you are being given a layout to delete.
 */
const NODE_BUDGET = 40;

/** The node with its deepest level dropped, repeatedly, until it fits. */
function prune(node: ComponentNode): ComponentNode {
  let current = node;
  while (size(current) > NODE_BUDGET) {
    const deepest = depth(current);
    // Two levels is a component and its contents; below that there is nothing
    // left to take away that is not the component itself.
    if (deepest <= 2) break;
    current = stripBelow(current, deepest - 1, 1) as ComponentNode;
  }
  return current;
}

function stripBelow(node: ViewNode, level: number, at: number): ViewNode {
  if (!isComponentNode(node) || node.children === undefined) return node;
  if (at >= level) {
    const without = { ...node };
    delete without.children;
    return without;
  }
  return { ...node, children: node.children.map((child) => stripBelow(child, level, at + 1)) };
}

const rootOf = (document: unknown): unknown =>
  isPlainObject(document) && "root" in document ? document.root : document;

/**
 * What a document can supply without a network.
 *
 * Only `static` bindings: an `api` or `source` binding is a promise about
 * runtime, and a template built from one would carry whatever the last person to
 * run it happened to see.
 */
function contextOf(document: unknown): RefContext {
  if (!isPlainObject(document)) return EMPTY_REF_CONTEXT;

  const data: Record<string, unknown> = {};
  const bindings = document.data;
  if (isPlainObject(bindings)) {
    for (const [key, binding] of Object.entries(bindings)) {
      if (isPlainObject(binding) && binding.type === "static") data[key] = binding.value;
    }
  }

  return { data, forms: {}, vars: { state: document.state ?? {} } };
}

export function createBuilderCatalog(options: BuilderCatalogOptions = {}): BuilderCatalog {
  const {
    registry = defaultRegistry,
    contracts = defaultReferenceContracts,
    categories = DEFAULT_CATEGORIES,
    templates = {},
    frequency,
    excluded = {},
  } = options;

  const contract = (name: string): ComponentContract => contractFor(contracts, name) ?? {};

  const staticTemplates = new Map<string, ComponentNode>();

  /**
   * A value for a prop the builder has to fill itself — one a template supplied
   * through a binding it cannot keep, or one nothing has supplied at all.
   *
   * Typed from the contract rather than guessed from the name: a `$ref`
   * standing in for a number must not be replaced by a word, or the component
   * renders a number-shaped hole with text in it.
   */
  const seedValue = (name: string, prop: string): unknown => {
    const values = contract(name).propEnums?.[prop];
    if (values && values.length > 0) return values[0];

    const type = contract(name).props?.find((doc) => doc.key === prop)?.type ?? "";
    const literals = literalUnion(type);
    if (literals) return literals[0];
    if (/^\s*boolean\s*$/.test(type)) return false;
    if (/^\s*number\s*$/.test(type)) return 1;
    if (/\[\]\s*$/.test(type) || /^\s*(readonly\s+)?(Array|ReadonlyArray)\s*</.test(type)) return [];
    if (/^\s*(string|ReactNode|ReactElement|unknown|any)\s*$/.test(type) || type === "") {
      return placeholderFromRef(prop);
    }

    // A type nothing here recognises — a handler, an object, a library type.
    // A word in its place is worse than nothing: `options.map is not a function`
    // is a render error, and an inspector that reads the value as an object
    // shows a control that disagrees with the document. An absent prop is at
    // least the state the component was written to handle.
    return undefined;
  };

  /**
   * A template made safe to drop into somebody else's document.
   *
   * A template is idiomatic precisely because it is bound to data, and that is
   * exactly what cannot come along: a `$ref` into `data.rows` resolves to
   * nothing in a document with no `data`, and a `$field` names a form that was
   * never declared. Each binding is replaced by the nearest static thing rather
   * than deleted, so a required prop stays filled and the dropped component
   * renders something the moment it lands. The structural nodes collapse the
   * same way — a `$each` becomes one instance of what it repeats, a `$cond`
   * becomes its `then`. Both are a document's shape with the binding taken out,
   * which is what a starting point is.
   */
  const staticize = (node: ViewNode): ViewNode | null => {
    if (typeof node === "string") return node;
    if (isEachNode(node)) return staticize(node.node);
    if (isCondNode(node)) return staticize(node.then);
    if (isRefValue(node)) return placeholderFromRef(node.$ref);
    if (!isComponentNode(node)) return null;

    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.props ?? {})) {
      // The canonical field binding is a bare prop *key*, not a value, so a
      // filter that only reads values leaves it behind — and a control bound to
      // a form the new document never declared renders nothing.
      if (key === FIELD_BINDING_KEY) continue;
      const kept = staticizeValue(value, node.component, key);
      if (kept !== undefined) props[key] = kept;
    }

    const children = (node.children ?? [])
      .map(staticize)
      .filter((child): child is ViewNode => child !== null);

    const next: ComponentNode = { component: node.component };
    if (Object.keys(props).length > 0) next.props = props;
    if (children.length > 0) next.children = children;
    return next;
  };

  /**
   * A prop's value, with the bindings taken out. `undefined` drops the prop.
   *
   * A field binding can only be at the *top* of a value, so the two halves are
   * split. A handler cannot: the renderer reads one nested inside an array or
   * object prop too — `CommandPalette.items[].onSelect` is the case its own
   * types name — and those have to go, or dropping a command palette ships four
   * live actions into a document that declares none of the dialogs they open.
   *
   * The nested rule is `isNestedEventHandlerSpec`, not the top-level one, and
   * the difference matters: `{ "action": … }` one level down is very often a
   * data object with a column called `action`, and treating that as a handler
   * deletes real data. The corpus has one — `ActivityFeed`'s items.
   */
  const staticizeValue = (value: unknown, component: string, key: string): unknown => {
    if (isFieldBinding(value) || isEventHandlerSpec(value)) return undefined;
    if (isRefValue(value)) return seedValue(component, key);
    return staticizeNested(value);
  };

  /** Inside a value, only a `$ref` and a `$node` mean anything to the renderer. */
  const staticizeNested = (value: unknown): unknown => {
    if (isNestedEventHandlerSpec(value, EVENT_ACTIONS)) return undefined;
    if (isRefValue(value)) return placeholderFromRef(value.$ref);
    if (isPlainObject(value) && "$node" in value) {
      const inner = staticize(value.$node as ViewNode);
      return inner === null ? undefined : { $node: inner };
    }
    if (Array.isArray(value)) return value.map(staticizeNested);
    if (isPlainObject(value)) {
      const next: Record<string, unknown> = {};
      for (const [nested, item] of Object.entries(value)) {
        const kept = staticizeNested(item);
        if (kept !== undefined) next[nested] = kept;
      }
      return next;
    }
    return value;
  };

  /**
   * A component whose children are a *function's* arrives with none.
   *
   * Its children are written against arguments the component supplies at
   * runtime — the row a `MultiSelect` is currently showing, the item a menu is
   * over — and a document that has just been started supplies none of them. The
   * corpus writes them as an `$each` over exactly those arguments, so lifting
   * one out gives a `MultiSelect.Tag` claiming to be the first of a selection
   * that is empty, which is an error the component raises by name. The simple
   * form is the honest starting point; the children can be authored after.
   */
  const withoutBorrowedChildren = (node: ComponentNode): ComponentNode => {
    if (contract(node.component).functionChildren === undefined) return node;
    const without = { ...node };
    delete without.children;
    return without;
  };

  /**
   * The node with every required prop it is still missing filled in.
   *
   * Two things arrive here short. A component no template speaks for arrives
   * with nothing at all, and a template arrives having just lost a required prop
   * that was supplied through a binding — a `SearchInput` whose `value` came
   * from a `$field` is a controlled input with no value, which React complains
   * about and the author cannot see. Only the required ones: every optional prop
   * a template writes is one the author has to notice and undo.
   */
  const withRequiredProps = (node: ComponentNode): ComponentNode => {
    const props: Record<string, unknown> = { ...node.props };
    for (const doc of contract(node.component).props ?? []) {
      if (doc.optional || props[doc.key] !== undefined) continue;
      const seed = seedValue(node.component, doc.key);
      if (seed !== undefined) props[doc.key] = seed;
    }
    return Object.keys(props).length > 0 ? { ...node, props } : node;
  };

  const template = (name: string): ComponentNode => {
    const cached = staticTemplates.get(name);
    if (cached) return structuredClone(cached);

    const source = templates[name];
    const staticized = source === undefined ? null : staticize(source);
    const built = withRequiredProps(
      withoutBorrowedChildren(
        staticized !== null && isComponentNode(staticized) && staticized.component === name
          ? staticized
          : { component: name },
      ),
    );
    staticTemplates.set(name, built);
    return structuredClone(built);
  };

  /**
   * Whether the palette offers a component as somewhere to drop *into*.
   *
   * A `Markdown` never is: its children are source text, so a component dropped
   * in would not nest, it would be handed to a parser that has no use for it and
   * dropped on the floor — which the validator says in as many words.
   *
   * Everything else is answered by its template, because a template is how a
   * component is actually composed. One with children is a container; one
   * without is an `Input`, a `Divider`, an `Avatar`. A component no template
   * speaks for is treated as a container, which is the forgiving direction: a
   * host that has registered a component and not yet described it can still nest
   * things in it, and the render says immediately whether that was sensible.
   */
  const acceptsChildren = (name: string): boolean => {
    const own = contract(name);
    if (own.textChildren !== undefined) return false;
    if (own.functionChildren !== undefined) return true;
    const source = templates[name];
    if (source === undefined || !isComponentNode(source)) return true;
    return (source.children?.length ?? 0) > 0;
  };

  const toEntry = (name: string): PaletteEntry => {
    const dot = name.indexOf(".");
    const own = contract(name);
    const root = dot === -1 ? null : name.slice(0, dot);
    const entry: PaletteEntry = {
      name,
      label: root === null ? name : name.slice(dot + 1),
      parent: root,
      // A part is documented under its root, which is where its category lives.
      category: own.category ?? (root === null ? UNCATEGORIZED : contract(root).category ?? UNCATEGORIZED),
      container: acceptsChildren(name),
    };
    if (own.note !== undefined) entry.note = own.note;
    return entry;
  };

  /**
   * Required props the template could not fill — the ones `seedValue` refuses
   * to invent, because it has no honest value for their type.
   *
   * `MultiSelect.Item` is the case: its `option` is a `MultiSelectItem`, an
   * object the corpus only ever supplies by mapping the root's filtered list,
   * so a dropped one arrives with nothing to show and the component reads a
   * field off `undefined`.
   */
  const unfilledRequired = (name: string): string[] => {
    const built = template(name);
    return (contract(name).props ?? [])
      .filter((doc) => !doc.optional && built.props?.[doc.key] === undefined)
      .map((doc) => doc.key);
  };

  const unsatisfiable = new Map<string, string[]>();
  const entries = listComponentNames(registry)
    .filter((name) => !Object.hasOwn(excluded, name))
    .filter((name) => {
      const missing = unfilledRequired(name);
      if (missing.length === 0) return true;
      unsatisfiable.set(name, missing);
      return false;
    })
    .map(toEntry);

  // Derived, not listed: whether a drop can succeed is a fact about the
  // contract and the template, and a host's own component earns the same
  // answer without this package having heard of it. Withheld on the rule the
  // `excluded` option already states — a palette entry that can only ever be
  // dragged in to fail is worse than one that is not there — but said out
  // loud, because a component vanishing from a palette with no explanation is
  // the silent drop the rest of this package throws to prevent.
  if (unsatisfiable.size > 0) {
    const listed = [...unsatisfiable]
      .map(([name, keys]) => `${name} (${keys.join(", ")})`)
      .join("; ");
    console.warn(
      `[response-ui-renderer] not offered in the palette, because no value can be derived for a ` +
        `required prop and a dropped one would render broken: ${listed}. Give the prop a template ` +
        `value, or an enumerated set on the contract, to make it droppable.`,
    );
  }

  const blurbs = new Map(categories.map((category) => [category.name, category.blurb]));
  const order = [...categories.map((category) => category.name), UNCATEGORIZED];
  // A category a contract names but the list does not would otherwise take its
  // components out of the palette silently — the failure the reference
  // generator throws on. Here they land under `Other`, which is visible.
  for (const entry of entries) {
    if (!order.includes(entry.category)) entry.category = UNCATEGORIZED;
  }

  const countOf = (name: string): number =>
    frequency !== undefined && Object.hasOwn(frequency, name) ? frequency[name] : 0;

  /**
   * The components that lead the palette, most reached for first.
   *
   * Only ones named *more than once*, so the section means what it says: in a
   * corpus written for coverage every component is named at least once, and a
   * top-14 of a flat distribution is fourteen arbitrary components under a
   * heading claiming they are the ones you want. A corpus that repeats nothing
   * yields no section, which is the truthful outcome.
   *
   * Parts are excluded for the same reason they are excluded from browsing:
   * whatever the counts say, a `Table.Cell` is not somewhere to start.
   *
   * A leading section would collide with a host that already has a category of
   * this name — two sections with one name is a duplicate key and an accordion
   * that opens both at once — and the host's meaning wins, because they said
   * theirs out loud.
   */
  const essentials: readonly PaletteEntry[] = order.includes(ESSENTIALS)
    ? []
    : entries
        .filter((entry) => entry.parent === null && countOf(entry.name) > 1)
        .sort((a, b) => countOf(b.name) - countOf(a.name) || a.name.localeCompare(b.name))
        .slice(0, ESSENTIALS_LIMIT);

  const essentialNames = new Set(essentials.map((entry) => entry.name));

  const byCategory = (a: PaletteEntry, b: PaletteEntry): number =>
    (a.parent ?? a.name).localeCompare(b.parent ?? b.name) || a.name.localeCompare(b.name);

  const arrange = (list: readonly PaletteEntry[]): readonly PaletteGroup[] => {
    const lead: PaletteGroup[] = [];
    // By name, not by identity: `arrange` is a public method and the entries it
    // is handed need only *be* the entries, not be the same objects.
    const present = new Set(list.map((entry) => entry.name));
    const leading = essentials.filter((entry) => present.has(entry.name));
    if (leading.length > 0) {
      lead.push({
        category: ESSENTIALS,
        blurb: "What most documents are built from.",
        // Left in frequency order: the section's whole claim is that these are
        // ranked, and re-sorting it alphabetically throws the ranking away.
        entries: leading,
      });
    }

    return [
      ...lead,
      ...order
        .map((category) => ({
          category,
          blurb: blurbs.get(category) ?? "",
          entries: list
            .filter((entry) => entry.category === category && !essentialNames.has(entry.name))
            .sort(byCategory),
        }))
        .filter((group) => group.entries.length > 0),
    ];
  };

  const groups = arrange(entries.filter((entry) => entry.parent === null));

  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  return {
    groups,
    arrange,
    entries,
    entry: (name) => byName.get(name),
    search(query) {
      const needle = query.trim().toLowerCase();
      if (needle === "") return entries;
      return entries.filter((entry) => entry.name.toLowerCase().includes(needle));
    },
    parts(name) {
      const root = name.includes(".") ? name.slice(0, name.indexOf(".")) : name;
      return entries.filter((entry) => entry.parent === root);
    },
    template,
    acceptsChildren,
    contract,
    props: (name) => [...(contract(name).props ?? [])].sort((a, b) => Number(a.optional) - Number(b.optional)),
    enums: (name) => contract(name).propEnums ?? {},
    slots: (name) => contract(name).slots ?? [],
    note: (name) => contract(name).note,
    textChildren: (name) => contract(name).textChildren,
    functionChildren: (name) => contract(name).functionChildren,
  };
}
