import { describe, expect, it, mock } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCabwiseTools } from "./cabwise.js";

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

describe("cabwise_search tool", () => {
	it("registers tool and formats JSON output for cab operators", async () => {
		const server = new McpServer({ name: "TestServer", version: "1.0.0" });
		// biome-ignore lint/suspicious/noExplicitAny: mock
		let toolHandler: any = null;

		// @ts-expect-error
		server.registerTool = mock((name, _schema, handler) => {
			if (name === "cabwise_search") toolHandler = handler;
		});

		registerCabwiseTools(server);
		expect(server.registerTool).toHaveBeenCalled();

		const originalFetch = globalThis.fetch;
		const mockData = {
			Operators: {
				OperatorList: [
					{ OperatorName: "Alpha Cabs", BookNumber: "020 1234 5678" },
				],
			},
		};
		globalThis.fetch = mockFetch(200, mockData) as unknown as typeof fetch;

		try {
			const result = await toolHandler({ lat: 51.5, lon: -0.1 });
			expect(result.content[0].type).toBe("text");
			expect(result.content[0].text).toContain(
				"Taxi/minicab operators near (51.5, -0.1):",
			);
			expect(result.content[0].text).toContain("Alpha Cabs");
			expect(result.content[0].text).toContain("020 1234 5678");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
