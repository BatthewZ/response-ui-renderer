import { type Ref, useMemo } from "react";

import { ViewBuilder } from "../src/builder";
import { lucideIcons } from "../src/icons";
import { useDemoAdapters } from "./adapters";
import { DEMO_CONTRACTS, DEMO_REGISTRY, DEMO_TEMPLATES } from "./demo-components";

interface BuilderPageProps {
  /** The frame focuses this on arrival — see `Site`. */
  ref?: Ref<HTMLElement>;
}

/**
 * The builder, pointed at a registry that is not only the library's.
 *
 * The page could mount `<ViewBuilder />` bare and would look the same for the
 * hundred-odd built-in components. It registers one of its own instead, because
 * the claim worth demonstrating is the one a consumer cares about: a component
 * the builder has never heard of gets a palette entry, an insertion template and
 * a full inspector — variants, slots and all — from the same contract that makes
 * the renderer and the validator understand it. If that ever stopped being true,
 * this page would show it rather than a test having to say so.
 */
export function BuilderPage({ ref }: BuilderPageProps) {
  const adapters = useDemoAdapters();
  const icons = useMemo(() => lucideIcons, []);

  return (
    <main className="pg-builder" ref={ref} tabIndex={-1}>
      <ViewBuilder
        registry={DEMO_REGISTRY}
        contracts={DEMO_CONTRACTS}
        templates={DEMO_TEMPLATES}
        icons={icons}
        adapters={adapters}
        title="Untitled view"
      />
    </main>
  );
}
