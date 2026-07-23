import type {
  CertificateTransparencyEnrichment,
  DnsEnrichment,
  EnrichmentResult,
  NetworkEnrichment,
  RegistrationEnrichment,
} from "./types";
import { parseSubmittedUrl } from "./url-policy";

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const RDAP_ENDPOINT = "https://rdap.org";
const IANA_DNS_RDAP_BOOTSTRAP = "https://data.iana.org/rdap/dns.json";
const RIPESTAT_ENDPOINT = "https://stat.ripe.net/data/prefix-overview/data.json";
const CT_ENDPOINT = "https://crt.sh/";
const CONTROL = /[\u0000-\u001f\u007f]/u;
const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/u;
const IPV6 = /^[0-9a-f:]+$/iu;
const DNS_NAME = /^(?=.{1,253}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/iu;

export class EnrichmentProviderError extends Error {
  constructor() {
    super("passive enrichment provider unavailable");
    this.name = "EnrichmentProviderError";
  }
}

function cleanText(value: unknown, maximum = 300): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/gu, " ");
  return cleaned && cleaned.length <= maximum && !CONTROL.test(cleaned) ? cleaned : null;
}

function cleanDnsName(value: unknown): string | null {
  const cleaned = cleanText(value, 253)?.replace(/\.$/u, "").toLowerCase() ?? null;
  return cleaned && DNS_NAME.test(cleaned) ? cleaned : null;
}

function isIpv4(value: string): boolean {
  if (!IPV4.test(value)) return false;
  return value.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255);
}

function isIpv6(value: string): boolean {
  if (!value.includes(":") || !IPV6.test(value) || value.length > 45) return false;
  try {
    return new URL(`http://[${value}]/`).hostname.length > 2;
  } catch {
    return false;
  }
}

function providerFetch(fetcher: typeof fetch | undefined, url: string, init: RequestInit): Promise<Response> {
  return fetcher ? fetcher(url, init) : globalThis.fetch(url, init);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new EnrichmentProviderError()), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function acceptedContentType(response: Response, accepted: readonly string[]): boolean {
  const mediaType = response.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType !== undefined && accepted.includes(mediaType);
}

async function fetchJsonLimited(
  url: string,
  fetcher: typeof fetch | undefined,
  timeoutMs: number,
  maximumBytes: number,
  accept: string,
  acceptedTypes: readonly string[],
  redirectValidator?: (target: URL) => boolean,
): Promise<unknown> {
  try {
    const init: RequestInit = {
      method: "GET",
      headers: { Accept: accept },
      redirect: "manual",
    };
    let response = await withTimeout(providerFetch(fetcher, url, init), timeoutMs);
    if (response.status >= 300 && response.status < 400 && redirectValidator) {
      const location = response.headers.get("Location");
      if (!location) throw new EnrichmentProviderError();
      const target = new URL(location, url);
      if (!redirectValidator(target)) throw new EnrichmentProviderError();
      response = await withTimeout(providerFetch(fetcher, target.href, init), timeoutMs);
    }
    if (!response.ok) throw new EnrichmentProviderError();
    if (!acceptedContentType(response, acceptedTypes)) throw new EnrichmentProviderError();
    const declared = Number(response.headers.get("Content-Length") ?? 0);
    if (declared > maximumBytes) throw new EnrichmentProviderError();
    if (!response.body) throw new EnrichmentProviderError();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new EnrichmentProviderError();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    if (error instanceof EnrichmentProviderError) throw error;
    throw new EnrichmentProviderError();
  }
}

interface DnsAnswer {
  type?: unknown;
  data?: unknown;
}

export function parseDnsResponse(payload: unknown, expectedType: number): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new EnrichmentProviderError();
  }
  const response = payload as { Status?: unknown; Answer?: unknown };
  if (typeof response.Status !== "number" || !Number.isInteger(response.Status)) {
    throw new EnrichmentProviderError();
  }
  if (response.Answer === undefined) return [];
  if (!Array.isArray(response.Answer)) throw new EnrichmentProviderError();
  if (response.Answer.length > 200) throw new EnrichmentProviderError();
  const values: string[] = [];
  for (const candidate of response.Answer) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new EnrichmentProviderError();
    }
    const answer = candidate as DnsAnswer;
    if (answer.type !== expectedType) continue;
    const raw = cleanText(answer.data, 512);
    if (!raw) throw new EnrichmentProviderError();
    let normalized: string | null = null;
    if (expectedType === 1 && isIpv4(raw)) normalized = raw;
    if (expectedType === 28 && isIpv6(raw)) normalized = raw.toLowerCase();
    if ([2, 5].includes(expectedType)) normalized = cleanDnsName(raw);
    if (expectedType === 15) {
      const match = raw.match(/^(\d{1,5})\s+(.+)$/u);
      if (match?.[2] === ".") continue;
      const target = match ? cleanDnsName(match[2]) : null;
      if (match && target && Number(match[1]) <= 65535) normalized = `${Number(match[1])} ${target}`;
    }
    if (!normalized) throw new EnrichmentProviderError();
    values.push(normalized);
  }
  return Array.from(new Set(values)).sort().slice(0, 20);
}

