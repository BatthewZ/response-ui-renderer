import { exampleSpecs } from "../examples";
import { coverageSpecs } from "../examples/coverage";
import { NOT_ADDRESSABLE } from "../examples/not-addressable";
import type { ComponentNode } from "../spec";
import { frequencyFromDocuments, templatesFromDocuments } from "./catalog";

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
 * How often each built-in component is reached for, across every document this
 * package ships — which decides the components the palette opens on.
 *
 * A wider corpus than the templates read, and deliberately. A template wants the
 * *smallest idiomatic occurrence* of one component, which the coverage corpus is
 * built to hold; a count wants the most representative sample of how documents
 * really compose, and `exampleSpecs` is the half of the evidence written to be
 * product-shaped rather than organised by component family. Counting only the
 * coverage documents makes each family look equally busy, because there is one
 * document per family by construction.
 *
 * Both halves are rendered and validated on every test run, so neither can drift
 * into counting something that no longer works.
 */
export const defaultBuilderFrequency: Readonly<Record<string, number>> = frequencyFromDocuments([
  ...Object.values(coverageSpecs),
  ...Object.values(exampleSpecs),
]);

/**
 * The components a document cannot drive, and why — the palette leaves them out.
 *
 * Re-exported under the name the builder's options use, so a host passing its
 * own registry can start from this and add to it.
 */
export const defaultBuilderExclusions: Readonly<Record<string, string>> = NOT_ADDRESSABLE;
