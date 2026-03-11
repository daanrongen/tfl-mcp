import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatError, tflRequest } from "./client.js";

export function registerSearchTools(server: McpServer): void {
	server.registerTool(
		"search",
		{
			description:
				"Search the TfL site and data for any query — finds stations, stops, lines, places, and other TfL content. Returns up to 100 results.",
			inputSchema: {
				query: z
					.string()
					.min(1)
					.describe(
						"Search term (e.g. 'Victoria', 'Waterloo', 'Northern line', 'bus 25')",
					),
			},
		},
		async ({ query }) => {
			try {
				const data = await tflRequest<unknown>("/Search", { query });
				return {
					content: [
						{
							type: "text" as const,
							text: `Search results for "${query}":\n\n${JSON.stringify(data, null, 2)}`,
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
		"search_bus_schedules",
		{
			description:
				"Searches for bus schedule documents on TfL's S3 storage for a given bus route number.",
			inputSchema: {
				query: z
					.string()
					.describe(
						"Bus route number or name to search for (e.g. '25', '73', 'N25')",
					),
			},
		},
		async ({ query }) => {
			try {
				const data = await tflRequest<unknown>("/Search/BusSchedules", {
					query,
				});
				return {
					content: [
						{
							type: "text" as const,
							text: `Bus schedule search results for "${query}":\n\n${JSON.stringify(data, null, 2)}`,
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
		"search_meta_categories",
		{
			description:
				"Gets the available search categories that can be used to filter TfL search results.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<unknown>("/Search/Meta/Categories");
				return {
					content: [
						{
							type: "text" as const,
							text: `Search categories:\n\n${JSON.stringify(data, null, 2)}`,
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
		"search_meta_providers",
		{
			description:
				"Gets the available search provider names used by the TfL search API.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<unknown>("/Search/Meta/SearchProviders");
				return {
					content: [
						{
							type: "text" as const,
							text: `Search providers:\n\n${JSON.stringify(data, null, 2)}`,
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
		"search_meta_sorts",
		{
			description: "Gets the available sorting options for TfL search results.",
			inputSchema: {},
		},
		async () => {
			try {
				const data = await tflRequest<unknown>("/Search/Meta/Sorts");
				return {
					content: [
						{
							type: "text" as const,
							text: `Search sort options:\n\n${JSON.stringify(data, null, 2)}`,
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
