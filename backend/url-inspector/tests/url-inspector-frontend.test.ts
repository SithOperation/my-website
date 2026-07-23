import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeUrlStructure,
  classifyBackendResponse,
  isIpHostname,
  mapAssessment,
  parseBackendJson,
  parseInspectorUrl,
  RequestCoordinator,
  SessionHistory,
  validateSuccessResponse,
  WORKER_BASE_URL,
} from "../../../assets/js/url-inspector.js";

const cleanResponse = {
  schema_version: "1.0",
  status: "no_known_threat_detected",
  risk_score: 0,
  threats: [],
  url_hash: "hmac-sha256:abc123",
  provider: "google_safe_browsing",
  checked_at: "2026-07-22T12:00:00Z",
};

const enrichment = {
  schemaVersion: "1.0",
  status: "partial",
  dns: {
    status: "available", a: ["203.0.113.8"], aaaa: ["2001:db8::8"],
    mx: ["10 mail.example.com"], ns: ["ns1.example.com"], cname: null,
  },
  registration: {
    status: "unavailable", registrar: null, createdAt: null, updatedAt: null,
    expiresAt: null, approximateAgeDays: null, domainStatuses: [],
  },
  network: {
    status: "available", asn: 64496, organization: "Example Network",
    registrationCountry: "US",
  },
  certificateTransparency: {
    status: "available", certificateCount: 2,
    earliestObservedAt: "2025-01-01T00:00:00.000Z",
    latestObservedAt: "2025-02-01T00:00:00.000Z",
    names: ["example.com"],
  },
};

