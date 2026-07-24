import analyticsDashboard from "./analytics-dashboard.viewspec.json";
import contactForm from "./contact-form.viewspec.json";
import pricingTable from "./pricing-table.viewspec.json";
import productLanding from "./product-landing.viewspec.json";
import teamDirectory from "./team-directory.viewspec.json";

/**
 * Documents produced by a real generator, kept verbatim.
 *
 * They are the package's regression corpus: between them they exercise `$each`,
 * `$cond`, `$ref`, `$field`, forms with validation, compound components and
 * static data bindings. Synthetic fixtures drift towards what the renderer
 * already handles; these do not.
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
