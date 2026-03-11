import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLineTools } from "./line.js";

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

describe("line_status tool", () => {
	it("registers tool and formats line status", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "line_status") toolHandler = handler;
		});

		registerLineTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = [
			{
				id: "victoria",
				name: "Victoria",
				modeName: "tube",
				lineStatuses: [{ statusSeverityDescription: "Good Service" }],
			},
			{
				id: "central",
				name: "Central",
				modeName: "tube",
				lineStatuses: [
					{
						statusSeverityDescription: "Severe Delays",
						reason: "Signal failure",
					},
				],
			},
		];
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ ids: "victoria,central" });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain("Current line status:");
			expect(result.content[0].text).toContain(
				"Victoria (tube) — Good Service",
			);
			expect(result.content[0].text).toContain(
				"Central (tube) — Severe Delays: Signal failure",
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
