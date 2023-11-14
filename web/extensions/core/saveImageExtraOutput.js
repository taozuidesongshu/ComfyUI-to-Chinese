import { app } from "../../scripts/app.js";

// Use widget values and dates in output filenames

app.registerExtension({
	name: "Comfy.SaveImageExtraOutput",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "SaveImage") {
			const onNodeCreated = nodeType.prototype.onNodeCreated;

         // Simple date formatter
			const parts = {
				d: (d) => d.getDate(),
				M: (d) => d.getMonth() + 1,
				h: (d) => d.getHours(),
				m: (d) => d.getMinutes(),
				s: (d) => d.getSeconds(),
			};
			const format =
				Object.keys(parts)
					.map((k) => k + k + "?")
					.join("|") + "|yyy?y?";

			function formatDate(text, date) {
				return text.replace(new RegExp(format, "g"), function (text) {
					if (text === "yy") return (date.getFullYear() + "").substring(2);
					if (text === "yyyy") return date.getFullYear();
					if (text[0] in parts) {
						const p = parts[text[0]](date);
						return (p + "").padStart(text.length, "0");
					}
					return text;
				});
			}

         // When the SaveImage node is created we want to override the serialization of the output name widget to run our S&R
			nodeType.prototype.onNodeCreated = function () {
				const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

				const widget = this.widgets.find((w) => w.name === "filename_prefix");
				widget.serializeValue = () => {
					return widget.value.replace(/%([^%]+)%/g, function (match, text) {
						const split = text.split(".");
						if (split.length !== 2) {
                     // Special handling for dates
							if (split[0].startsWith("date:")) {
								return formatDate(split[0].substring(5), new Date());
							}

							if (text !== "width" && text !== "height") {
								// Dont warn on standard replacements
								console.warn("Invalid replacement pattern", text);
							}
							return match;
						}

						// Find node with matching S&R property name
						let nodes = app.graph._nodes.filter((n) => n.properties?.["Node name for S&R"] === split[0]);
						// If we cant, see if there is a node with that title
						if (!nodes.length) {
							nodes = app.graph._nodes.filter((n) => n.title === split[0]);
						}
						if (!nodes.length) {
							console.warn("Unable to find node", split[0]);
							return match;
						}

						if (nodes.length > 1) {
							console.warn("Multiple nodes matched", split[0], "using first match");
						}

						const node = nodes[0];

						const widget = node.widgets?.find((w) => w.name === split[1]);
						if (!widget) {
							console.warn("Unable to find widget", split[1], "on node", split[0], node);
							return match;
						}

						return ((widget.value ?? "") + "").replaceAll(/\/|\\/g, "_");
					});
				};

				return r;
			};
		} else {
         // When any other node is created add a property to alias the node
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

				if (!this.properties || !("Node name for S&R" in this.properties)) {
					this.addProperty("Node name for S&R", this.constructor.type, "string");
				}

				return r;
			};
		}
	},
});
