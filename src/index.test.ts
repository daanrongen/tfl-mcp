import { describe, expect, it } from "bun:test";

describe("index.ts", () => {
	it("should exist", async () => {
		const mod = await import("./index.js");
		expect(mod).toBeDefined();
	});
});
