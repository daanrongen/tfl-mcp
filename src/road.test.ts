import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerRoadTools } from "./road.js";

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

describe("road_all tool", () => {
	it("registers tool and formats road results", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "road_all") toolHandler = handler;
		});

		registerRoadTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = [
			{
				id: "a1",
				displayName: "A1",
				statusSeverityDescription: "Good",
			},
			{
				id: "a2",
				displayName: "A2",
				statusSeverityDescription: "Closure",
			},
		];
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({});
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain("Road: A1");
			expect(result.content[0].text).toContain("Status: Good");
			expect(result.content[0].text).toContain("Road: A2");
			expect(result.content[0].text).toContain("Status: Closure");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
