import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOccupancyTools } from "./occupancy.js";

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

describe("occupancy_car_parks_all tool", () => {
	it("registers tool and formats car park data", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "occupancy_car_parks_all") toolHandler = handler;
		});

		registerOccupancyTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = [
			{
				id: "CarParks_1",
				name: "Leytonstone",
				bays: [{ bayType: "PayAndDisplay", bayCount: 100, free: 42 }],
				message: "Open",
			},
		];
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({});
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain("Car park occupancy (1 parks):");
			expect(result.content[0].text).toContain("Car Park: Leytonstone");
			expect(result.content[0].text).toContain(
				"PayAndDisplay: 42 free / 100 total",
			);
			expect(result.content[0].text).toContain("Note: Open");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
