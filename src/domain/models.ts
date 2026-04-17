import { Schema } from "effect";

const DisambiguationPlaceSchema = Schema.Struct({
  commonName: Schema.optional(Schema.String),
  placeType: Schema.optional(Schema.String),
  lat: Schema.optional(Schema.Number),
  lon: Schema.optional(Schema.Number),
  naptanId: Schema.optional(Schema.String),
  icsCode: Schema.optional(Schema.String),
});

export class DisambiguationOption extends Schema.Class<DisambiguationOption>(
  "DisambiguationOption",
)({
  parameterValue: Schema.String,
  place: DisambiguationPlaceSchema,
  matchQuality: Schema.Number,
}) {}

const DisambiguationSideSchema = Schema.Struct({
  matchStatus: Schema.String,
  disambiguationOptions: Schema.optional(Schema.Array(DisambiguationOption)),
});

export class DisambiguationResult extends Schema.Class<DisambiguationResult>(
  "DisambiguationResult",
)({
  fromLocationDisambiguation: Schema.optional(DisambiguationSideSchema),
  toLocationDisambiguation: Schema.optional(DisambiguationSideSchema),
}) {}
