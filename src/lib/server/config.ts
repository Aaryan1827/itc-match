/** Server settings read from environment variables, with safe defaults and clamping. */
export interface ServerConfig {
  apiKey: string | undefined;
  model: string;
  maxFiles: number;
  maxFileBytes: number;
  maxCsvBytes: number;
  rateLimitPerMin: number;
}

const toInt = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function readConfig(env: Record<string, string | undefined>): ServerConfig {
  return {
    apiKey: env["LOVABLE_API_KEY"] ?? env["GEMINI_API_KEY"],
    model: env["GEMINI_MODEL"]?.trim() || "google/gemini-3.8-flash",
    maxFiles: toInt(env["MAX_FILES"], 10, 1, 10),
    maxFileBytes: toInt(env["MAX_FILE_MB"], 5, 1, 10) * 1024 * 1024,
    maxCsvBytes: 1024 * 1024,
    rateLimitPerMin: toInt(env["RATE_LIMIT_PER_MIN"], 10, 1, 120),
  };
}
