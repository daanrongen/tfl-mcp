import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchTools } from "./search.js";

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

describe("search tool", () => {
	it("registers tool and formats search results", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "search") toolHandler = handler;
		});

		registerSearchTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = {
			matches: [{ name: "Victoria" }],
		};
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ query: "Victoria" });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(
				'Search results for "Victoria":',
			);
			expect(result.content[0].text).toContain("Victoria");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
