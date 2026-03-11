import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAccidentStatsTools } from "./accident.js";

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

describe("tfl_accident_stats tool", () => {
	it("registers the tool and returns formatted accident stats", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error -> mock injection
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "tfl_accident_stats") {
				toolHandler = handler;
			}
		});

		registerAccidentStatsTools(server);
		expect(server.registerTool).toHaveBeenCalled();
		expect(toolHandler).not.toBeNull();

		const originalFetch = globalThis.fetch;
		const mockData = [{ id: 1, lat: 51.5, lon: -0.1, severity: "Slight" }];
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ year: 2023 });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(
				"Accident statistics for 2023 (1 incidents)",
			);
			expect(result.content[0].text).toContain('"severity": "Slight"');
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	it("handles API errors gracefully", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "tfl_accident_stats") toolHandler = handler;
		});

		registerAccidentStatsTools(server);

		const originalFetch = globalThis.fetch;
		globalThis.fetch = mockFetch(404, {
			message: "Not Found",
		}) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ year: 2025 });
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain("TfL API error 404");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
