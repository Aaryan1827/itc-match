<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Decisions

- AI model calls (invoice extraction, explanation) go through the Lovable AI Gateway in `src/lib/server/gateway.ts` with the managed `LOVABLE_API_KEY`; `GEMINI_MODEL` env overrides the model id. Why: the app needs no per-user Google AI Studio key, and provider-level errors (credits, access) surface as safe user-facing messages via `GatewayError`.
- Model output is generated against loose zod schemas (no bounds/patterns — constrained decoding rejects them) and re-validated in code against the strict schemas in `src/lib/gst/schemas.ts`. Never trust model output without the strict parse.
