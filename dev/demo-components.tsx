import { cn } from "@batthewz/response-ui-react-components";
import type { ComponentPropsWithRef } from "react";

import { defaultBuilderTemplates } from "../src/builder";
import { defaultRegistry, extendRegistry } from "../src/index";
import { defaultReferenceContracts } from "../src/reference";
import { type ComponentContracts, extendContracts } from "../src/spec";

/**
 * One component the design system does not ship, registered the way a consumer
 * registers theirs.
 *
 * It exists to be the thing nothing in this package knows about. The registry
 * makes it renderable, the contract makes it validated, documented and — now —
 * editable: the builder reads the same `propEnums` for its variant buttons, the
 * same `slots` for its `classNames` fields and the same prop table for the rest.
 * Nothing about the builder is taught this component's name.
 *
 * A worked example, deliberately not a shipped component: it lives in the demo
 * harness, nothing imports it, and deleting it must break nothing.
 */

type PriceTagProps = {
  amount: string;
  cadence?: string;
  emphasis?: "quiet" | "loud";
  classNames?: { amount?: string; cadence?: string };
} & Omit<ComponentPropsWithRef<"p">, "children">;

function PriceTag({ amount, cadence, emphasis = "quiet", classNames, className, ...rest }: PriceTagProps) {
  return (
    <p className={cn("demo-price", className)} data-emphasis={emphasis} {...rest}>
      <span className={cn("demo-price-amount", classNames?.amount)}>{amount}</span>
      {cadence !== undefined && (
        <span className={cn("demo-price-cadence", classNames?.cadence)}>{cadence}</span>
      )}
    </p>
  );
}

export const DEMO_REGISTRY = extendRegistry(defaultRegistry, { PriceTag });

export const DEMO_CONTRACTS: ComponentContracts = extendContracts(defaultReferenceContracts, {
  PriceTag: {
    category: "Data",
    note: "Registered by this demo page, not by the design system — proof that a host's own component is a first-class citizen here.",
    propEnums: { emphasis: ["quiet", "loud"] },
    slots: ["amount", "cadence"],
    props: [
      { key: "amount", optional: false, type: "string" },
      { key: "cadence", optional: true, type: "string" },
      { key: "emphasis", optional: true, type: '"quiet"|"loud"' },
    ],
  },
});

/**
 * What dropping it produces. A host with documents of its own would derive this
 * from them with `templatesFromDocuments` rather than write one out.
 */
export const DEMO_TEMPLATES = {
  ...defaultBuilderTemplates,
  PriceTag: {
    component: "PriceTag",
    props: { amount: "£29", cadence: "per month", emphasis: "loud" },
  },
} as const;
