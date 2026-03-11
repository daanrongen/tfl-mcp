import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

interface AdditionalProperty {
	key?: string;
	value?: string;
}

interface BikePoint {
	id?: string;
	commonName?: string;
	lat?: number;
	lon?: number;
	additionalProperties?: AdditionalProperty[];
}

function getBikeProp(bp: BikePoint, key: string): string {
	return bp.additionalProperties?.find((p) => p.key === key)?.value ?? "N/A";
}

function formatBikePoint(bp: BikePoint): string {
	const nbBikes = getBikeProp(bp, "NbBikes");
	const nbDocks = getBikeProp(bp, "NbDocks");
	const nbSpaces = getBikeProp(bp, "NbEmptyDocks");
	const locked = getBikeProp(bp, "Locked");
	const installed = getBikeProp(bp, "Installed");

	return [
		`ID: ${bp.id ?? "Unknown"}`,
		`Name: ${bp.commonName ?? "Unknown"}`,
		`Location: ${bp.lat?.toFixed(5) ?? "?"}, ${bp.lon?.toFixed(5) ?? "?"}`,
		`Bikes Available: ${nbBikes}`,
		`Empty Docks: ${nbSpaces}`,
		`Total Docks: ${nbDocks}`,
		`Installed: ${installed}`,
		`Locked: ${locked}`,
		"---",
	].join("\n");
}

export function registerBikePointTools(server: McpServer): void {
	server.registerTool(
		"bike_points_all",
		{
			description:
				"Gets all Santander Cycles (Boris Bikes) docking station locations in London with live availability (bikes, empty docks, total docks).",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<BikePoint[]>("/BikePoint");
				if (!data.length) {
					return {
						content: [{ type: "text" as const, text: "No bike points found." }],
					};
				}
				const summary = data.map(formatBikePoint).join("\n");
				return {
					content: [
						{
							type: "text" as const,
							text: `Found ${data.length} bike points:\n\n${summary}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"bike_point_search",
		{
			description:
				"Search for Santander Cycles docking stations by name or nearby landmark. Returns matching stations.",
			inputSchema: {
				query: z
					.string()
					.min(1)
					.describe(
						"Search term for bike station name or nearby landmark (e.g. 'Waterloo', 'Hyde Park')",
					),
			},
		},
		async ({ query }) => {
			try {
				const data = await tflRequest<BikePoint[]>("/BikePoint/Search", {
					query,
				});
				if (!data.length) {
					return {
						content: [
							{
								type: "text" as const,
								text: `No bike points found matching "${query}".`,
							},
						],
					};
				}
				const summary = data.map(formatBikePoint).join("\n");
				return {
					content: [
						{
							type: "text" as const,
							text: `Found ${data.length} bike points matching "${query}":\n\n${summary}`,
						},
					],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);

	server.registerTool(
		"bike_point_by_id",
		{
			description:
				"Gets a specific Santander Cycles docking station by its ID, including live bike and dock availability.",
			inputSchema: {
				id: z
					.string()
					.describe(
						"The bike point ID (e.g. 'BikePoints_1'). Use bike_point_search to find IDs.",
					),
			},
		},
		async ({ id }) => {
			try {
				const data = await tflRequest<BikePoint>(
					`/BikePoint/${encodeURIComponent(id)}`,
				);
				return {
					content: [{ type: "text" as const, text: formatBikePoint(data) }],
				};
			} catch (error) {
				return {
					content: [
						{ type: "text" as const, text: `Error: ${formatError(error)}` },
					],
					isError: true,
				};
			}
		},
	);
}
