import { describe, expect, it, vi } from "vitest";
import { createHandler } from "../src/index";
import {
  checkGoogleSafeBrowsing,
  parseGoogleSafeBrowsingResponse,
  parseGoogleSafeBrowsingProtobuf,
  ProviderUnavailableError,
  scoreThreats,
} from "../src/reputation";
import type { Env, ThreatType } from "../src/types";
import { parseSubmittedUrl, UrlPolicyError } from "../src/url-policy";

const env: Env = {
  GOOGLE_SAFE_BROWSING_API_KEY: "test-key",
  APP_HASH_SECRET: "test-hash-secret-with-sufficient-entropy",
  URL_CHECK_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
};

function request(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://worker.example/api/url-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("URL policy", () => {
  it("uses URL parsing and removes fragments", () => {
    expect(parseSubmittedUrl("https://example.com/path?q=1#fragment").href)
      .toBe("https://example.com/path?q=1");
  });

  it.each(["ftp://example.com", "file:///etc/passwd", "javascript:alert(1)"])(
    "blocks unsupported scheme %s",
    (value) => expect(() => parseSubmittedUrl(value)).toThrowError(UrlPolicyError),
  );

  it.each(["http://localhost", "http://api.localhost"])(
    "blocks localhost %s",
    (value) => expect(() => parseSubmittedUrl(value)).toThrow(/localhost/u),
  );

  it.each(["http://10.0.0.1", "http://172.16.5.4", "http://192.168.1.1", "http://127.0.0.1"])(
    "blocks private or loopback IPv4 %s",
    (value) => expect(() => parseSubmittedUrl(value)).toThrow(/non-public/u),
  );

  it("blocks IPv6 loopback", () => {
    expect(() => parseSubmittedUrl("http://[::1]/")).toThrow(/non-public/u);
  });

  it.each([
    "http://169.254.169.254/latest/meta-data",
    "http://100.100.100.200/latest/meta-data",
    "http://168.63.129.16/",
    "http://metadata.google.internal/",
  ])("blocks cloud metadata address %s", (value) => {
    expect(() => parseSubmittedUrl(value)).toThrow();
  });

  it.each(["http://2130706433", "http://127.1", "http://0x7f000001", "http://0177.0.0.1"])(
    "blocks ambiguous numeric IP %s",
    (value) => expect(() => parseSubmittedUrl(value)).toThrow(/ambiguous/u),
  );

  it.each([
    "https://user:password@example.com",
    " https://example.com",
    "https://example.com/\u0000",
    "not a url",
  ])("blocks malformed or prohibited URL %s", (value) => {
    expect(() => parseSubmittedUrl(value)).toThrow();
  });
});

