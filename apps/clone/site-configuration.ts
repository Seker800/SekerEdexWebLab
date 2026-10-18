import { z } from "zod";
import { normalizeContentApiOrigin } from "./src/content/content-api.js";

const schema = z.object({ schemaVersion: z.literal(1), contentMode: z.enum(["sample", "api"]), contentApiOrigin: z.string() }).strict();

export function resolveSiteConfiguration(value: unknown): { delivery: "embedded" } | { delivery: "runtime"; apiOrigin: string } {
  const config = schema.parse(value);
  if (config.contentMode === "sample") {
    if (config.contentApiOrigin.trim()) throw new Error("Sample mode must not configure a content API origin; select api mode instead.");
    return { delivery: "embedded" };
  }
  if (!config.contentApiOrigin.trim()) throw new Error("API origin is required in api mode.");
  return { delivery: "runtime", apiOrigin: normalizeContentApiOrigin(config.contentApiOrigin.trim()) };
}
