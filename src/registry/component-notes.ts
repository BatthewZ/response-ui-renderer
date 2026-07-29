import notes from "./component-notes.json";

/**
 * The only curated part of the ViewSpec reference: which section a component
 * belongs in, and the one thing an author would otherwise get wrong.
 *
 * Everything else in VIEWSPEC.md is derived — names and compound parts from the
 * library's live barrel, prop types from its shipped declarations. A test
 * asserts this file covers the live registry exactly, so a component added
 * upstream fails the suite until someone decides where it goes.
 */
export type ComponentNote = { category: string; note: string };

export const COMPONENT_NOTES: Readonly<Record<string, ComponentNote>> = notes;