describe("request boundary", () => {
  it("rejects malformed JSON", async () => {
    const response = await createHandler()(request("{"), env);
    expect(response.status).toBe(400);
    expect((await responseJson(response)).code).toBe("malformed_json");
  });

  it("rejects oversized bodies from actual bytes", async () => {
    const response = await createHandler()(request(JSON.stringify({ url: `https://example.com/${"a".repeat(5000)}` })), env);
    expect(response.status).toBe(413);
    expect((await responseJson(response)).code).toBe("request_too_large");
  });

  it("enforces the CORS allowlist", async () => {
    const handler = createHandler(async () => ({ threats: [], cacheDurationSeconds: null }));
    const allowed = await handler(request('{"url":"https://example.com"}', { Origin: "https://sithbusiness.com" }), env);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://sithbusiness.com");
    const blocked = await handler(request('{"url":"https://example.com"}', { Origin: "https://evil.example" }), env);
    expect(blocked.status).toBe(403);
    expect(blocked.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("handles preflight and advertises only POST and OPTIONS", async () => {
    const response = await createHandler()(new Request("https://worker.example/api/url-check", {
      method: "OPTIONS",
      headers: { Origin: "https://www.sithbusiness.com" },
    }), env);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
  });

  it("returns provider timeouts as unavailable", async () => {
    const timeout = vi.fn(async () => { throw new ProviderUnavailableError(); });
    const response = await createHandler(timeout)(request('{"url":"https://example.com"}'), env);
    expect(response.status).toBe(503);
    expect((await responseJson(response)).status).toBe("unavailable");
  });

  it("returns arbitrary provider errors as unavailable without details", async () => {
    const response = await createHandler(async () => { throw new Error("secret upstream detail"); })(
      request('{"url":"https://example.com"}'),
      env,
    );
    const payload = await responseJson(response);
    expect(response.status).toBe(503);
    expect(payload.status).toBe("unavailable");
    expect(JSON.stringify(payload)).not.toContain("secret upstream detail");
  });

  it("returns the strict no-known-threat label and never safe", async () => {
    const response = await createHandler(async () => ({ threats: [], cacheDurationSeconds: null }))(
      request('{"url":"https://example.com"}'),
      env,
    );
    const payload = await responseJson(response);
    expect(payload.status).toBe("no_known_threat_detected");
    expect(JSON.stringify(payload)).not.toContain('"safe"');
    expect(Object.keys(payload).sort()).toEqual([
      "checked_at", "enrichment", "provider", "request_id", "risk_score",
      "schema_version", "status", "threats", "url_hash",
    ]);
  });

  it("returns a unique random request ID in JSON and the response header", async () => {
    const handler = createHandler(async () => ({ threats: [], cacheDurationSeconds: null }));
    const first = await handler(request('{"url":"https://example.com/private?token=one"}'), env);
    const second = await handler(request('{"url":"https://example.com/private?token=one"}'), env);
    const firstPayload = await responseJson(first);
    const secondPayload = await responseJson(second);
    expect(firstPayload.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(secondPayload.request_id).not.toBe(firstPayload.request_id);
    expect(first.headers.get("X-Request-ID")).toBe(firstPayload.request_id);
    expect(JSON.stringify(firstPayload.request_id)).not.toContain("example.com");
  });

  it("logs only sanitized request and section status metadata", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const handler = createHandler(async () => ({ threats: [], cacheDurationSeconds: null }));
    await handler(request('{"url":"https://example.com/path?secret=value"}'), env);
    const serialized = JSON.stringify(info.mock.calls);
    expect(serialized).not.toContain("example.com");
    expect(serialized).not.toContain("secret=value");
    expect(serialized).not.toContain(env.APP_HASH_SECRET);
    expect(serialized).not.toContain(env.GOOGLE_SAFE_BROWSING_API_KEY);
    expect(serialized).toContain("requestId");
    info.mockRestore();
  });

  it("keeps the Safe Browsing result when passive enrichment fails", async () => {
    const response = await createHandler(
      async () => ({ threats: ["MALWARE"], cacheDurationSeconds: null }),
      async () => { throw new Error("passive provider failed"); },
    )(request('{"url":"https://example.com"}'), env);
    const payload = await responseJson(response);
    expect(response.status).toBe(200);
    expect(payload.status).toBe("known_threat_detected");
    expect(payload.threats).toEqual(["MALWARE"]);
    expect((payload.enrichment as { status: string }).status).toBe("unavailable");
  });

  it("enforces rate limiting", async () => {
    const limitedEnv: Env = {
      ...env,
      URL_CHECK_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) },
    };
    const response = await createHandler()(request('{"url":"https://example.com"}'), limitedEnv);
    expect(response.status).toBe(429);
    expect((await responseJson(response)).status).toBe("rate_limited");
  });
});

describe("Google provider boundary", () => {
  it("times out provider requests at the configured boundary", async () => {
    const hangingFetch = (() => new Promise<Response>(() => undefined)) as typeof fetch;
    await expect(checkGoogleSafeBrowsing("https://example.com/", "key", hangingFetch, 5))
      .rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("treats provider HTTP errors as unavailable", async () => {
    const failedFetch = vi.fn(async () => new Response("upstream detail", { status: 503 })) as typeof fetch;
    await expect(checkGoogleSafeBrowsing("https://example.com/", "key", failedFetch))
      .rejects.toThrow("provider returned an error");
  });

  it("parses a protobuf response instead of attempting JSON parsing", async () => {
    const protobufFetch = vi.fn(async () => new Response(
      new Uint8Array([18, 3, 8, 172, 2]),
      { headers: { "Content-Type": "application/x-protobuf" } },
    )) as typeof fetch;
    await expect(checkGoogleSafeBrowsing("https://example.com/", "key", protobufFetch))
      .resolves.toEqual({ threats: [], cacheDurationSeconds: 300 });
  });

  it("rejects malformed JSON provider responses", async () => {
    const malformedFetch = vi.fn(async () => new Response(
      "{",
      { headers: { "Content-Type": "application/json; charset=UTF-8" } },
    )) as typeof fetch;
    await expect(checkGoogleSafeBrowsing("https://example.com/", "key", malformedFetch))
      .rejects.toThrow("invalid provider response");
  });

  it("accepts a v5 empty threats response", () => {
    expect(parseGoogleSafeBrowsingResponse({ threats: [] })).toEqual({
      threats: [],
      cacheDurationSeconds: null,
    });
  });

  it("accepts a v5 known threat response", () => {
    expect(parseGoogleSafeBrowsingResponse({
      threats: [{ url: "https://example.com/", threatTypes: ["MALWARE"] }],
    }).threats).toEqual(["MALWARE"]);
  });

  it("deduplicates and preserves multiple known threat types", () => {
    expect(parseGoogleSafeBrowsingResponse({
      threats: [{
        url: "https://example.com/",
        threatTypes: ["SOCIAL_ENGINEERING", "MALWARE", "MALWARE"],
      }],
    }).threats).toEqual(["MALWARE", "SOCIAL_ENGINEERING"]);
  });

  it.each([
    { threats: "not-an-array" },
    { threats: [null] },
    { threats: [{}] },
    { threats: [{ url: "not-a-url", threatTypes: ["MALWARE"] }] },
    { threats: [{ url: "https://example.com/", threatTypes: [] }] },
    { threats: [{ url: "https://example.com/", threatTypes: "MALWARE" }] },
  ])("rejects malformed v5 threats %#", (payload) => {
    expect(() => parseGoogleSafeBrowsingResponse(payload)).toThrow(ProviderUnavailableError);
  });

  it("rejects unknown future threat types instead of classifying them as clean", () => {
    expect(() => parseGoogleSafeBrowsingResponse({
      threats: [{
        url: "https://example.com/",
        threatTypes: ["NEW_UNKNOWN_THREAT"],
      }],
    })).toThrow(ProviderUnavailableError);
  });

  it("treats a missing threats field as no match", () => {
    expect(parseGoogleSafeBrowsingResponse({ cacheDuration: "300s" }).threats).toEqual([]);
  });

  it("parses a provider-supplied cacheDuration without exposing it publicly", () => {
    expect(parseGoogleSafeBrowsingResponse({
      threats: [],
      cacheDuration: "3.500000001s",
    }).cacheDurationSeconds).toBe(3.500000001);
    expect(() => parseGoogleSafeBrowsingResponse({
      threats: [],
      cacheDuration: "3.1234567890s",
    })).toThrow(ProviderUnavailableError);
  });

  it("uses GET, protobuf negotiation, an empty body, and a correctly encoded repeated urls parameter", async () => {
    const providerFetch = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => Response.json({
      threats: [],
      cacheDuration: "60s",
    }));
    await checkGoogleSafeBrowsing(
      "https://example.com/path?q=one two",
      "server-key",
      providerFetch as typeof fetch,
    );
    expect(providerFetch).toHaveBeenCalledOnce();
    const [input, init] = providerFetch.mock.calls[0] ?? [];
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    const providerUrl = new URL(String(input));
    expect(providerUrl.origin + providerUrl.pathname)
      .toBe("https://safebrowsing.googleapis.com/v5/urls:search");
    expect(providerUrl.searchParams.getAll("urls"))
      .toEqual(["https://example.com/path?q=one two"]);
    expect(providerUrl.searchParams.has("alt")).toBe(false);
    expect(String(input)).toContain(
      "urls=https%3A%2F%2Fexample.com%2Fpath%3Fq%3Done+two",
    );
    expect(providerUrl.searchParams.get("key")).toBe("server-key");
    expect(new Headers(init?.headers).get("Accept")).toBe("application/x-protobuf");
  });

  it("decodes known protobuf threat types and rejects unknown ones", () => {
    const url = new TextEncoder().encode("example.com/path");
    const threat = new Uint8Array([10, url.length, ...url, 18, 2, 1, 2]);
    const response = new Uint8Array([10, threat.length, ...threat]);
    expect(parseGoogleSafeBrowsingProtobuf(response).threats)
      .toEqual(["MALWARE", "SOCIAL_ENGINEERING"]);
    const unknown = new Uint8Array([10, url.length + 2, 10, url.length, ...url, 16, 99]);
    expect(() => parseGoogleSafeBrowsingProtobuf(unknown))
      .toThrow(ProviderUnavailableError);
  });
});

describe("scoring", () => {
  it.each([
    [[], 0],
    [["UNWANTED_SOFTWARE"], 80],
    [["SOCIAL_ENGINEERING"], 95],
    [["SOCIAL_ENGINEERING", "MALWARE"], 100],
  ] as [ThreatType[], number][])("scores %j as %d", (threats, expected) => {
    expect(scoreThreats(threats)).toBe(expected);
  });
});
