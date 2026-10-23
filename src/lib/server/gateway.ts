import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { createLovableAiGatewayRunIdFetch } from "./run-id";

export const LOVABLE_GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev";

/**
 * Provider for the project's built-in AI route. Created per request; the
 * fetch wrapper stores a request-local run ID.
 */
export function createLovableAiGatewayProvider(
  lovableApiKey: string,
  initialRunId: string | undefined,
  options: { baseURL?: string; structuredOutputs?: boolean; fetch?: typeof fetch } = {},
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId, options.fetch);

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: `${(options.baseURL ?? LOVABLE_GATEWAY_BASE_URL).replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
    fetch: runIdFetch.fetch,
  });

  return Object.assign(provider, {
    getRunId: runIdFetch.getRunId,
  });
}