export async function queryDns(hostname: string, fetcher?: typeof fetch): Promise<DnsEnrichment> {
  const types = [["A", 1], ["AAAA", 28], ["MX", 15], ["NS", 2], ["CNAME", 5]] as const;
  const results = await Promise.all(types.map(async ([type, code]) => {
    const requestUrl = new URL(DOH_ENDPOINT);
    requestUrl.searchParams.set("name", hostname);
    requestUrl.searchParams.set("type", type);
    const payload = await fetchJsonLimited(
      requestUrl.href, fetcher, 3_500, 64 * 1024, "application/dns-json",
      ["application/dns-json", "application/json"],
    );
    return parseDnsResponse(payload, code);
  }));
  const [a = [], aaaa = [], mx = [], ns = [], cnameRecords = []] = results;
  return {
    status: "available",
    a,
    aaaa,
    mx,
    ns,
    cname: cnameRecords[0] ?? null,
  };
}

export function parseRdapDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function calculateApproximateAgeDays(createdAt: string | null, now = new Date()): number | null {
  if (!createdAt) return null;
  const created = Date.parse(createdAt);
  const current = now.getTime();
  if (!Number.isFinite(created) || created > current) return null;
  return Math.floor((current - created) / 86_400_000);
}

function rdapEvent(events: unknown, actions: string[]): string | null {
  if (events === undefined) return null;
  if (!Array.isArray(events)) throw new EnrichmentProviderError();
  for (const candidate of events) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new EnrichmentProviderError();
    }
    const event = candidate as { eventAction?: unknown; eventDate?: unknown };
    if (typeof event.eventAction !== "string") throw new EnrichmentProviderError();
    if (actions.includes(event.eventAction.toLowerCase())) {
      const date = parseRdapDate(event.eventDate);
      if (!date) throw new EnrichmentProviderError();
      return date;
    }
  }
  return null;
}

function registrarFromEntities(entities: unknown): string | null {
  if (entities === undefined) return null;
  if (!Array.isArray(entities)) throw new EnrichmentProviderError();
  for (const candidate of entities) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new EnrichmentProviderError();
    }
    const entity = candidate as { roles?: unknown; vcardArray?: unknown };
    if (!Array.isArray(entity.roles) || !entity.roles.every((role) => typeof role === "string")) {
      throw new EnrichmentProviderError();
    }
    if (!entity.roles.map((role) => role.toLowerCase()).includes("registrar")) continue;
    if (!Array.isArray(entity.vcardArray) || !Array.isArray(entity.vcardArray[1])) return null;
    for (const field of entity.vcardArray[1]) {
      if (Array.isArray(field) && field[0] === "fn") {
        return cleanText(field[3], 200);
      }
    }
  }
  return null;
}

export function parseDomainRdap(payload: unknown, now = new Date()): RegistrationEnrichment {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new EnrichmentProviderError();
  const value = payload as {
    objectClassName?: unknown; events?: unknown; entities?: unknown; status?: unknown;
  };
  if (value.objectClassName !== "domain") throw new EnrichmentProviderError();
  if (value.status !== undefined &&
      (!Array.isArray(value.status) || value.status.length > 100 ||
       !value.status.every((item) => cleanText(item, 160)))) {
    throw new EnrichmentProviderError();
  }
  const createdAt = rdapEvent(value.events, ["registration"]);
  return {
    status: "available",
    registrar: registrarFromEntities(value.entities),
    createdAt,
    updatedAt: rdapEvent(value.events, ["last changed", "last update of rdap database"]),
    expiresAt: rdapEvent(value.events, ["expiration"]),
    approximateAgeDays: calculateApproximateAgeDays(createdAt, now),
    domainStatuses: Array.isArray(value.status)
      ? Array.from(new Set(value.status.map((item) => cleanText(item, 160) as string))).sort().slice(0, 20)
      : [],
  };
}

