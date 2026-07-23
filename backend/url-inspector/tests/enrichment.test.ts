import { describe, expect, it, vi } from "vitest";
import {
  calculateApproximateAgeDays,
  discoverDomainRdapEndpoint,
  enrichHostname,
  EnrichmentProviderError,
  parseCertificateTransparency,
  parseDnsResponse,
  parseDomainRdap,
  parseIpRdap,
  parseRdapDate,
  queryDns,
  queryNetwork,
  queryRegistration,
  sanitizeCertificateName,
} from "../src/enrichment";

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

describe("passive DNS metadata", () => {
  it("normalizes IPv4, IPv6, MX, NS, and CNAME answers", () => {
    expect(parseDnsResponse({ Status: 0, Answer: [{ type: 1, data: "203.0.113.8" }] }, 1))
      .toEqual(["203.0.113.8"]);
    expect(parseDnsResponse({ Status: 0, Answer: [{ type: 28, data: "2001:DB8::8" }] }, 28))
      .toEqual(["2001:db8::8"]);
    expect(parseDnsResponse({ Status: 0, Answer: [{ type: 15, data: "10 MAIL.EXAMPLE.COM." }] }, 15))
      .toEqual(["10 mail.example.com"]);
    expect(parseDnsResponse({ Status: 0, Answer: [{ type: 2, data: "NS1.EXAMPLE.COM." }] }, 2))
      .toEqual(["ns1.example.com"]);
    expect(parseDnsResponse({ Status: 0, Answer: [{ type: 5, data: "EDGE.EXAMPLE.COM." }] }, 5))
      .toEqual(["edge.example.com"]);
  });

  it("rejects malformed DNS provider responses", () => {
    expect(() => parseDnsResponse({ Status: "0", Answer: [] }, 1))
      .toThrow(EnrichmentProviderError);
    expect(() => parseDnsResponse({
      Status: 0,
      Answer: Array.from({ length: 201 }, () => ({ type: 1, data: "8.8.8.8" })),
    }, 1)).toThrow(EnrichmentProviderError);
    expect(() => parseDnsResponse({ Status: 0, Answer: [{ type: 1, data: "999.1.1.1" }] }, 1))
      .toThrow(EnrichmentProviderError);
  });

  it("queries only the passive DNS provider and never the submitted hostname", async () => {
    const calls: string[] = [];
    const providerFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url.href);
      return jsonResponse({ Status: 0, Answer: [] });
    }) as typeof fetch;
    await queryDns("submitted.example", providerFetch);
    expect(calls).toHaveLength(5);
    expect(calls.every((value) => new URL(value).origin === "https://cloudflare-dns.com")).toBe(true);
    expect(calls.every((value) => new URL(value).hostname !== "submitted.example")).toBe(true);
  });
});

