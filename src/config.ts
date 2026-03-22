import { Config } from "effect";

export const TflApiKeyConfig = Config.option(Config.string("TFL_API_KEY"));
