import type { ThreatType } from "./types";

const SAFE_BROWSING_ENDPOINT = "https://safebrowsing.googleapis.com/v5/urls:search";
const ALLOWED_THREATS = new Set<ThreatType>([
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION",
]);

export class ProviderUnavailableError extends Error {
  constructor() {
    super("reputation provider unavailable");
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
    if (typeof threat.url !== "string" || threat.url.length === 0) {
      throw new ProviderUnavailableError();
    }
    try {
      const matchedUrl = new URL(threat.url);
      if (!["http:", "https:"].includes(matchedUrl.protocol)) {
        throw new ProviderUnavailableError();
      }
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      throw new ProviderUnavailableError();
    }
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
  fetcher: typeof fetch = fetch,
  timeoutMs = 4_000,
): Promise<ReputationResult> {
  if (!apiKey) throw new ProviderUnavailableError();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestUrl = new URL(SAFE_BROWSING_ENDPOINT);
    requestUrl.searchParams.append("urls", url);
    requestUrl.searchParams.set("key", apiKey);
    const response = await fetcher(requestUrl.href, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new ProviderUnavailableError();
    const payload: unknown = await response.json();
    return parseGoogleSafeBrowsingResponse(payload);
  } catch (error) {
    if (error instanceof ProviderUnavailableError) throw error;
    throw new ProviderUnavailableError();
  } finally {
    clearTimeout(timeout);
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
