import type { ThreatType } from "./types";

const SAFE_BROWSING_ENDPOINT = "https://safebrowsing.googleapis.com/v5/urls:search";
const ALLOWED_THREATS = new Set<ThreatType>([
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION",
]);

export class ProviderUnavailableError extends Error {
  constructor(reason:
    | "provider request failed"
    | "provider returned an error"
    | "unexpected provider content type"
    | "invalid provider response" = "provider request failed") {
    super(reason);
    this.name = "ProviderUnavailableError";
  }
}

export interface ReputationResult {
  threats: ThreatType[];
  cacheDurationSeconds: number | null;
}

interface GoogleThreat {
  url?: unknown;
  threatTypes?: unknown;
}

function validateMatchedUrl(value: unknown): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048 ||
      /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new ProviderUnavailableError("invalid provider response");
  }
  try {
    const absolute = /^[a-z][a-z0-9+.-]*:/iu.test(value);
    const parsed = new URL(absolute ? value : `https://${value}`);
    if (!["http:", "https:"].includes(parsed.protocol) ||
        parsed.username || parsed.password ||
        (!absolute && !parsed.hostname.includes(".") && !parsed.hostname.includes(":"))) {
      throw new ProviderUnavailableError("invalid provider response");
    }
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw error;
    throw new ProviderUnavailableError("invalid provider response");
  }
}

const PROTOBUF_THREAT_TYPES = new Map<number, ThreatType>([
  [1, "MALWARE"],
  [2, "SOCIAL_ENGINEERING"],
  [3, "UNWANTED_SOFTWARE"],
  [4, "POTENTIALLY_HARMFUL_APPLICATION"],
]);

class ProtobufReader {
  private offset = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.offset === this.bytes.length;
  }

  readVarint(): number {
    let value = 0;
    let multiplier = 1;
    for (let index = 0; index < 10; index += 1) {
      const byte = this.bytes[this.offset];
      if (byte === undefined) throw new ProviderUnavailableError("invalid provider response");
      this.offset += 1;
      value += (byte & 0x7f) * multiplier;
      if ((byte & 0x80) === 0) {
        if (!Number.isSafeInteger(value)) throw new ProviderUnavailableError("invalid provider response");
        return value;
      }
      multiplier *= 128;
    }
    throw new ProviderUnavailableError("invalid provider response");
  }

  readBytes(): Uint8Array {
    const length = this.readVarint();
    const end = this.offset + length;
    if (!Number.isSafeInteger(length) || end > this.bytes.length) {
      throw new ProviderUnavailableError("invalid provider response");
    }
    const value = this.bytes.subarray(this.offset, end);
    this.offset = end;
    return value;
  }

  skip(wireType: number): void {
    if (wireType === 0) {
      this.readVarint();
      return;
    }
    if (wireType === 1) {
      this.skipFixed(8);
      return;
    }
    if (wireType === 2) {
      this.readBytes();
      return;
    }
    if (wireType === 5) {
      this.skipFixed(4);
      return;
    }
    throw new ProviderUnavailableError("invalid provider response");
  }

  private skipFixed(length: number): void {
    if (this.offset + length > this.bytes.length) {
      throw new ProviderUnavailableError("invalid provider response");
    }
    this.offset += length;
  }
}

function readTag(reader: ProtobufReader): { field: number; wireType: number } {
  const tag = reader.readVarint();
  const field = Math.floor(tag / 8);
  const wireType = tag & 7;
  if (field <= 0) throw new ProviderUnavailableError("invalid provider response");
  return { field, wireType };
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ProviderUnavailableError("invalid provider response");
  }
}

function parseProtobufDuration(bytes: Uint8Array): number {
  const reader = new ProtobufReader(bytes);
  let seconds = 0;
  let nanos = 0;
  while (!reader.done) {
    const { field, wireType } = readTag(reader);
    if (field === 1 && wireType === 0) seconds = reader.readVarint();
    else if (field === 2 && wireType === 0) nanos = reader.readVarint();
    else reader.skip(wireType);
  }
  if (!Number.isSafeInteger(seconds) || seconds < 0 ||
      !Number.isInteger(nanos) || nanos < 0 || nanos > 999_999_999) {
    throw new ProviderUnavailableError("invalid provider response");
  }
  return seconds + (nanos / 1_000_000_000);
}

function parseProtobufThreat(bytes: Uint8Array): { url: string; threatTypes: ThreatType[] } {
  const reader = new ProtobufReader(bytes);
  let url: string | null = null;
  const threatTypes: ThreatType[] = [];
  while (!reader.done) {
    const { field, wireType } = readTag(reader);
    if (field === 1 && wireType === 2) {
      url = decodeUtf8(reader.readBytes());
    } else if (field === 2 && wireType === 0) {
      const encodedThreatType = reader.readVarint();
      const threatType = PROTOBUF_THREAT_TYPES.get(encodedThreatType);
      if (!threatType) throw new ProviderUnavailableError("invalid provider response");
      threatTypes.push(threatType);
    } else if (field === 2 && wireType === 2) {
      const packed = new ProtobufReader(reader.readBytes());
      while (!packed.done) {
        const encodedThreatType = packed.readVarint();
        const threatType = PROTOBUF_THREAT_TYPES.get(encodedThreatType);
        if (!threatType) throw new ProviderUnavailableError("invalid provider response");
        threatTypes.push(threatType);
      }
    } else {
      reader.skip(wireType);
    }
  }
  if (!url || threatTypes.length === 0) {
    throw new ProviderUnavailableError("invalid provider response");
  }
  validateMatchedUrl(url);
  return { url, threatTypes };
}