describe("frontend URL validation and structural analysis", () => {
  it("requires an explicit protocol", () => {
    expect(() => parseInspectorUrl("example.com")).toThrow(/http:\/\//u);
  });

  it("parses a valid URL", () => {
    expect(parseInspectorUrl("https://example.com/path").hostname).toBe("example.com");
  });

  it("analyzes a normal HTTPS URL without elevated findings", () => {
    const result = analyzeUrlStructure("https://example.com/path?a=1");
    expect(result.httpsUsed).toBe(true);
    expect(result.port).toBe("default");
    expect(result.queryParameterCount).toBe(1);
    expect(result.findings.some((item: { level: string }) => item.level === "Elevated")).toBe(false);
  });

  it("detects IP hostnames", () => {
    expect(isIpHostname("203.0.113.10")).toBe(true);
    expect(isIpHostname("example.com")).toBe(false);
    expect(analyzeUrlStructure("https://203.0.113.10/").ipHostname).toBe(true);
  });

  it("detects punycode and Unicode input", () => {
    const punycode = analyzeUrlStructure("https://xn--xample-9ua.com/");
    const unicode = analyzeUrlStructure("https://éxample.com/");
    expect(punycode.punycodeHostname).toBe(true);
    expect(unicode.unicodeCharacters).toBe(true);
    expect(unicode.punycodeHostname).toBe(true);
  });

  it("detects a non-default port", () => {
    const result = analyzeUrlStructure("https://example.com:8443/");
    expect(result.port).toBe("8443");
    expect(result.findings.some((item: { title: string }) => item.title === "Non-default port")).toBe(true);
  });

  it("detects a long path", () => {
    const result = analyzeUrlStructure(`https://example.com/${"a".repeat(130)}`);
    expect(result.findings.some((item: { title: string }) => item.title === "Unusually long path")).toBe(true);
  });

  it("detects redirect-style parameters", () => {
    const result = analyzeUrlStructure("https://example.com/login?redirect_uri=https%3A%2F%2Fother.example");
    expect(result.findings.some((item: { title: string }) => item.title === "Redirect-style parameter")).toBe(true);
  });

  it("handles HTML-like URL input as inert string data", () => {
    const result = analyzeUrlStructure("https://example.com/%3Cimg%20src=x%20onerror=alert(1)%3E");
    expect(result.normalizedUrl).toContain("%3Cimg");
  });
});

describe("backend response handling", () => {
  it.each([
    ["known_threat_detected", "Known Threat Detected"],
    ["no_known_threat_detected", "No Known Threat Detected"],
    ["unavailable", "Reputation Provider Unavailable"],
  ])("maps %s", (status, label) => {
    expect(mapAssessment({ status }).label).toBe(label);
  });

  it("maps a rate-limit response and respects Retry-After", () => {
    const result = classifyBackendResponse(false, { status: "rate_limited" }, "60");
    expect(result.kind).toBe("form_error");
    expect(result.message).toContain("Retry after 60 seconds");
  });

  it("renders a strict unavailable result even when the Worker returns HTTP 503", () => {
    const result = classifyBackendResponse(false, {
      ...cleanResponse,
      status: "unavailable",
      risk_score: null,
    });
    expect(result.kind).toBe("result");
    expect(result.result?.status).toBe("unavailable");
  });

  it("rejects malformed backend JSON", () => {
    expect(() => parseBackendJson("<html>error</html>")).toThrow(/unreadable/u);
  });

  it("treats an unexpected schema as unavailable", () => {
    expect(validateSuccessResponse({ status: "safe" })).toBeNull();
    expect(classifyBackendResponse(true, { ...cleanResponse, extra: "unexpected" }).kind)
      .toBe("unavailable");
  });

  it("validates the strict expected response", () => {
    expect(validateSuccessResponse(cleanResponse)?.status).toBe("no_known_threat_detected");
  });

  it("accepts a strictly valid versioned enrichment object", () => {
    const result = validateSuccessResponse({ ...cleanResponse, enrichment });
    expect(result?.enrichment?.network.asn).toBe(64496);
  });

  it.each([
    { ...enrichment, extra: true },
    { ...enrichment, dns: { ...enrichment.dns, extra: true } },
    { ...enrichment, network: { ...enrichment.network, registrationCountry: "USA" } },
    { ...enrichment, registration: { ...enrichment.registration, createdAt: "not-a-date" } },
    { ...enrichment, certificateTransparency: {
      ...enrichment.certificateTransparency,
      names: Array.from({ length: 21 }, () => "example.com"),
    } },
  ])("rejects malformed or expanded enrichment %#", (malformed) => {
    expect(validateSuccessResponse({ ...cleanResponse, enrichment: malformed })).toBeNull();
  });

  it("remains backward compatible when enrichment is absent", () => {
    expect(validateSuccessResponse(cleanResponse)?.enrichment).toBeNull();
  });
});

describe("privacy and request lifecycle", () => {
  it("stores no submitted URL in session history", () => {
    const history = new SessionHistory();
    history.add({
      status: cleanResponse.status,
      checkedAt: cleanResponse.checked_at,
      urlHash: cleanResponse.url_hash,
    });
    const serialized = JSON.stringify(history.list());
    expect(serialized).not.toContain("example.com");
    expect(Object.keys(history.list()[0] ?? {}).sort()).toEqual(["checkedAt", "hash", "status"]);
  });

  it("limits current-tab history to five entries", () => {
    const history = new SessionHistory();
    for (let index = 0; index < 7; index += 1) {
      history.add({ status: "unavailable", checkedAt: String(index), urlHash: `hash-${index}` });
    }
    expect(history.list()).toHaveLength(5);
  });

  it("aborts a superseded request", () => {
    const requests = new RequestCoordinator();
    const first = requests.begin();
    const second = requests.begin();
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    expect(requests.isCurrent(second)).toBe(true);
  });

  it("uses the deployed Worker base URL", () => {
    expect(WORKER_BASE_URL).toBe("https://sentinel-url-inspector.great-gs.workers.dev");
  });

  it("uses no persistent storage, cookies, innerHTML, eval, or dynamic submitted links", () => {
    const root = resolve(import.meta.dirname, "../../..");
    const script = readFileSync(resolve(root, "assets/js/url-inspector.js"), "utf8");
    expect(script).not.toMatch(/localStorage|sessionStorage|document\.cookie|innerHTML|document\.write|\beval\s*\(/u);
    expect(script).not.toMatch(/\.href\s*=\s*(?:input|structure|normalized)/u);
    expect(script).not.toMatch(/cloudflare-dns\.com|rdap\.org|stat\.ripe\.net|crt\.sh/u);
  });

  it("does not render the submitted URL as an anchor", () => {
    const root = resolve(import.meta.dirname, "../../..");
    const page = readFileSync(resolve(root, "url-inspector.html"), "utf8");
    expect(page).not.toContain('id="normalized-url-link"');
    expect(page).not.toContain('target="_blank"');
  });
});