export function discoverDomainRdapEndpoint(payload: unknown, hostname: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new EnrichmentProviderError();
  }
  const services = (payload as { services?: unknown }).services;
  if (!Array.isArray(services) || services.length > 2_000) throw new EnrichmentProviderError();
  const tld = hostname.toLowerCase().split(".").at(-1);
  if (!tld) throw new EnrichmentProviderError();
  for (const service of services) {
    if (!Array.isArray(service) || service.length !== 2 ||
        !Array.isArray(service[0]) || !Array.isArray(service[1]) ||
        service[0].length > 100 || service[1].length > 20 ||
        !service[0].every((item) => typeof item === "string") ||
        !service[1].every((item) => typeof item === "string")) {
      throw new EnrichmentProviderError();
    }
    if (!service[0].map((item) => item.toLowerCase()).includes(tld)) continue;
    for (const candidate of service[1]) {
      const endpoint = new URL(candidate);
      if (endpoint.protocol === "https:" && !endpoint.username && !endpoint.password &&
          endpoint.hostname !== "localhost" && !isIpv4(endpoint.hostname) && !isIpv6(endpoint.hostname)) {
        return new URL(`domain/${encodeURIComponent(hostname)}`, endpoint.href.endsWith("/") ? endpoint : `${endpoint.href}/`).href;
      }
    }
    throw new EnrichmentProviderError();
  }
  throw new EnrichmentProviderError();
}

export async function queryRegistration(
  hostname: string,
  fetcher?: typeof fetch,
  now = new Date(),
): Promise<RegistrationEnrichment> {
  const bootstrap = await fetchJsonLimited(
    IANA_DNS_RDAP_BOOTSTRAP,
    fetcher,
    3_000,
    256 * 1024,
    "application/json",
    ["application/json"],
  );
  const endpoint = discoverDomainRdapEndpoint(bootstrap, hostname);
  const payload = await fetchJsonLimited(
    endpoint,
    fetcher,
    4_000,
    384 * 1024,
    "application/rdap+json, application/json",
    ["application/rdap+json", "application/json"],
  );
  return parseDomainRdap(payload, now);
}

export function parseRipePrefix(payload: unknown): { asn: number | null; organization: string | null } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new EnrichmentProviderError();
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new EnrichmentProviderError();
  const record = data as { asns?: unknown };
  if (!Array.isArray(record.asns) || record.asns.length > 16) {
    throw new EnrichmentProviderError();
  }
  const networks = record.asns.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new EnrichmentProviderError();
    }
    const network = candidate as { asn?: unknown; holder?: unknown };
    if (!Number.isInteger(network.asn) || Number(network.asn) <= 0) {
      throw new EnrichmentProviderError();
    }
    return { asn: Number(network.asn), holder: cleanText(network.holder, 200) };
  }).sort((left, right) => left.asn - right.asn);
  return {
    asn: networks[0]?.asn ?? null,
    organization: networks[0]?.holder ?? null,
  };
}

export function parseIpRdap(payload: unknown): { organization: string | null; registrationCountry: string | null } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new EnrichmentProviderError();
  const value = payload as { objectClassName?: unknown; name?: unknown; country?: unknown };
  if (value.objectClassName !== "ip network") throw new EnrichmentProviderError();
  const country = value.country === undefined || value.country === null
    ? null
    : cleanText(value.country, 2)?.toUpperCase() ?? null;
  if (country !== null && !/^[A-Z]{2}$/u.test(country)) throw new EnrichmentProviderError();
  return { organization: cleanText(value.name, 200), registrationCountry: country };
}

function isPublicAddress(address: string): boolean {
  try {
    parseSubmittedUrl(`http://${isIpv6(address) ? `[${address}]` : address}/`);
    return isIpv4(address) || isIpv6(address);
  } catch {
    return false;
  }
}

export async function queryNetwork(address: string, fetcher?: typeof fetch): Promise<NetworkEnrichment> {
  if (!isPublicAddress(address)) throw new EnrichmentProviderError();
  const ripeUrl = new URL(RIPESTAT_ENDPOINT);
  ripeUrl.searchParams.set("resource", address);
  const settled = await Promise.allSettled([
    fetchJsonLimited(
      ripeUrl.href, fetcher, 4_000, 128 * 1024, "application/json", ["application/json"],
    ),
    fetchJsonLimited(
      `${RDAP_ENDPOINT}/ip/${encodeURIComponent(address)}`, fetcher, 5_000, 384 * 1024,
      "application/rdap+json, application/json", ["application/rdap+json", "application/json"],
      (target) => target.protocol === "https:" && !target.username && !target.password &&
        target.hostname !== "localhost" && !isIpv4(target.hostname) && !isIpv6(target.hostname),
    ),
  ]);
  if (settled.every((result) => result.status === "rejected")) throw new EnrichmentProviderError();
  const ripe = settled[0].status === "fulfilled" ? parseRipePrefix(settled[0].value) : { asn: null, organization: null };
  const rdap = settled[1].status === "fulfilled" ? parseIpRdap(settled[1].value) : { organization: null, registrationCountry: null };
  return {
    status: "available",
    asn: ripe.asn,
    organization: ripe.organization ?? rdap.organization,
    registrationCountry: rdap.registrationCountry,
  };
}

