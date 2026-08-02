import analyticsDashboard from "./analytics-dashboard.viewspec.json";
import contactForm from "./contact-form.viewspec.json";
import pricingTable from "./pricing-table.viewspec.json";
import productLanding from "./product-landing.viewspec.json";
import teamDirectory from "./team-directory.viewspec.json";

/**
 * Exemplar documents, hand-designed and visually verified against the rendered
 * output — each one a distinct, fully themed page a real product could ship.
 *
 * They are the package's regression corpus: between them they exercise `$each`,
 * `$cond`, `$ref`, `$field`, forms with validation, compound components,
 * `themeOverrides` (including full dark palettes), icon resolution and static
 * data bindings. Keep them looking like products, not fixtures — a synthetic
 * fixture drifts towards what the renderer already handles.
 */
export const exampleSpecs = {
  analyticsDashboard,
  contactForm,
  pricingTable,
  productLanding,
  teamDirectory,
} as const;

export {
  analyticsDashboard,
  contactForm,
  pricingTable,
  productLanding,
  teamDirectory,
};
