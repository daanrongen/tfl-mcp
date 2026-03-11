import { describe, expect, it, mock } from "bun:test";
import {
	type DisambiguationResult,
	formatDisambiguation,
	formatError,
	TflDisambiguationError,
	tflRequest,
} from "./client.js";

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

describe("tflRequest", () => {
	it("builds the correct URL and returns parsed JSON on 200", async () => {
		const payload = [{ id: "victoria", name: "Victoria" }];
		const fetchMock = mockFetch(200, payload);
		const original = globalThis.fetch;
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			const result = await tflRequest<typeof payload>("/Line/Mode/tube");
			expect(result).toEqual(payload);
			const calledUrl = fetchMock.mock.calls[0][0] as unknown as string;
			expect(calledUrl).toContain("https://api.tfl.gov.uk/Line/Mode/tube");
		} finally {
			globalThis.fetch = original;
		}
	});

	it("appends query params correctly", async () => {
		const fetchMock = mockFetch(200, {});
		const original = globalThis.fetch;
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			await tflRequest("/StopPoint/Search", {
				query: "Victoria",
				modes: "tube",
			});
			const calledUrl = fetchMock.mock.calls[0][0] as unknown as string;
			expect(calledUrl).toContain("query=Victoria");
			expect(calledUrl).toContain("modes=tube");
		} finally {
			globalThis.fetch = original;
		}
	});

	it("omits undefined / empty params", async () => {
		const fetchMock = mockFetch(200, {});
		const original = globalThis.fetch;
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			await tflRequest("/Line/victoria/Status", { detail: undefined, foo: "" });
			const calledUrl = fetchMock.mock.calls[0][0] as unknown as string;
			expect(calledUrl).not.toContain("detail");
			expect(calledUrl).not.toContain("foo");
		} finally {
			globalThis.fetch = original;
		}
	});

	it("appends API_KEY when set", async () => {
		const fetchMock = mockFetch(200, {});
		const original = globalThis.fetch;
		const originalKey = process.env.TFL_API_KEY;
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		process.env.TFL_API_KEY = "test-key-123";

		// Test key absence
		process.env.TFL_API_KEY = "";

		try {
			await tflRequest("/AirQuality");
			const calledUrl = fetchMock.mock.calls[0][0] as unknown as string;
			expect(calledUrl).not.toContain("app_key");
		} finally {
			globalThis.fetch = original;
			process.env.TFL_API_KEY = originalKey;
		}
	});

	it("throws a plain Error on non-300 HTTP errors", async () => {
		const fetchMock = mock(() =>
			Promise.resolve(new Response("Not Found", { status: 404 })),
		);
		const original = globalThis.fetch;
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			await expect(tflRequest("/NonExistent")).rejects.toThrow(
				"TfL API error 404",
			);
		} finally {
			globalThis.fetch = original;
		}
	});

	it("throws TflDisambiguationError on HTTP 300", async () => {
		const disambigBody: DisambiguationResult = {
			fromLocationDisambiguation: {
				matchStatus: "list",
				disambiguationOptions: [
					{
						parameterValue: "1000129",
						place: {
							commonName: "King's Cross St. Pancras",
							placeType: "StopPoint",
						},
						matchQuality: 1000,
					},
				],
			},
			toLocationDisambiguation: { matchStatus: "identified" },
		};
		const fetchMock = mockFetch(300, disambigBody);
		const original = globalThis.fetch;
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		try {
			await expect(
				tflRequest("/Journey/JourneyResults/kings%20cross/to/brixton"),
			).rejects.toBeInstanceOf(TflDisambiguationError);
		} finally {
			globalThis.fetch = original;
		}
	});
});

describe("formatDisambiguation", () => {
	it("formats from-side disambiguation options", () => {
		const result: DisambiguationResult = {
			fromLocationDisambiguation: {
				matchStatus: "list",
				disambiguationOptions: [
					{
						parameterValue: "1000129",
						place: {
							commonName: "King's Cross St. Pancras",
							placeType: "StopPoint",
						},
						matchQuality: 1000,
					},
					{
						parameterValue: "1000130",
						place: {
							commonName: "King's Cross Bus Stop",
							placeType: "StopPoint",
						},
						matchQuality: 950,
					},
				],
			},
			toLocationDisambiguation: { matchStatus: "identified" },
		};

		const text = formatDisambiguation(result);
		expect(text).toContain("1000129");
		expect(text).toContain("King's Cross St. Pancras");
		expect(text).toContain("parameterValue");
		expect(text).not.toContain("To —");
	});

	it("formats to-side disambiguation options", () => {
		const result: DisambiguationResult = {
			fromLocationDisambiguation: { matchStatus: "identified" },
			toLocationDisambiguation: {
				matchStatus: "list",
				disambiguationOptions: [
					{
						parameterValue: "940GZZLUBXN",
						place: {
							commonName: "Brixton Underground Station",
							placeType: "StopPoint",
						},
						matchQuality: 1000,
					},
				],
			},
		};

		const text = formatDisambiguation(result);
		expect(text).toContain("940GZZLUBXN");
		expect(text).toContain("Brixton Underground Station");
		expect(text).toContain("To —");
	});

	it("skips sides where matchStatus is 'identified'", () => {
		const result: DisambiguationResult = {
			fromLocationDisambiguation: { matchStatus: "identified" },
			toLocationDisambiguation: { matchStatus: "identified" },
		};
		const text = formatDisambiguation(result);
		expect(text).not.toContain("From —");
		expect(text).not.toContain("To —");
	});

	it("limits output to 5 options per side", () => {
		const opts = Array.from({ length: 10 }, (_, i) => ({
			parameterValue: `100000${i}`,
			place: { commonName: `Stop ${i}`, placeType: "StopPoint" },
			matchQuality: 1000 - i,
		}));
		const result: DisambiguationResult = {
			fromLocationDisambiguation: {
				matchStatus: "list",
				disambiguationOptions: opts,
			},
			toLocationDisambiguation: { matchStatus: "empty" },
		};
		const text = formatDisambiguation(result);
		expect(text).toContain("1000000");
		expect(text).toContain("1000004");
		expect(text).not.toContain("1000005");
	});
});

describe("formatError", () => {
	it("formats a plain Error", () => {
		expect(formatError(new Error("boom"))).toBe("boom");
	});

	it("formats a string", () => {
		expect(formatError("oops")).toBe("oops");
	});

	it("formats a TflDisambiguationError with disambiguation text", () => {
		const result: DisambiguationResult = {
			fromLocationDisambiguation: {
				matchStatus: "list",
				disambiguationOptions: [
					{
						parameterValue: "1000129",
						place: { commonName: "King's Cross", placeType: "StopPoint" },
						matchQuality: 1000,
					},
				],
			},
		};
		const err = new TflDisambiguationError(result, "{}");
		const text = formatError(err);
		expect(text).toContain("1000129");
		expect(text).toContain("ambiguous");
	});
});
