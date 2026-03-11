export const TFL_API_BASE = "https://api.tfl.gov.uk";
export const USER_AGENT = "tfl-mcp/1.0";

export interface DisambiguationOption {
	parameterValue: string;
	place: {
		commonName?: string;
		placeType?: string;
		lat?: number;
		lon?: number;
		naptanId?: string;
		icsCode?: string;
	};
	matchQuality: number;
}

export interface DisambiguationResult {
	fromLocationDisambiguation?: {
		matchStatus: string;
		disambiguationOptions?: DisambiguationOption[];
	};
	toLocationDisambiguation?: {
		matchStatus: string;
		disambiguationOptions?: DisambiguationOption[];
	};
}

/** Thrown when TfL returns HTTP 300 with disambiguation options for a journey planner query. */
export class TflDisambiguationError extends Error {
	constructor(
		public readonly result: DisambiguationResult,
		public readonly raw: string,
	) {
		super("TfL location is ambiguous — disambiguation required");
		this.name = "TflDisambiguationError";
	}
}

/** Formats disambiguation options into a human-readable suggestion list. */
export function formatDisambiguation(result: DisambiguationResult): string {
	const lines: string[] = [
		"The location you entered is ambiguous. Please retry tfl_journey_plan using one of the exact `parameterValue` IDs below.",
		"",
	];

	for (const [side, key] of [
		["From", "fromLocationDisambiguation"],
		["To", "toLocationDisambiguation"],
	] as const) {
		const d = result[key];
		if (!d || d.matchStatus === "identified" || d.matchStatus === "empty")
			continue;
		const opts = d.disambiguationOptions?.slice(0, 5) ?? [];
		if (!opts.length) continue;
		lines.push(
			`${side} — possible matches (use parameterValue as the \`from\`/\`to\` argument):`,
		);
		for (const opt of opts) {
			const name = opt.place.commonName ?? "?";
			const type = opt.place.placeType ?? "";
			lines.push(
				`  • "${opt.parameterValue}"  →  ${name}${type ? ` (${type})` : ""}`,
			);
		}
		lines.push("");
	}

	lines.push(
		'Tip: For tube stations, ICS codes (e.g. "1000129" for King\'s Cross) are the most reliable identifiers.',
	);
	return lines.join("\n");
}

export async function tflRequest<T>(
	path: string,
	params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
	const url = new URL(`${TFL_API_BASE}${path}`);
	const apiKey = process.env.TFL_API_KEY ?? "";

	if (apiKey) {
		url.searchParams.set("app_key", apiKey);
	}

	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== "") {
			url.searchParams.set(key, String(value));
		}
	}

	const response = await fetch(url.toString(), {
		headers: {
			"User-Agent": USER_AGENT,
			Accept: "application/json",
		},
	});

	// 300 = TfL journey planner disambiguation — not a real HTTP error
	if (response.status === 300) {
		const raw = await response.text().catch(() => "{}");
		let result: DisambiguationResult = {};
		try {
			result = JSON.parse(raw) as DisambiguationResult;
		} catch {
			/* ignore */
		}
		throw new TflDisambiguationError(result, raw);
	}

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`TfL API error ${response.status}: ${response.statusText}. ${body}`,
		);
	}

	return response.json() as Promise<T>;
}

/** Joins an array (or single string) with commas for path segments like /Line/{ids} */
export function joinIds(ids: string | string[]): string {
	return Array.isArray(ids) ? ids.join(",") : ids;
}

export function formatError(error: unknown): string {
	if (error instanceof TflDisambiguationError) {
		return formatDisambiguation(error.result);
	}
	if (error instanceof Error) return error.message;
	return String(error);
}
