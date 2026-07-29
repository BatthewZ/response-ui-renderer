import data from "./data.viewspec.json";
import display from "./display.viewspec.json";
import forms from "./forms.viewspec.json";
import layout from "./layout.viewspec.json";
import media from "./media.viewspec.json";
import navigation from "./navigation.viewspec.json";
import overlays from "./overlays.viewspec.json";

/**
 * One document per component family, together naming every component the
 * registry exposes that is not listed in `not-addressable.ts`.
 *
 * These are the parity evidence: `parity.coverage.test.tsx` renders each one and
 * fails on any component that is neither exercised here nor excused there. They
 * are written to be idiomatic rather than minimal, because they double as the
 * worked examples behind the ViewSpec reference.
 *
 * Separate from `examples/index.ts`, which holds real generator output kept
 * verbatim — these are authored, and must not be mistaken for specimens.
 */
export const coverageSpecs = {
  layout,
  display,
  forms,
  overlays,
  data,
  navigation,
  media,
} as const;
