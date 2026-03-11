import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBikePointTools } from "./bike-point.js";

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

describe("tfl_bike_point tool", () => {
	it("registers tool and formats bike point search results", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "tfl_bike_point_search") toolHandler = handler;
		});

		registerBikePointTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		globalThis.fetch = mockFetch(200, [
			{
				id: "BikePoints_1",
				commonName: "River Street, Clerkenwell",
				lat: 51.529,
				lon: -0.109,
				additionalProperties: [
					{ key: "NbBikes", value: "5" },
					{ key: "NbEmptyDocks", value: "10" },
				],
			},
		]) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ query: "River Street" });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain("River Street, Clerkenwell");
			expect(result.content[0].text).toContain("Bikes Available: 5");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
