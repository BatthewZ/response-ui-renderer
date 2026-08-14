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
 *
 * What is browsed is the components in their own right. A compound part is
 * offered against the thing it is part of — select a `Table` and its `Row` and
 * `Cell` are the section at the top — or found by searching for it. Listing all
 * of them all of the time is the palette's oldest problem: with the built-in
 * registry it is 72 entries in 168, none of which is a choice anybody browsing
 * is making, and every one of them sits between the reader and one that is.
 */

/**
 * Where a click would land, said the two ways this panel has to say it.
 *
 * One fact, two grammars: a chip's own label completes a sentence about the
 * chip, and the line above the palette has to stand up by itself. They are
 * built together, in one place, so neither can start describing a different
 * drop from the other.
 */
export type Destination = {
  /** Completes "Add to …" in a chip's accessible name. */
  phrase: string;
  /** The same fact, as a line of its own. */
  line: string;
};

/** The compound component the selection sits in, and the parts it takes. */
export type PaletteFamily = {
  name: string;
  parts: readonly PaletteEntry[];
};

type PaletteProps = {
  catalog: BuilderCatalog;
  /** Where a click would put it — shown once, and on every chip. */
  destination: Destination;
  /** The parts on offer for whatever is selected, or `null` for none. */
  family: PaletteFamily | null;
  onDragStart: (payload: DragPayload, event: React.PointerEvent) => void;
  onInsert: (name: string) => void;
  dragging: string | null;
};

export function BuilderPalette({
  catalog,
  destination,
  family,
  onDragStart,
  onInsert,
  dragging,
}: PaletteProps) {
  const [query, setQuery] = useState("");
  const [shut, setShut] = useState<readonly string[]>([]);

  const groups = useMemo(
    () => (query.trim() === "" ? catalog.groups : catalog.arrange(catalog.search(query))),
    [catalog, query],
  );

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

      {/* Where the next one lands, before it is clicked rather than after.
          The builder has always known this — it was only ever in the chips'
          accessible names, so the one reader who could not see it was the one
          holding the mouse.

          Hidden from assistive technology on purpose: every chip already
          carries it, on the control that acts on it. Announced here as well it
          is the same sentence twice, once somewhere it cannot be used. */}
      <p className="rui-builder-destination" aria-hidden="true">
        {destination.line}
      </p>

      <div className="rui-builder-scroll" role="group" aria-label="Components">
        {total === 0 && (
          <p className="rui-builder-empty-note">
            Nothing matches <strong>{query}</strong>.
          </p>
        )}

        {/* The parts of whatever is selected, which is the only moment they are
            a sensible thing to offer. Not while searching: a search already
            reaches them by name, and the same chip in two places at once is one
            of them being in the wrong place. */}
        {!searching && family !== null && (
          <div className="rui-builder-family">
            <h4 className="rui-builder-family-title">Parts of {family.name}</h4>
            <div className="rui-builder-chips">
              {family.parts.map((entry) => (
                <PaletteChip
                  key={entry.name}
                  entry={entry}
                  destination={destination}
                  dragging={dragging === entry.name}
                  // The heading says which component these are parts of, so a
                  // `Table.` on all five of them is the one word on the chip
                  // that carries no information — and it is the word they all
                  // start with, which is the worst place to put it.
                  showParent={false}
                  onDragStart={onDragStart}
                  onInsert={onInsert}
                />
              ))}
            </div>
          </div>
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
  showParent = true,
  onDragStart,
  onInsert,
}: {
  entry: PaletteEntry;
  destination: Destination;
  dragging: boolean;
  /** Off where the surrounding heading already names the parent. */
  showParent?: boolean;
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
      aria-label={`${entry.name}. Add to ${destination.phrase}`}
      onPointerDown={(event) => onDragStart({ kind: "new", name: entry.name }, event)}
      onClick={() => onInsert(entry.name)}
    >
      {/* The accessible name above stays whole either way: `Row` alone is not a
          name a document can spell, and it is the label a screen reader reads
          out of context. */}
      {showParent && entry.parent !== null && (
        <span className="rui-builder-chip-parent">{entry.parent}.</span>
      )}
      {entry.label}
    </button>
  );
}
