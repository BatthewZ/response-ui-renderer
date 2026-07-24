var title = "Analytics Dashboard";
var description = "A metrics dashboard with stat cards, progress tracking, and activity timeline";
var data = {
	"metrics": {
		"type": "static",
		"value": [
			{
				"label": "Total Users",
				"value": "12,493",
				"trend": 12,
				"direction": "up"
			},
			{
				"label": "Revenue",
				"value": "$48,259",
				"trend": 8,
				"direction": "up"
			},
			{
				"label": "Active Sessions",
				"value": "1,429",
				"trend": -3,
				"direction": "down"
			},
			{
				"label": "Conversion Rate",
				"value": "3.24%",
				"trend": .5,
				"direction": "up"
			}
		]
	},
	"projects": {
		"type": "static",
		"value": [
			{
				"name": "Website Redesign",
				"progress": 75
			},
			{
				"name": "Mobile App",
				"progress": 45
			},
			{
				"name": "API v2",
				"progress": 90
			},
			{
				"name": "Design System",
				"progress": 60
			}
		]
	},
	"activities": {
		"type": "static",
		"value": [
			{
				"title": "Design review completed",
				"date": "Feb 15, 2026",
				"status": "Completed"
			},
			{
				"title": "API integration started",
				"date": "Feb 18, 2026",
				"status": "In Progress"
			},
			{
				"title": "User testing scheduled",
				"date": "Feb 22, 2026",
				"status": "Planned"
			},
			{
				"title": "Performance audit",
				"date": "Feb 25, 2026",
				"status": "Planned"
			}
		]
	},
	"showWelcome": {
		"type": "static",
		"value": true
	}
};
var root = {
	"component": "Container",
	"children": [{
		"component": "Stack",
		"props": { "gap": "r3" },
		"children": [
			{
				"component": "Text",
				"props": { "variant": "h2" },
				"children": ["Dashboard"]
			},
			{
				"$cond": "data.showWelcome",
				"then": {
					"component": "Alert",
					"props": { "variant": "info" },
					"children": ["Welcome back! Your analytics have been updated."]
				}
			},
			{
				"component": "Row",
				"props": {
					"gap": "r4",
					"wrap": true
				},
				"children": [{
					"$each": "data.metrics",
					"as": "metric",
					"node": {
						"component": "StatCard",
						"children": [
							{
								"component": "StatCard.Value",
								"props": { "children": { "$ref": "metric.value" } }
							},
							{
								"component": "StatCard.Label",
								"props": { "children": { "$ref": "metric.label" } }
							},
							{
								"component": "StatCard.Trend",
								"props": {
									"value": { "$ref": "metric.trend" },
									"direction": { "$ref": "metric.direction" }
								}
							}
						]
					}
				}]
			},
			{
				"component": "Tabs",
				"props": {
					"defaultValue": "progress",
					"variant": "underline"
				},
				"children": [
					{
						"component": "Tabs.List",
						"children": [{
							"component": "Tabs.Tab",
							"props": { "value": "progress" },
							"children": ["Project Progress"]
						}, {
							"component": "Tabs.Tab",
							"props": { "value": "activity" },
							"children": ["Recent Activity"]
						}]
					},
					{
						"component": "Tabs.Panel",
						"props": { "value": "progress" },
						"children": [{
							"component": "Stack",
							"props": { "gap": "r4" },
							"children": [{
								"$each": "data.projects",
								"as": "project",
								"node": {
									"component": "Card",
									"props": { "padding": "r4" },
									"children": [{
										"component": "Stack",
										"props": { "gap": "r5" },
										"children": [{
											"component": "Text",
											"props": {
												"variant": "body-1",
												"weight": "semibold"
											},
											"children": [{ "$ref": "project.name" }]
										}, {
											"component": "ProgressBar",
											"props": {
												"value": { "$ref": "project.progress" },
												"max": 100,
												"animate": true
											}
										}]
									}]
								}
							}]
						}]
					},
					{
						"component": "Tabs.Panel",
						"props": { "value": "activity" },
						"children": [{
							"component": "Timeline",
							"props": { "animate": true },
							"children": [{
								"$each": "data.activities",
								"as": "activity",
								"node": {
									"component": "Timeline.Item",
									"props": {
										"title": { "$ref": "activity.title" },
										"date": { "$ref": "activity.date" }
									},
									"children": [{
										"component": "Badge",
										"props": { "children": { "$ref": "activity.status" } }
									}]
								}
							}]
						}]
					}
				]
			}
		]
	}]
};
var analytics_dashboard_viewspec_default = {
	version: 1,
	title,
	description,
	data,
	root
};
//#endregion
export { data, analytics_dashboard_viewspec_default as default, description, root, title };

//# sourceMappingURL=analytics-dashboard.viewspec.js.map