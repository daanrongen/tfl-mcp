import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

export function registerCabwiseTools(server: McpServer): void {
	server.registerTool(
		"cabwise_search",
		{
			description:
				"Search for licensed taxis and minicabs near a location in London. Returns operator contact information.",
			inputSchema: {
				lat: z
					.number()
					.min(51.2)
					.max(51.8)
					.describe("Latitude of the search location (within Greater London)"),
				lon: z
					.number()
					.min(-0.6)
					.max(0.4)
					.describe("Longitude of the search location (within Greater London)"),
				radius: z
					.number()
					.positive()
					.optional()
					.describe("Search radius in metres (default: 1000)"),
				optype: z
					.enum(["Minicab", "BlackCab"])
					.optional()
					.describe("Operator type filter: 'Minicab' or 'BlackCab'"),
				name: z.string().optional().describe("Filter by operator name"),
				maxResults: z
					.number()
					.int()
					.positive()
					.optional()
					.describe("Maximum number of results to return (default: 10)"),
				twentyFourSevenOnly: z
					.boolean()
					.optional()
					.describe("If true, only return operators available 24/7"),
				wc: z
					.boolean()
					.optional()
					.describe("If true, include wheelchair-accessible vehicles only"),
			},
		},
		async ({
			lat,
			lon,
			radius,
			optype,
			name,
			maxResults,
			twentyFourSevenOnly,
			wc,
		}) => {
			try {
				const data = await tflRequest<unknown>("/Cabwise/search", {
					lat,
					lon,
					radius,
					optype,
					name,
					maxResults,
					twentyFourSevenOnly,
					wc,
				});
				return {
					content: [
						{
							type: "text" as const,
							text: `Taxi/minicab operators near (${lat}, ${lon}):\n\n${JSON.stringify(data, null, 2)}`,
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
}
