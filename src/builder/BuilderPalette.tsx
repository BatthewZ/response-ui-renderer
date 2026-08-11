"use client";

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

  const groups = useMemo(() => {
    if (query.trim() === "") return catalog.groups;
    const matches = new Set(catalog.search(query).map((entry) => entry.name));
    return catalog.groups
      .map((group) => ({ ...group, entries: group.entries.filter((e) => matches.has(e.name)) }))
      .filter((group) => group.entries.length > 0);
  }, [catalog, query]);

  const total = groups.reduce((count, group) => count + group.entries.length, 0);

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

        {groups.map((group) => (
          <section key={group.category} className="rui-builder-group">
            <h4 className="rui-builder-group-title">{group.category}</h4>
            <div className="rui-builder-chips">
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
            </div>
          </section>
        ))}
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
