var title = "Team Directory";
var description = "A team member directory with avatar cards, roles, and status badges";
var data = {
	"members": {
		"type": "static",
		"value": [
			{
				"name": "Alex Chen",
				"role": "Engineering Lead",
				"department": "Engineering",
				"status": "online",
				"avatar": "https://i.pravatar.cc/150?u=alex"
			},
			{
				"name": "Sarah Miller",
				"role": "Product Designer",
				"department": "Design",
				"status": "online",
				"avatar": "https://i.pravatar.cc/150?u=sarah"
			},
			{
				"name": "James Wilson",
				"role": "Backend Developer",
				"department": "Engineering",
				"status": "away",
				"avatar": "https://i.pravatar.cc/150?u=james"
			},
			{
				"name": "Emily Rodriguez",
				"role": "Product Manager",
				"department": "Product",
				"status": "online",
				"avatar": "https://i.pravatar.cc/150?u=emily"
			},
			{
				"name": "Michael Park",
				"role": "Frontend Developer",
				"department": "Engineering",
				"status": "offline",
				"avatar": "https://i.pravatar.cc/150?u=michael"
			},
			{
				"name": "Lisa Thompson",
				"role": "UX Researcher",
				"department": "Design",
				"status": "online",
				"avatar": "https://i.pravatar.cc/150?u=lisa"
			}
		]
	},
	"teamSize": {
		"type": "static",
		"value": "6"
	},
	"onlineCount": {
		"type": "static",
		"value": "4"
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
				"children": ["Team Directory"]
			},
			{
				"component": "Row",
				"props": { "gap": "r4" },
				"children": [{
					"component": "StatCard",
					"children": [{
						"component": "StatCard.Value",
						"props": { "children": { "$ref": "data.teamSize" } }
					}, {
						"component": "StatCard.Label",
						"props": { "children": "Team Members" }
					}]
				}, {
					"component": "StatCard",
					"children": [{
						"component": "StatCard.Value",
						"props": { "children": { "$ref": "data.onlineCount" } }
					}, {
						"component": "StatCard.Label",
						"props": { "children": "Online Now" }
					}]
				}]
			},
			{
				"component": "Row",
				"props": {
					"gap": "r4",
					"wrap": true
				},
				"children": [{
					"$each": "data.members",
					"as": "member",
					"node": {
						"component": "Card",
						"props": { "padding": "r4" },
						"children": [{
							"component": "Stack",
							"props": { "gap": "r5" },
							"children": [{
								"component": "Row",
								"props": {
									"gap": "r4",
									"align": "center"
								},
								"children": [{
									"component": "Avatar",
									"props": {
										"src": { "$ref": "member.avatar" },
										"name": { "$ref": "member.name" },
										"size": "lg",
										"status": { "$ref": "member.status" }
									}
								}, {
									"component": "Stack",
									"props": { "gap": "r6" },
									"children": [{
										"component": "Text",
										"props": {
											"variant": "body-1",
											"weight": "semibold"
										},
										"children": [{ "$ref": "member.name" }]
									}, {
										"component": "Text",
										"props": {
											"variant": "body-2",
											"color": "secondary"
										},
										"children": [{ "$ref": "member.role" }]
									}]
								}]
							}, {
								"component": "Badge",
								"props": { "children": { "$ref": "member.department" } }
							}]
						}]
					}
				}]
			}
		]
	}]
};
var team_directory_viewspec_default = {
	version: 1,
	title,
	description,
	data,
	root
};
//#endregion
export { data, team_directory_viewspec_default as default, description, root, title };

//# sourceMappingURL=team-directory.viewspec.js.map