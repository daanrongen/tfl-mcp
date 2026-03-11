import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

export function registerAccidentStatsTools(server: McpServer): void {
	server.registerTool(
		"accident_stats",
		{
			description:
				"Gets all accident details for accidents occurring in the specified year in London.",
			inputSchema: {
				year: z
					.number()
					.int()
					.min(2005)
					.max(new Date().getFullYear())
					.describe(
						"The year for which to retrieve accident statistics (e.g. 2023)",
					),
			},
		},
		async ({ year }) => {
			try {
				const data = await tflRequest<unknown[]>(`/AccidentStats/${year}`);
				const count = Array.isArray(data) ? data.length : "unknown";
				return {
					content: [
						{
							type: "text" as const,
							text: `Accident statistics for ${year} (${count} incidents):\n\n${JSON.stringify(data, null, 2)}`,
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
