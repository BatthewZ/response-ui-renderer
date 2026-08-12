"use client";

import { Accordion } from "@batthewz/response-ui-react-components";
import { useMemo, useState } from "react";

import type { BuilderCatalog, PaletteEntry } from "./catalog";
import type { DragPayload } from "./drag";

/**
 * The components a document can be built from, grouped the way the reference
 * groups them and searchable by the name a document would spell.
 *
 * Every entry is both draggable and clickable. The drag is the headline
 * gesture; the click is what makes the palette usable from a keyboard, and it
 * is not a lesser path — it drops into whatever is selected, which is the same
 * decision the drag makes with the pointer instead of with the selection.
 *
 * The sections collapse, and what is tracked is which ones are SHUT rather than
 * which are open: a category the catalog grows later is then open on arrival,
 * which is the state every other category starts in.
 */

type PaletteProps = {
  catalog: BuilderCatalog;
  /** Where a click would put it, described for the button's own label. */
  destination: string;
  onDragStart: (payload: DragPayload, event: React.PointerEvent) => void;
  onInsert: (name: string) => void;
  dragging: string | null;
};

export function BuilderPalette({
  catalog,
  destination,
  onDragStart,
  onInsert,
  dragging,
}: PaletteProps) {
  const [query, setQuery] = useState("");
  const [shut, setShut] = useState<readonly string[]>([]);

  const groups = useMemo(() => {
    if (query.trim() === "") return catalog.groups;
    const matches = new Set(catalog.search(query).map((entry) => entry.name));
    return catalog.groups
      .map((group) => ({ ...group, entries: group.entries.filter((e) => matches.has(e.name)) }))
      .filter((group) => group.entries.length > 0);
  }, [catalog, query]);

  const total = groups.reduce((count, group) => count + group.entries.length, 0);
  const shown = groups.map((group) => group.category);

  // A search that finds something has to show it. Starting one opens every
  // section, or a hit sits behind a heading that was collapsed before anyone
  // thought to search — the panel reads as empty and the entry reads as
  // missing. Only the transition INTO a search does this — refining the query
  // does not — so a section collapsed to quieten a broad search stays collapsed
  // as the query is narrowed, and clearing it leaves them as the search left
  // them.
  const searching = query.trim() !== "";
  const [wasSearching, setWasSearching] = useState(searching);
  if (wasSearching !== searching) {
    setWasSearching(searching);
    if (searching) setShut([]);
  }

  const open = shown.filter((category) => !shut.includes(category));

  const setOpen = (next: string | string[]) => {
    const opened = new Set(Array.isArray(next) ? next : [next]);
    // Only the sections on screen are being answered for. A filtered-out
    // category keeps the state it had, rather than being reopened by a search
    // that never showed it.
    setShut((prev) => [
      ...prev.filter((category) => !shown.includes(category)),
      ...shown.filter((category) => !opened.has(category)),
    ]);
  };

  return (
    <div className="rui-builder-palette">
      <div className="rui-builder-search">
        <input
          type="search"
          className="rui-builder-input"
          value={query}
          placeholder="Search components"
          aria-label="Search components"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="rui-builder-scroll" role="group" aria-label="Components">
        {total === 0 && (
          <p className="rui-builder-empty-note">
            Nothing matches <strong>{query}</strong>.
          </p>
        )}

        <Accordion mode="multiple" value={open} onValueChange={setOpen} headingLevel={4}>
          {groups.map((group) => (
            <Accordion.Item key={group.category} value={group.category} className="rui-builder-group">
              <Accordion.Trigger
                className="rui-builder-group-title"
                classNames={{ chevron: "rui-builder-group-chevron" }}
              >
                {group.category}
              </Accordion.Trigger>
              <Accordion.Content classNames={{ body: "rui-builder-chips" }}>
                {group.entries.map((entry) => (
                  <PaletteChip
                    key={entry.name}
                    entry={entry}
                    destination={destination}
                    dragging={dragging === entry.name}
                    onDragStart={onDragStart}
                    onInsert={onInsert}
                  />
                ))}
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

function PaletteChip({
  entry,
  destination,
  dragging,
  onDragStart,
  onInsert,
}: {
  entry: PaletteEntry;
  destination: string;
  dragging: boolean;
  onDragStart: (payload: DragPayload, event: React.PointerEvent) => void;
  onInsert: (name: string) => void;
}) {
  return (
    <button
      type="button"
      className="rui-builder-chip"
      data-dragging={dragging || undefined}
      data-container={entry.container || undefined}
      // The name a document spells, which is not always what the chip says: a
      // compound part reads as `Row` under `Table`, and a search for `Table.Row`
      // has to find the same thing the tooltip explains.
      title={`${entry.name}${entry.note ? ` — ${entry.note}` : ""}`}
      aria-label={`${entry.name}. Add to ${destination}`}
      onPointerDown={(event) => onDragStart({ kind: "new", name: entry.name }, event)}
      onClick={() => onInsert(entry.name)}
    >
      {entry.parent !== null && <span className="rui-builder-chip-parent">{entry.parent}.</span>}
      {entry.label}
    </button>
  );
}
