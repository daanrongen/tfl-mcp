import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPlaceTools } from "./place.js";

function mockFetch(status: number, body: unknown) {
	return mock(() =>
		Promise.resolve(
			new Response(JSON.stringify(body), {
				status,
				headers: { "Content-Type": "application/json" },
			}),
		),
	);
}

describe("place_search tool", () => {
	it("registers tool and formats place search results", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "place_search") toolHandler = handler;
		});

		registerPlaceTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = [
			{
				id: "940GZZLUKSX",
				commonName: "King's Cross St. Pancras",
				placeType: "StopPoint",
				lat: 51.53,
				lon: -0.12,
			},
		];
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ name: "Kings Cross" });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(
				'Places matching "Kings Cross" (1 results):',
			);
			expect(result.content[0].text).toContain(
				"King's Cross St. Pancras (StopPoint) — ID: 940GZZLUKSX — 51.53000, -0.12000",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("handles no results found", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "place_search") toolHandler = handler;
		});

		registerPlaceTools(server);

		const originalFetch = globalThis.fetch;
		globalThis.fetch = mockFetch(200, []) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ name: "UnknownPlace" });
			expect(result.content[0].text).toContain(
				'No places found matching "UnknownPlace".',
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