describe("RDAP registration metadata", () => {
  it("parses RDAP dates and calculates approximate age", () => {
    expect(parseRdapDate("2020-01-02T03:04:05Z")).toBe("2020-01-02T03:04:05.000Z");
    expect(parseRdapDate("not-a-date")).toBeNull();
    expect(calculateApproximateAgeDays(
      "2020-01-01T00:00:00.000Z",
      new Date("2020-01-11T12:00:00.000Z"),
    )).toBe(10);
  });

  it("treats missing registrar and redacted optional fields as unavailable values", () => {
    const parsed = parseDomainRdap(
      { objectClassName: "domain", status: ["client transfer prohibited"] },
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(parsed).toMatchObject({
      status: "available",
      registrar: null,
      createdAt: null,
      updatedAt: null,
      expiresAt: null,
      approximateAgeDays: null,
    });
  });

  it("rejects malformed RDAP responses", () => {
    expect(() => parseDomainRdap({ objectClassName: "domain", events: "redacted" }))
      .toThrow(EnrichmentProviderError);
  });

  it("rejects an unsafe RDAP redirect", async () => {
    const unsafeBootstrap = vi.fn(async () => jsonResponse({
      services: [[["com"], ["http://127.0.0.1/rdap/"]]],
    })) as typeof fetch;
    await expect(queryRegistration("example.com", unsafeBootstrap))
      .rejects.toBeInstanceOf(EnrichmentProviderError);
    expect(unsafeBootstrap).toHaveBeenCalledOnce();
  });

  it("discovers an HTTPS domain RDAP endpoint from the IANA bootstrap", () => {
    expect(discoverDomainRdapEndpoint({
      services: [[["com", "net"], ["https://rdap.registry.example/v1/"]]],
    }, "example.com")).toBe("https://rdap.registry.example/v1/domain/example.com");
  });
});

describe("IP and Certificate Transparency metadata", () => {
  it("accepts IPv4 and IPv6 RDAP network records", () => {
    expect(parseIpRdap({ objectClassName: "ip network", name: "Example Net", country: "us" }))
      .toEqual({ organization: "Example Net", registrationCountry: "US" });
    expect(parseIpRdap({ objectClassName: "ip network", name: "IPv6 Example", country: "DE" }))
      .toEqual({ organization: "IPv6 Example", registrationCountry: "DE" });
  });

  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "203.0.113.8", "::1", "fc00::1"])(
    "rejects non-public network lookup address %s",
    async (address) => {
      const providerFetch = vi.fn() as unknown as typeof fetch;
      await expect(queryNetwork(address, providerFetch))
        .rejects.toBeInstanceOf(EnrichmentProviderError);
      expect(providerFetch).not.toHaveBeenCalled();
    },
  );

  it("sanitizes certificate names to the requested domain", () => {
    expect(sanitizeCertificateName("*.Api.Example.com.", "example.com")).toBe("api.example.com");
    expect(sanitizeCertificateName("unrelated.example.net", "example.com")).toBeNull();
    expect(sanitizeCertificateName("<script>", "example.com")).toBeNull();
  });

  it("limits and sorts relevant Certificate Transparency names", () => {
    const payload = Array.from({ length: 25 }, (_, index) => ({
      entry_timestamp: `2025-01-${String((index % 9) + 1).padStart(2, "0")}T00:00:00Z`,
      name_value: `host-${String(index).padStart(2, "0")}.example.com\nunrelated.test`,
    }));
    const parsed = parseCertificateTransparency(payload, "example.com", 5);
    expect(parsed.certificateCount).toBe(25);
    expect(parsed.names).toHaveLength(5);
    expect(parsed.names[0]).toBe("host-00.example.com");
    expect(parsed.names.every((name) => name.endsWith(".example.com"))).toBe(true);
  });

  it("rejects malformed Certificate Transparency responses", () => {
    expect(() => parseCertificateTransparency([{ name_value: "example.com" }], "example.com"))
      .toThrow(EnrichmentProviderError);
    expect(() => parseCertificateTransparency(
      Array.from({ length: 5_001 }, () => ({
        entry_timestamp: "2025-01-01T00:00:00Z",
        name_value: "example.com",
      })),
      "example.com",
    )).toThrow(EnrichmentProviderError);
  });
});

describe("enrichment orchestration", () => {
  it("returns partial metadata during a provider outage and uses provider hosts only", async () => {
    const calls: URL[] = [];
    const providerFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      if (url.hostname === "cloudflare-dns.com") {
        const type = url.searchParams.get("type");
        return jsonResponse({
          Status: 0,
          Answer: type === "A" ? [{ type: 1, data: "8.8.8.8" }] : [],
        });
      }
      if (url.hostname === "data.iana.org") {
        return jsonResponse({
          services: [[["example"], ["https://rdap.registry.example/v1/"]]],
        });
      }
      if (url.hostname === "rdap.registry.example") {
        return jsonResponse({ errorCode: 503 }, 503);
      }
      if (url.hostname === "stat.ripe.net") {
        return jsonResponse({ data: { asns: [{ asn: 64496, holder: "Example Network" }] } });
      }
      if (url.hostname === "rdap.org" && url.pathname.startsWith("/ip/")) {
        return jsonResponse({ objectClassName: "ip network", name: "Example Net", country: "US" });
      }
      if (url.hostname === "crt.sh") return jsonResponse([]);
      return jsonResponse({}, 500);
    }) as typeof fetch;

    const result = await enrichHostname(
      "submitted.example",
      providerFetch,
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(result.status).toBe("partial");
    expect(result.dns.status).toBe("available");
    expect(result.registration.status).toBe("unavailable");
    expect(result.network).toMatchObject({ status: "available", asn: 64496 });
    expect(result.certificateTransparency.status).toBe("available");
    expect(calls.every((url) => url.hostname !== "submitted.example")).toBe(true);
    expect(new Set(calls.map((url) => url.hostname))).toEqual(
      new Set([
        "cloudflare-dns.com", "data.iana.org", "rdap.registry.example",
        "rdap.org", "stat.ripe.net", "crt.sh",
      ]),
    );
  });
});
