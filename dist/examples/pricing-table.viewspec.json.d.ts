declare const _default: {
  "version": 1,
  "title": "Pricing Table",
  "description": "A three-tier pricing comparison with feature lists, badges, and call-to-action buttons",
  "data": {
    "tiers": {
      "type": "static",
      "value": [
        {
          "name": "Starter",
          "price": "$0",
          "period": "forever",
          "description": "Perfect for trying things out",
          "featured": false,
          "features": ["5 projects", "1 GB storage", "Community support", "Basic analytics"]
        },
        {
          "name": "Pro",
          "price": "$29",
          "period": "per month",
          "description": "For professionals and growing teams",
          "featured": true,
          "features": ["Unlimited projects", "100 GB storage", "Priority support", "Advanced analytics", "Custom domains", "Team collaboration"]
        },
        {
          "name": "Enterprise",
          "price": "$99",
          "period": "per month",
          "description": "For large organizations at scale",
          "featured": false,
          "features": ["Everything in Pro", "Unlimited storage", "Dedicated support", "Custom integrations", "SLA guarantee", "SSO & SAML", "Audit logs"]
        }
      ]
    }
  },
  "root": {
    "component": "Container",
    "props": { "size": "xl" },
    "children": [
      {
        "component": "Stack",
        "props": { "gap": "r2" },
        "children": [
          {
            "component": "Stack",
            "props": { "gap": "r5" },
            "children": [
              { "component": "Text", "props": { "variant": "h2" }, "children": ["Simple, Transparent Pricing"] },
              {
                "component": "Text",
                "props": { "variant": "body-1", "color": "secondary" },
                "children": ["Choose the plan that's right for you. All plans include a 14-day free trial."]
              }
            ]
          },
          {
            "component": "Row",
            "props": { "gap": "r4", "wrap": true, "align": "stretch" },
            "children": [
              {
                "$each": "data.tiers",
                "as": "tier",
                "node": {
                  "component": "Card",
                  "props": { "padding": "r3" },
                  "children": [
                    {
                      "component": "Stack",
                      "props": { "gap": "r4" },
                      "children": [
                        {
                          "component": "Row",
                          "props": { "gap": "r5", "align": "center" },
                          "children": [
                            { "component": "Text", "props": { "variant": "h4" }, "children": [{ "$ref": "tier.name" }] },
                            {
                              "$cond": "tier.featured",
                              "then": { "component": "Badge", "props": { "variant": "info", "children": "Popular" } }
                            }
                          ]
                        },
                        {
                          "component": "Row",
                          "props": { "gap": "r6", "align": "baseline" },
                          "children": [
                            { "component": "Text", "props": { "variant": "h2" }, "children": [{ "$ref": "tier.price" }] },
                            { "component": "Text", "props": { "variant": "body-2", "color": "muted" }, "children": [{ "$ref": "tier.period" }] }
                          ]
                        },
                        {
                          "component": "Text",
                          "props": { "variant": "body-2", "color": "secondary" },
                          "children": [{ "$ref": "tier.description" }]
                        },
                        { "component": "Divider" },
                        {
                          "component": "Stack",
                          "props": { "gap": "r5" },
                          "children": [
                            {
                              "$each": "tier.features",
                              "as": "feat",
                              "node": {
                                "component": "Text",
                                "props": { "variant": "body-2" },
                                "children": [{ "$ref": "feat" }]
                              }
                            }
                          ]
                        },
                        {
                          "component": "Button",
                          "props": {
                            "variant": "primary",
                            "onClick": {
                              "action": "showToast",
                              "payload": { "message": "Starting your free trial!", "variant": "success" }
                            }
                          },
                          "children": ["Get Started"]
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
;

export default _default;
