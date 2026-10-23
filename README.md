# TaxSure AI

**Find the input tax credit you're about to lose.**

TaxSure AI reconciles a business's purchase invoices against its GSTR-2B statement, shows how much Input Tax Credit (ITC) is at risk before the return is filed, explains why in plain language (English, हिन्दी, मराठी), and drafts ready-to-send follow-up messages for suppliers.

**Live demo:** https://itc-match.vercel.app/ (click **Load demo data**, then **Reconcile**)

---

## Table of contents

1. [Problem statement and alignment](#1-problem-statement-and-alignment)
2. [How it works](#2-how-it-works)
3. [Architecture](#3-architecture)
4. [Validation rules](#4-validation-rules)
5. [Security](#5-security)
6. [Efficiency](#6-efficiency)
7. [Testing](#7-testing)
8. [Accessibility](#8-accessibility)
9. [Code quality](#9-code-quality)
10. [Run it yourself](#10-run-it-yourself)
11. [API reference](#11-api-reference)
12. [Demo dataset](#12-demo-dataset)
13. [Evaluation map](#13-evaluation-map)
14. [Known limitations](#14-known-limitations)

---

## 1. Problem statement and alignment

**The problem.** Under GST in India, a business can claim Input Tax Credit on a purchase only if the supplier has filed it and it appears in the buyer's GSTR-2B. Invoices that are mistyped, mis-taxed, duplicated or never filed by the supplier silently turn into lost money. Small businesses reconcile this by hand, line by line, across PDFs and spreadsheets, and usually find the problem after the filing deadline.

**The goal.** Build an original, functional AI-enabled application that solves a meaningful real-world problem through intelligent reasoning, automation and data-driven decisions, with reliable engineering behind it.

**What TaxSure AI does about it.**

| Requirement | How TaxSure AI meets it |
|---|---|
| Real-world problem | ITC leakage for Indian small and mid-size businesses |
| Beyond a basic chatbot | A five-step pipeline: extract, validate, match, classify, act. There is no chat box. |
| Meaningful AI | Gemini reads unstructured invoice PDFs and images into structured data, then writes the explanations and supplier messages |
| Reliable engineering | **Gemini reads and explains. Plain code decides.** Every status and every rupee figure comes from tested deterministic code |
| Measurable outcome | The result reports ITC at risk in ₹, invoices checked, issues found and per-step timings |
| Automation | One click turns a stack of invoices into a prioritised action list and supplier messages |
| Inclusive | Language selector for English, हिन्दी and मराठी, plus an accessible interface |
| Google technology | Google Gemini API (structured JSON output, vision input) |

---

## 2. How it works

1. **Upload.** Add up to 10 purchase invoices (PDF, PNG, JPEG or WebP) and the GSTR-2B CSV downloaded from the GST portal. Or click **Load demo data**.
2. **Extract (Gemini).** Each invoice is sent to Gemini with a strict JSON schema. The model copies the printed fields: GSTINs, invoice number, date, line items, taxable value, tax amounts, total and a confidence score. It does not correct, guess or calculate.
3. **Validate (code).** Deterministic rules check the GSTIN check digit, same-state vs inter-state tax type, arithmetic, the GST rate valid on the invoice date, duplicates and extraction confidence.
4. **Match (code).** Each invoice is matched to a GSTR-2B row by supplier GSTIN and invoice number, exact first and then normalised (case and punctuation ignored). Each GSTR-2B row can be claimed only once. Amounts are compared within a ₹1 rounding tolerance.
5. **Classify (code).** Every invoice gets one of four statuses, and ITC at risk is totalled from the tax amounts of the at-risk invoices.
6. **Explain (Gemini).** Gemini receives only the already-computed findings and writes a short summary and one supplier follow-up message per flagged invoice, in the selected language. If Gemini is unavailable, a templated summary is returned so the user still gets a result.

### Result statuses

| Status | Meaning | Triggered by |
|---|---|---|
| `clean` | Safe to claim | No issues found |
| `fixable` | Claimable once corrected | `TAX_TYPE_MISMATCH`, `ARITHMETIC_MISMATCH`, `VALUE_MISMATCH_2B`, `FUZZY_MATCH` |
| `needs_review` | A human should look | `RATE_NOT_ALLOWED`, `DUPLICATE_INVOICE`, `LOW_CONFIDENCE` |
| `itc_at_risk` | Credit may be lost | `NOT_IN_2B`, `GSTIN_CHECKSUM`, `GSTIN_FORMAT` |

When an invoice has several issues, the highest severity wins: at risk, then needs review, then fixable, then clean.

---

## 3. Architecture

```
Browser (React UI, TanStack Start)
   |  multipart POST /api/reconcile  (invoices[], gstr2b, lang)
   v
Server route  src/routes/api/reconcile.ts
   |
   v
handler.ts ── rate limit ── size checks ── magic-byte file checks ── CSV parse + Zod
   |
   |-- Gemini (vision, JSON schema)  -> extract each invoice, 4 at a time
   |-- Zod validation of model output
   |-- reconcile()  pure TypeScript: rules + matcher + classifier   <- source of truth
   |-- Gemini (text, JSON schema)    -> summary + supplier messages (template fallback)
   v
JSON response: summary, narrative, followUps, failed, timingsMs, model
```

**Design principles**

- **Separation of trust.** The model never decides a status or an amount. It only reads documents and phrases findings.
- **Pure core.** `src/lib/gst` has no network, file or framework dependencies, so it is fast to test and easy to reason about.
- **Validate at every boundary.** Model output and the parsed GSTR-2B file are checked with Zod before use.
- **Fail soft, not open.** One unreadable invoice goes into `failed` and does not break the batch. A failed explanation falls back to a template. A missing API key returns a generic error.
- **Configuration over constants.** GST rate slabs and state codes live in JSON files with effective dates, so they can be updated without touching logic.

### Tech stack

| Layer | Technology |
|---|---|
| UI | React with TanStack Start, built with Lovable (shadcn/Radix components) |
| Server | TanStack Start server route on Nitro, deployed to Vercel |
| AI | Google Gemini API (structured JSON output, PDF and image input) |
| Validation | Zod |
| Tests | Vitest |
| Language | TypeScript (strict) |

### Project structure

```
src/
  config/
    gst-rates.json        dated GST rate slabs + rounding tolerance
    state-codes.json      GSTIN state codes
  lib/
    gst/                  pure domain logic (no I/O)
      types.ts            shared types and the response contract
      gstin.ts            GSTIN format + check-digit validation
      rules.ts            validation rules
      matcher.ts          GSTR-2B matching (exact and normalised)
      reconcile.ts        orchestrates rules + matching + classification
      schemas.ts          Zod schemas for model output and GSTR-2B rows
      config.ts           typed config loader
    server/               request handling and integrations
      handler.ts          POST /api/reconcile pipeline
      gemini.ts           Gemini client (structured output, timeout)
      prompts.ts          extraction and explanation prompts
      response-schemas.ts Gemini response schemas
      upload.ts           magic-byte checks, file name sanitising
      csv.ts              RFC 4180 CSV reader and GSTR-2B mapper
      rate-limit.ts       fixed-window rate limiter
      config.ts           environment configuration with clamping
  routes/api/reconcile.ts route registration
tests/                    Vitest suites (domain + server)
samples/                  10 synthetic invoices, GSTR-2B CSV, answer key
scripts/generate_samples.py   reproducible demo-data generator
vercel.json               security headers
```

---

## 4. Validation rules

| Code | Check | Why it matters |
|---|---|---|
| `GSTIN_FORMAT` | Supplier GSTIN matches the 15-character pattern and has a known state code | Malformed GSTINs cannot be matched or claimed |
| `GSTIN_CHECKSUM` | GSTIN check character (mod 36) is correct | Catches mistyped GSTINs before the supplier is blamed |
| `TAX_TYPE_MISMATCH` | Same-state supply must carry CGST + SGST, inter-state supply must carry IGST | A wrong tax type blocks ITC until a corrected invoice is issued |
| `ARITHMETIC_MISMATCH` | Line items sum to taxable value, tax equals taxable value × printed rate, taxable value + tax equals total (₹1 tolerance) | Catches typing and calculation errors |
| `RATE_NOT_ALLOWED` | The printed rate is valid on the invoice date, from dated slabs in config | Rates change over time, so the check is date-aware |
| `NOT_IN_2B` | No matching GSTR-2B row | The supplier may not have filed, and the credit cannot be claimed yet |
| `FUZZY_MATCH` | Matched only after normalising the invoice number | Inconsistent formatting between invoice and filing |
| `VALUE_MISMATCH_2B` | Invoice amounts differ from the GSTR-2B row beyond tolerance | Claim only the GSTR-2B amount |
| `DUPLICATE_INVOICE` | The same supplier and invoice number was uploaded twice | Prevents claiming ITC twice |
| `LOW_CONFIDENCE` | Gemini's extraction confidence is below 0.7 | A blurry scan should be reviewed by a person |

GSTR-2B rows that no uploaded invoice matched are reported separately as `unmatchedGstr2b`.

---

## 5. Security

| Area | Measure |
|---|---|
| **Secrets** | The Gemini API key lives only in a server-side environment variable and is never sent to the browser. `.env` files are git-ignored, and `.env.example` documents the variables. |
| **Prompt injection** | Invoices are treated as untrusted data. The extraction prompt tells the model to ignore any instructions found inside a document. The model returns fields only, so injected text cannot change a verdict or an amount. The explanation prompt gets computed findings and is told to ignore instructions inside supplier names and invoice numbers. |
| **Model output** | Never trusted. It is forced into a JSON schema, then re-validated with Zod (types, ranges, date format, lengths). The file name is attached server-side, never taken from the model. |
| **Uploads** | Limits on file count (10), file size (5 MB) and CSV size (1 MB), plus a request body cap. File type is decided by **magic bytes** (PDF, PNG, JPEG, WebP), not by file name or declared MIME type. File names are sanitised before being echoed back. |
| **Abuse control** | Per-IP rate limit (default 10 requests/minute, returns `429` with `Retry-After`) and a 45-second timeout on Gemini calls. |
| **Error handling** | Errors sent to the client are generic. Request content and invoice data are never logged, only a status or a short message. A missing key fails closed with no detail leaked. |
| **Response headers** | API responses send `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. |
| **Site headers** (`vercel.json`) | `Content-Security-Policy` (default-src 'self', `connect-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`), `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera, microphone and geolocation off), `X-Content-Type-Options: nosniff`. |
| **Privacy** | Files are processed in memory for the request. The app has no database and does not store uploads. |
| **Input validation** | Zod schemas validate the GSTR-2B CSV rows and all model output. Numbers are bounded and dates are format-checked. |

Details a reviewer should know:

- The CSP allows `'unsafe-inline'` for scripts and styles because the framework injects inline scripts. This is a known trade-off.
- The rate limiter is in memory. On serverless platforms each warm instance keeps its own counters, so it is best effort. A shared store (for example Redis) would make it strict.

---

## 6. Efficiency

- **Concurrency.** Invoices are extracted 4 at a time with a small worker pool, which is much faster than one by one and stays within API limits.
- **Isolation.** A failed document is recorded and skipped, so the other invoices still finish and no work is repeated.
- **Cheap where it counts.** Matching, validation and totals are plain in-memory code with negligible cost. Gemini is called twice per batch at most: once per invoice for extraction, and once for the explanation.
- **Structured output.** Temperature 0 and a JSON response schema avoid retries caused by malformed output.
- **Bounded work.** Limits on files, bytes and CSV rows (max 5000) keep memory and time predictable. The Gemini call has a hard timeout.
- **No dependencies where not needed.** The CSV reader and rate limiter are small hand-written modules. Base64 encoding avoids `Buffer` so the same code runs on Node and edge runtimes.
- **Measured, not claimed.** Every response includes `timingsMs` (extract, reconcile, explain, total) and the model name, and the UI shows a timings strip.

---

## 7. Testing

The suite runs with Vitest: `npm run test` (or `bun run test`).

**31 tests across two suites**, covering:

| Area | What is tested |
|---|---|
| GSTIN | Valid check character accepted, wrong one rejected, malformed GSTIN, unknown state code, deterministic check digit |
| Rules | IGST on an intra-state sale flagged, correct CGST + SGST passes, tax not matching the rate flagged, clean invoice passes, **date-aware rates** (12% valid before 22 Sep 2025, rejected after) |
| Matching | Invoice-number normalisation, one GSTR-2B row never matched twice |
| Benchmark | **Every synthetic invoice gets the expected status**, every planted issue code is surfaced, clean invoices raise no issue, ITC at risk equals the answer key, unmatched GSTR-2B rows are reported |
| Upload | File type from bytes not names, empty and oversized files rejected, file names sanitised |
| CSV | Quoted commas and escaped quotes, `DD/MM/YYYY` dates, column mapping, missing columns reported |
| Rate limiter | Blocks after the limit and recovers after the window |
| API end to end (Gemini mocked) | Full synthetic set matches the answer key, result still returned if the explanation call fails, one unreadable document does not fail the batch, a non-PDF disguised as a PDF is rejected without calling Gemini, GSTR-2B is required, missing API key fails closed without leaking details, repeated callers are rate limited |

The synthetic dataset is generated with a known **answer key**, so correctness is measured against ground truth rather than eyeballed. The server tests mock Gemini, so they are deterministic, free and runnable offline. The core was also type-checked with strict TypeScript (`strict`, `noUncheckedIndexedAccess`).

---

## 8. Accessibility

The interface is built with accessible component primitives (Radix) and follows these practices:

- **Semantic structure.** A single page title, real headings for each section, and a labelled form region for each upload area.
- **Labelled controls.** File inputs, the language selector and the Reconcile button have text labels. State is explained in text ("Add files to both sides, or load the demo data, to begin.").
- **Live announcements.** Progress and results are announced with `aria-live`, so screen reader users know when processing starts and finishes.
- **Status is never colour-only.** Each result has a text status label ("clean", "fixable", "ITC at risk", "needs review"), not just a colour.
- **Keyboard use.** Controls are reachable and operable by keyboard, and the row details panel opens from the table.
- **Zoom allowed.** The viewport does not disable pinch zoom or text scaling.
- **Plain-language errors.** Server errors are shown as friendly messages, never raw codes or stack traces.
- **Language access.** The explanation and supplier messages can be generated in English, हिन्दी or मराठी.
- **Copy to clipboard.** Supplier messages have a Copy button, so users do not need to select text precisely.

---

## 9. Code quality

- **Strict TypeScript** throughout, with shared domain types and an explicit response contract (`ReconcileResponse`).
- **Small, single-purpose modules** with descriptive names. Each file does one thing: GSTIN logic, rules, matching, upload checks, CSV, rate limiting.
- **Pure core, thin edges.** Business logic is free of I/O, and the HTTP handler only orchestrates.
- **Dependency injection** for `fetch` and the clock, so the Gemini client and time-based logic are testable without network or real time.
- **Explicit error paths.** Each failure maps to a clear status code and a safe message.
- **Configuration in data.** Rates and state codes are JSON, with effective dates and a note to verify them against official notifications.
- **Documented intent.** Doc comments explain why, for example why model output is validated and why the limiter is best effort.
- **Reproducibility.** A script regenerates the demo dataset and answer key, so tests and demo can always be rebuilt.

---

## 10. Run it yourself

**Prerequisites:** Node 20+ (or Bun) and a Gemini API key from [Google AI Studio](https://aistudio.google.com/).

```bash
git clone https://github.com/Aaryan1827/itc-match.git
cd itc-match
npm install            # or: bun install
cp .env.example .env   # then add your GEMINI_API_KEY
npm run dev
npm run test
```

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | none | Gemini API key (server only) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Model name. Check the current name in AI Studio. |
| `MAX_FILES` | No | `10` | Max invoices per request (1 to 10) |
| `MAX_FILE_MB` | No | `5` | Max size per invoice in MB (1 to 10) |
| `RATE_LIMIT_PER_MIN` | No | `10` | Requests per minute per IP (1 to 120) |

### Deploy to Vercel

1. Import the repository in Vercel.
2. Add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) under Environment Variables.
3. Deploy. If the build targets the wrong runtime, set `NITRO_PRESET=vercel` and redeploy.

### Regenerate the demo data

```bash
python3 scripts/generate_samples.py
```

---

## 11. API reference

### `POST /api/reconcile`

`multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `invoices` | file, repeated | 1 to 10 files. PDF, PNG, JPEG or WebP, up to 5 MB each |
| `gstr2b` | file | One CSV, up to 1 MB |
| `lang` | text, optional | `en` (default), `hi` or `mr` |

**200 response**

```json
{
  "summary": {
    "results": [
      {
        "fileName": "INV-001.pdf",
        "invoiceNumber": "TS-2026-0142",
        "supplierName": "Example Supplier",
        "status": "clean | fixable | itc_at_risk | needs_review",
        "issues": [{ "code": "NOT_IN_2B", "message": "..." }],
        "taxAmount": 0,
        "itcAtRisk": 0,
        "matchedTo": null
      }
    ],
    "unmatchedGstr2b": [],
    "itcAtRiskTotal": 0,
    "counts": { "clean": 0, "fixable": 0, "itc_at_risk": 0, "needs_review": 0 }
  },
  "narrative": "Plain-language overview",
  "followUps": [{ "invoiceNumber": "TS-2026-0142", "message": "Supplier message" }],
  "failed": [{ "fileName": "blurry.pdf", "reason": "This document could not be read. Try a clearer scan or photo." }],
  "timingsMs": { "extract": 0, "reconcile": 0, "explain": 0, "total": 0 },
  "model": "gemini-2.5-flash"
}
```

**Error responses** are `{ "error": "<friendly message>" }` with these status codes:

| Status | When |
|---|---|
| `400` | Missing or invalid fields, bad GSTR-2B CSV, wrong number of invoices |
| `413` | Upload or CSV too large |
| `429` | Rate limit exceeded (`Retry-After: 60`) |
| `500` | Service not configured |

---

## 12. Demo dataset

The repository includes **10 synthetic invoices** (PDFs), a matching `gstr-2b.csv`, and an answer key. All data is fictional.

| Invoices | Planted issue | Expected result |
|---|---|---|
| 3 | none | `clean` |
| 1 | IGST charged on an intra-state sale (`TAX_TYPE_MISMATCH`) | `fixable` |
| 1 | Totals do not add up (`ARITHMETIC_MISMATCH`) | `fixable` |
| 1 | Mistyped supplier GSTIN (`GSTIN_CHECKSUM`) | `itc_at_risk` |
| 1 | Supplier never filed it (`NOT_IN_2B`) | `itc_at_risk` |
| 1 | Invoice number formatted differently from GSTR-2B (`FUZZY_MATCH`) | `fixable` |
| 1 | Rate not valid on the invoice date (`RATE_NOT_ALLOWED`) | `needs_review` |
| 1 | Same invoice uploaded twice (`DUPLICATE_INVOICE`) | `needs_review` |

Use **Load demo data** in the app to run the whole set in one click.

---

## 13. Evaluation map

| Focus area | Where to look |
|---|---|
| **Code quality** | [Project structure](#project-structure), [Code quality](#9-code-quality), `src/lib/gst/` |
| **Security** | [Security](#5-security), `src/lib/server/upload.ts`, `prompts.ts`, `rate-limit.ts`, `vercel.json` |
| **Efficiency** | [Efficiency](#6-efficiency), `handler.ts` (worker pool), `timingsMs` in the response |
| **Testing** | [Testing](#7-testing), `tests/`, the answer-key benchmark |
| **Accessibility** | [Accessibility](#8-accessibility), language selector, `aria-live` announcements |
| **Problem statement alignment** | [Problem statement](#1-problem-statement-and-alignment), [How it works](#2-how-it-works) |

---

## 14. Known limitations

Stated openly, so reviewers know what this is and is not.

- **Not tax advice.** TaxSure AI flags risks for a human to review. It does not file returns or replace a chartered accountant.
- **GST rates need verification.** Rate slabs are config data. Verify `src/config/gst-rates.json` against the latest CBIC and GST Council notifications before relying on it for real filings. It checks the overall rate on the invoice and does not map HSN codes to specific rates.
- **Extraction depends on document quality.** Blurry or unusual layouts may be rejected or flagged `LOW_CONFIDENCE`. They are reported in the "could not read" list and never guessed.
- **Rate limiting is per instance.** See the [Security](#5-security) notes.
- **No persistence.** Results are not saved. Refreshing the page clears them.
- **Matching** uses supplier GSTIN plus invoice number (exact, then normalised). It does not yet use an LLM judgement for leftover near-matches.
- **Scope.** GSTR-2B CSV columns must match the expected headers, and the sample data is synthetic.

## Roadmap

- Shared rate limiting (Redis or similar)
- HSN-to-rate lookup
- Export of results to CSV and Excel
- Tighter CSP using nonces
- Browser-level accessibility and end-to-end tests

---

*Built for a hackathon by Aaryan. All sample data is fictional.*
