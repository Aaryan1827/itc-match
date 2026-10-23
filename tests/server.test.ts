import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";

import { handleReconcile } from "../src/lib/server/handler";
import { gstr2bRowsFromCsv, parseCsv, toIsoDate } from "../src/lib/server/csv";
import { FixedWindowLimiter } from "../src/lib/server/rate-limit";
import { checkInvoiceFile, safeFileName, sniffKind } from "../src/lib/server/upload";
import type { ExtractedInvoice, ReconcileResponse } from "../src/lib/gst/types";

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf-8");
const fixtures = JSON.parse(read("../samples/extracted-fixtures.json")) as ExtractedInvoice[];
const csvText = read("../samples/gstr-2b.csv");
const truth = JSON.parse(read("../samples/ground-truth.json")) as {
  expectedItcAtRiskInr: number;
  invoices: { id: string; expectedStatus: string }[];
};

const PDF_HEADER = "%PDF-1.4\n";
const env = { LOVABLE_API_KEY: "test-key", GEMINI_MODEL: "test-model", RATE_LIMIT_PER_MIN: "100" };

/**
 * Mock AI gateway (OpenAI-compatible chat completions): the fake PDF body carries
 * an invoice id, so the mock can answer per document.
 */
function mockGemini(options: { failExplain?: boolean; failId?: string } = {}) {
  return async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body)) as {
      messages: { content: unknown }[];
    };
    const raw = JSON.stringify(body.messages);
    const imageUrl = /"file_data"\s*:\s*"data:[^"]*;base64,([^"]+)"/.exec(raw)?.[1];
    if (process.env.DBG) console.log("DBG capture:", imageUrl?.slice(0, 24), JSON.stringify(raw).slice(0, 200));
    const reply = (payload: unknown): Response =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
    if (imageUrl) {
      const id = /INV\d\d/.exec(atob(imageUrl))?.[0] ?? "";
      if (id === options.failId) return new Response("boom", { status: 500 });
      const { fileName: _ignored, ...rest } = fixtures.find((f) => f.fileName === `${id}.pdf`) as ExtractedInvoice;
      return reply(rest);
    }
    if (options.failExplain) return new Response("boom", { status: 500 });
    return reply({ summary: "Mock summary.", followUps: [{ invoiceNumber: "KPW/26/0433", message: "Please file this invoice." }] });
  };
}

function buildRequest(files: { name: string; content: string }[], csv: string | null = csvText): Request {
  const form = new FormData();
  for (const f of files) form.append("invoices", new File([f.content], f.name, { type: "application/pdf" }));
  if (csv !== null) form.append("gstr2b", new File([csv], "gstr2b.csv", { type: "text/csv" }));
  return new Request("http://localhost/api/reconcile", { method: "POST", body: form });
}

const allInvoices = fixtures.map((f) => ({ name: f.fileName, content: `${PDF_HEADER}%${f.fileName.replace(".pdf", "")}` }));

describe("upload checks", () => {
  it("recognises file types by their bytes, not their names", () => {
    assert.equal(sniffKind(new TextEncoder().encode("%PDF-1.7")), "pdf");
    assert.equal(sniffKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d])), "png");
    assert.equal(sniffKind(new TextEncoder().encode("<script>alert(1)</script>")), null);
  });
  it("rejects empty and oversized files", () => {
    assert.equal(checkInvoiceFile(new Uint8Array(0), 10).ok, false);
    assert.equal(checkInvoiceFile(new TextEncoder().encode("%PDF-1.4 more than ten bytes"), 10).ok, false);
  });
  it("sanitises file names", () => {
    assert.equal(safeFileName("../../etc/<b>passwd.pdf"), "_b_passwd.pdf");
  });
});

