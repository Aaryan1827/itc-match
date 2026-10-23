# Security Policy

## Overview

ITC-Match processes uploaded invoice documents on the server side. This document
describes the security controls in place and their known limitations.

## Controls

### API Key
The Google AI (Gemini) API key is stored server-side only (environment variable
LOVABLE_API_KEY). It is never sent to the browser or logged.

### Upload Validation
Uploaded files are validated using **magic-byte checks** (first bytes of the
file buffer) before any content is parsed or passed to the model. Only PDF,
JPEG, PNG, and WebP files are accepted.

### Model Output Validation
All model (Gemini) responses are parsed against strict **Zod schemas** before
any field is used. Numeric fields are clamped; unexpected shapes are rejected.

### Prompt-Injection Guard
The model is only asked to **extract** invoice fields or **explain** pre-computed
findings. All reconciliation decisions (statuses, amounts, ITC at risk) are made
by deterministic TypeScript code — the model never decides business outcomes.

### Per-IP Rate Limiting
Requests are rate-limited per client IP using a fixed-window in-memory limiter.

### Generic Error Responses
Errors returned to clients are generic and do not include internal state,
stack traces, or invoice content.

### No Logging of Invoice Content
Invoice files, extracted fields, and GSTR-2B CSV rows are never written to logs.
Only opaque error messages and timing metrics are logged.

### Security Headers
Responses include X-Content-Type-Options: nosniff, Cache-Control: no-store,
and Referrer-Policy: no-referrer.

## Known Limitations

- **In-memory rate limiter**: The rate limiter is per-process. On serverless
  platforms with multiple warm instances, each instance has independent counters.
  This is best-effort and may not stop a distributed burst across instances.
- **CSP allows unsafe-inline**: The TanStack Start framework requires
  'unsafe-inline' for styles. A stricter CSP with nonces is not currently
  supported by the framework.

## Reporting a Vulnerability

Please open a private GitHub Security Advisory rather than a public issue.
