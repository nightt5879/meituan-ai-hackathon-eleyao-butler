import { createHash, randomUUID } from "crypto";

type ScopedOpenClawSessionOptions = {
  envPrefixes?: string[];
};

function compactPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function shortHash(value: string, length = 16) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

export function buildOpenClawRequestScope(value: unknown) {
  const serialized = JSON.stringify(value) ?? String(value);
  return `req-${shortHash(serialized, 12)}-${shortHash(randomUUID(), 8)}`;
}

export function buildScopedOpenClawSessionId(
  defaultPrefix: string,
  parts: Array<string | undefined | null>,
  options: ScopedOpenClawSessionOptions = {}
) {
  const explicitPrefix = options.envPrefixes
    ?.map((name) => process.env[name]?.trim())
    .find((value): value is string => Boolean(value));
  const basePrefix = explicitPrefix ||
    process.env.OPENCLAW_CHAT_SESSION_ID?.trim() ||
    process.env.OPENCLAW_CHAT_SESSION_KEY?.trim() ||
    defaultPrefix;
  const prefix = compactPart(basePrefix) || compactPart(defaultPrefix);
  const scopedParts = parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => compactPart(part) || shortHash(part));

  return [prefix, ...scopedParts].join("-");
}