describe("csv", () => {
  it("handles quoted commas and escaped quotes", () => {
    assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi"""\n'), [["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("converts DD/MM/YYYY dates", () => {
    assert.equal(toIsoDate("5/9/2026"), "2026-09-05");
  });
  it("maps the GSTR-2B columns", () => {
    const result = gstr2bRowsFromCsv(csvText);
    assert.ok(result.ok);
    assert.equal(result.rows.length, 8);
  });
  it("reports missing columns", () => {
    assert.equal(gstr2bRowsFromCsv("foo,bar\n1,2").ok, false);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    let time = 0;
    const limiter = new FixedWindowLimiter(2, 1000, () => time);
    assert.equal(limiter.allow("a"), true);
    assert.equal(limiter.allow("a"), true);
    assert.equal(limiter.allow("a"), false);
    assert.equal(limiter.allow("b"), true);
    time = 1001;
    assert.equal(limiter.allow("a"), true);
  });
});

describe("POST /api/reconcile (end to end, Gemini mocked)", () => {
  it("reconciles the full synthetic set and matches the answer key", async () => {
    const res = await handleReconcile(buildRequest(allInvoices), env, { fetch: mockGemini() as typeof fetch });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    const body = (await res.json()) as ReconcileResponse;
    assert.equal(body.summary.itcAtRiskTotal, truth.expectedItcAtRiskInr);
    for (const expected of truth.invoices) {
      const actual = body.summary.results.find((r) => r.fileName === `${expected.id}.pdf`);
      assert.equal(actual?.status, expected.expectedStatus, expected.id);
    }
    assert.equal(body.narrative, "Mock summary.");
    assert.equal(body.followUps.length, 1);
    assert.equal(body.failed.length, 0);
  });

  it("still returns a result when the explanation call fails", async () => {
    const res = await handleReconcile(buildRequest(allInvoices), env, { fetch: mockGemini({ failExplain: true }) as typeof fetch });
    const body = (await res.json()) as ReconcileResponse;
    assert.equal(res.status, 200);
    assert.match(body.narrative, /at risk/);
    assert.equal(body.summary.itcAtRiskTotal, truth.expectedItcAtRiskInr);
  });

  it("isolates one unreadable document instead of failing the batch", async () => {
    const res = await handleReconcile(buildRequest(allInvoices), env, { fetch: mockGemini({ failId: "INV03" }) as typeof fetch });
    const body = (await res.json()) as ReconcileResponse;
    assert.equal(body.failed.length, 1);
    assert.equal(body.failed[0]?.fileName, "INV03.pdf");
    assert.equal(body.summary.results.length, 9);
  });

  it("rejects a non-PDF disguised as a PDF without calling Gemini", async () => {
    let calls = 0;
    const counting = (async () => { calls += 1; return new Response("{}"); }) as unknown as typeof fetch;
    const res = await handleReconcile(buildRequest([{ name: "evil.pdf", content: "<script>x</script>" }]), env, { fetch: counting });
    assert.equal(res.status, 422);
    assert.equal(calls, 0);
  });

  it("requires the GSTR-2B file", async () => {
    const res = await handleReconcile(buildRequest(allInvoices, null), env, { fetch: mockGemini() as typeof fetch });
    assert.equal(res.status, 400);
  });

  it("fails closed when the API key is missing, without leaking details", async () => {
    const res = await handleReconcile(buildRequest(allInvoices), {}, { fetch: mockGemini() as typeof fetch });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "The service is not configured. Please try again later." });
  });

  it("surfaces provider-level failures with the provider's safe message", async () => {
    const res = await handleReconcile(
      buildRequest(allInvoices),
      env,
      {
        fetch: (async () =>
          new Response(JSON.stringify({ error: { message: "Insufficient AI credits." } }), {
            status: 402,
            headers: { "content-type": "application/json" },
          })) as unknown as typeof fetch,
      },
    );
    assert.equal(res.status, 402);
    assert.deepEqual(await res.json(), { error: "Insufficient AI credits." });
  });

  it("rate limits repeated callers", async () => {
    const tight = { ...env, RATE_LIMIT_PER_MIN: "1" };
    const headers = { "x-forwarded-for": "9.9.9.9" };
    const make = (): Request => {
      const req = buildRequest(allInvoices);
      return new Request(req, { headers: { ...Object.fromEntries(req.headers), ...headers } });
    };
    await handleReconcile(make(), tight, { fetch: mockGemini() as typeof fetch });
    const second = await handleReconcile(make(), tight, { fetch: mockGemini() as typeof fetch });
    assert.equal(second.status, 429);
  });
});