export function sanitizeCertificateName(value: unknown, hostname: string): string | null {
  const cleaned = cleanText(value, 253)?.replace(/^\*\./u, "").replace(/\.$/u, "").toLowerCase() ?? null;
  if (!cleaned || !DNS_NAME.test(cleaned)) return null;
  return cleaned === hostname || cleaned.endsWith(`.${hostname}`) ? cleaned : null;
}

export function parseCertificateTransparency(
  payload: unknown,
  hostname: string,
  nameLimit = 20,
): CertificateTransparencyEnrichment {
  if (!Array.isArray(payload)) throw new EnrichmentProviderError();
  if (payload.length > 5_000) throw new EnrichmentProviderError();
  const observed: number[] = [];
  const names = new Set<string>();
  for (const candidate of payload) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new EnrichmentProviderError();
    const record = candidate as { entry_timestamp?: unknown; name_value?: unknown; common_name?: unknown };
    const timestamp = parseRdapDate(record.entry_timestamp);
    if (!timestamp || typeof record.name_value !== "string") throw new EnrichmentProviderError();
    observed.push(Date.parse(timestamp));
    for (const rawName of `${record.name_value}\n${typeof record.common_name === "string" ? record.common_name : ""}`.split(/\r?\n/u)) {
      const name = sanitizeCertificateName(rawName, hostname);
      if (name) names.add(name);
    }
  }
  return {
    status: "available",
    certificateCount: payload.length,
    earliestObservedAt: observed.length ? new Date(Math.min(...observed)).toISOString() : null,
    latestObservedAt: observed.length ? new Date(Math.max(...observed)).toISOString() : null,
    names: Array.from(names).sort().slice(0, nameLimit),
  };
}

export async function queryCertificateTransparency(
  hostname: string,
  fetcher?: typeof fetch,
): Promise<CertificateTransparencyEnrichment> {
  const url = new URL(CT_ENDPOINT);
  url.searchParams.set("q", hostname);
  url.searchParams.set("output", "json");
  const payload = await fetchJsonLimited(
    url.href, fetcher, 5_000, 1024 * 1024, "application/json", ["application/json"],
  );
  return parseCertificateTransparency(payload, hostname);
}

export function unavailableEnrichment(): EnrichmentResult {
  return {
    schemaVersion: "1.0",
    status: "unavailable",
    dns: { status: "unavailable", a: [], aaaa: [], mx: [], ns: [], cname: null },
    registration: {
      status: "unavailable", registrar: null, createdAt: null, updatedAt: null,
      expiresAt: null, approximateAgeDays: null, domainStatuses: [],
    },
    network: {
      status: "unavailable", asn: null, organization: null, registrationCountry: null,
    },
    certificateTransparency: {
      status: "unavailable", certificateCount: null, earliestObservedAt: null,
      latestObservedAt: null, names: [],
    },
  };
}

export async function enrichHostname(
  hostname: string,
  fetcher?: typeof fetch,
  now = new Date(),
): Promise<EnrichmentResult> {
  const dnsPromise = queryDns(hostname, fetcher);
  const registrationPromise = (isIpv4(hostname) || isIpv6(hostname))
    ? Promise.reject(new EnrichmentProviderError())
    : queryRegistration(hostname, fetcher, now);
  const ctPromise = (isIpv4(hostname) || isIpv6(hostname))
    ? Promise.reject(new EnrichmentProviderError())
    : queryCertificateTransparency(hostname, fetcher);
  const networkPromise = dnsPromise.then((dns) => {
    const address = isIpv4(hostname) || isIpv6(hostname) ? hostname : (dns.a[0] ?? dns.aaaa[0]);
    if (!address) throw new EnrichmentProviderError();
    return queryNetwork(address, fetcher);
  });
  const settled = await Promise.allSettled([
    dnsPromise, registrationPromise, networkPromise, ctPromise,
  ]);
  const fallback = unavailableEnrichment();
  const components = {
    dns: settled[0].status === "fulfilled" ? settled[0].value : fallback.dns,
    registration: settled[1].status === "fulfilled" ? settled[1].value : fallback.registration,
    network: settled[2].status === "fulfilled" ? settled[2].value : fallback.network,
    certificateTransparency: settled[3].status === "fulfilled" ? settled[3].value : fallback.certificateTransparency,
  };
  const availableCount = Object.values(components).filter((component) => component.status === "available").length;
  return {
    schemaVersion: "1.0",
    status: availableCount === 4 ? "available" : availableCount === 0 ? "unavailable" : "partial",
    ...components,
  };
}
