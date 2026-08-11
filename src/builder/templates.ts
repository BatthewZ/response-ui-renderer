import { coverageSpecs } from "../examples/coverage";
import { NOT_ADDRESSABLE } from "../examples/not-addressable";
import type { ComponentNode } from "../spec";
import { templatesFromDocuments } from "./catalog";

/**
 * What dropping each built-in component produces, taken from the coverage
 * corpus.
 *
 * The corpus is the right source because of what it already is: seven documents
 * that between them name every addressable component, written to be idiomatic
 * rather than minimal, and rendered and validated on every test run by
 * `parity.coverage.test.tsx`. A hand-written table of starting nodes would be a
 * second set of examples with no gate on it, and it would be the one that went
 * wrong.
 *
 * Derived at import rather than generated into a file. Generating one was tried
 * and is *bigger*: the templates share subtrees — the card inside the stack
 * inside the shell — and a file with one entry per component writes each of them
 * out again. The corpus is the compressed form of its own templates.
 *
 * The bindings in them do not survive the trip — `createBuilderCatalog` replaces
 * each with the value the source document resolved for it, since a `$ref` into
 * `data.rows` means nothing in a document that has no `data` yet.
 */
export const defaultBuilderTemplates: Readonly<Record<string, ComponentNode>> =
  templatesFromDocuments(Object.values(coverageSpecs));

/**
 * The components a document cannot drive, and why — the palette leaves them out.
 *
 * Re-exported under the name the builder's options use, so a host passing its
 * own registry can start from this and add to it.
 */
export const defaultBuilderExclusions: Readonly<Record<string, string>> = NOT_ADDRESSABLE;