export function parseGoogleSafeBrowsingProtobuf(bytes: Uint8Array): ReputationResult {
  const reader = new ProtobufReader(bytes);
  const threats: Array<{ url: string; threatTypes: ThreatType[] }> = [];
  let cacheDurationSeconds: number | null = null;
  while (!reader.done) {
    const { field, wireType } = readTag(reader);
    if (field === 1 && wireType === 2) {
      threats.push(parseProtobufThreat(reader.readBytes()));
    } else if (field === 2 && wireType === 2) {
      cacheDurationSeconds = parseProtobufDuration(reader.readBytes());
    } else {
      reader.skip(wireType);
    }
  }
  const parsed = parseGoogleSafeBrowsingResponse({ threats });
  return { threats: parsed.threats, cacheDurationSeconds };
}

export function parseCacheDuration(value: unknown): number | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,9})?s$/u.test(value)) {
    throw new ProviderUnavailableError();
  }
  const seconds = Number(value.slice(0, -1));
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new ProviderUnavailableError();
  }
  return seconds;
}

export function parseGoogleSafeBrowsingResponse(payload: unknown): ReputationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ProviderUnavailableError();
  }
  const response = payload as { threats?: unknown; cacheDuration?: unknown };
  const cacheDurationSeconds = parseCacheDuration(response.cacheDuration);
  if (response.threats === undefined) {
    return { threats: [], cacheDurationSeconds };
  }
  if (!Array.isArray(response.threats)) {
    throw new ProviderUnavailableError();
  }

  const threatTypes: ThreatType[] = [];
  for (const candidate of response.threats) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new ProviderUnavailableError();
    }
    const threat = candidate as GoogleThreat;
    validateMatchedUrl(threat.url);
    if (!Array.isArray(threat.threatTypes) || threat.threatTypes.length === 0) {
      throw new ProviderUnavailableError();
    }
    for (const threatType of threat.threatTypes) {
      if (typeof threatType !== "string" || !ALLOWED_THREATS.has(threatType as ThreatType)) {
        throw new ProviderUnavailableError();
      }
      threatTypes.push(threatType as ThreatType);
    }
  }

  return {
    threats: Array.from(new Set(threatTypes)).sort(),
    cacheDurationSeconds,
  };
}

export async function checkGoogleSafeBrowsing(
  url: string,
  apiKey: string,
  fetcher?: typeof fetch,
  timeoutMs = 4_000,
): Promise<ReputationResult> {
  if (!apiKey) throw new ProviderUnavailableError();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const requestUrl = new URL(SAFE_BROWSING_ENDPOINT);
    requestUrl.searchParams.append("urls", url);
    requestUrl.searchParams.set("key", apiKey);
    const requestInit: RequestInit = {
      method: "GET",
      headers: { Accept: "application/x-protobuf" },
      redirect: "manual",
    };
    const providerRequest = fetcher
      ? fetcher(requestUrl.href, requestInit)
      : globalThis.fetch(requestUrl.href, requestInit);
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new ProviderUnavailableError("provider request failed")),
        timeoutMs,
      );
    });
    const response = await Promise.race([providerRequest, timeoutPromise]);
    if (!response.ok) {
      console.warn("safe_browsing_provider_error", {
        status: response.status,
        contentType: response.headers.get("Content-Type"),
      });
      throw new ProviderUnavailableError("provider returned an error");
    }
    const contentType = response.headers.get("Content-Type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (contentType === "application/x-protobuf" || contentType === "application/octet-stream") {
      return parseGoogleSafeBrowsingProtobuf(new Uint8Array(await response.arrayBuffer()));
    }
    if (contentType !== "application/json") {
      console.warn("safe_browsing_unexpected_content_type", { contentType: contentType ?? "missing" });
      throw new ProviderUnavailableError("unexpected provider content type");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(await response.text()) as unknown;
    } catch {
      console.warn("safe_browsing_invalid_json");
      throw new ProviderUnavailableError("invalid provider response");
    }
    return parseGoogleSafeBrowsingResponse(payload);
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const category = [
      "fetch api cannot load",
      "network connection lost",
      "different request",
      "redirect",
      "abort",
      "invalid",
    ].find((candidate) => message.includes(candidate)) ?? "unclassified";
    console.warn("safe_browsing_request_failed", {
      errorType: error instanceof Error ? error.name : typeof error,
      category,
    });
    throw new ProviderUnavailableError("provider request failed");
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export function scoreThreats(threats: ThreatType[]): number {
  const weights: Record<ThreatType, number> = {
    MALWARE: 100,
    SOCIAL_ENGINEERING: 95,
    POTENTIALLY_HARMFUL_APPLICATION: 85,
    UNWANTED_SOFTWARE: 80,
  };
  return threats.reduce((score, threat) => Math.max(score, weights[threat]), 0);
}
