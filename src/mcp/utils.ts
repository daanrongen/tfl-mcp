import type { Cause } from "effect";
import { Cause as CauseModule } from "effect";
import type { DisambiguationResult } from "../domain/errors.ts";

export const formatSuccess = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    },
  ],
});

export const formatError = (cause: Cause.Cause<unknown>) => ({
  content: [
    {
      type: "text" as const,
      text: `Error: ${CauseModule.pretty(cause)}`,
    },
  ],
  isError: true as const,
});

export const formatDisambiguation = (result: DisambiguationResult): string => {
  const lines: string[] = [
    "The location you entered is ambiguous. Please retry journey_plan using one of the exact `parameterValue` IDs below.",
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
};
