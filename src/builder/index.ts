/**
 * `@batthewz/response-ui-renderer/builder` — a drag-and-drop editor that
 * produces a ViewSpec, and the few pieces a different one would be built on.
 *
 * A separate entry point because none of it is needed to render a document: it
 * carries the documented contracts (the prop tables an inspector draws), the
 * insertion templates, and a UI. A page that mounts `ViewRenderer` pays for
 * none of it.
 *
 * **Deliberately small.** This package is young and this is the youngest part
 * of it, so what is exported is what a host actually needs to point the editor
 * at its own components, or to address a document by path while building
 * something else: the component, the catalogue, the tree, the drop rules and the
 * canvas instrumentation. The editor's own pointer tuning, its command layer,
 * its reducer and its control-choosing all stayed inside, because every one of
 * them is a shape that will move and none of them is a thing to build on.
 * Exporting a name is easy later; withdrawing one is a minor version.
 */

export {
  type BuilderCatalog,
  type BuilderCatalogOptions,
  createBuilderCatalog,
  type PaletteEntry,
  type PaletteGroup,
  templatesFromDocuments,
} from "./catalog";
export {
  canMove,
  type DropPosition,
  type DropTarget,
  dropTargetAt,
  type DropZone,
  resolveDrop,
  zoneFor,
  type ZoneOptions,
} from "./drop";
export {
  BUILDER_PATH_ATTR,
  BUILDER_PATH_SELECTOR,
  elementForPath,
  instrument,
  instrumentSpec,
  pathFromElement,
} from "./instrument";
export { defaultBuilderExclusions, defaultBuilderTemplates } from "./templates";
export {
  groupThemeTokens,
  THEME_TOKEN_GROUPS,
  THEME_TOKENS,
  type ThemeToken,
  type ThemeTokenGroup,
} from "./theme-contract";
export {
  type BuilderDocument,
  childEntries,
  countNodes,
  depthOf,
  emptyDocument,
  fromSpec,
  insertAt,
  isWithin,
  keyToPath,
  moveNode,
  nodeAt,
  type NodePath,
  parentPath,
  pathToKey,
  removeAt,
  replaceAt,
  ROOT_PATH,
  samePath,
  toSpec,
  updateAt,
} from "./tree";
export { ViewBuilder, type ViewBuilderProps } from "./ViewBuilder";
