export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  GOOGLE_SAFE_BROWSING_API_KEY: string;
  APP_HASH_SECRET: string;
  URL_CHECK_RATE_LIMITER: RateLimitBinding;
}

export const ALLOWED_ORIGINS = new Set([
  "https://sithbusiness.com",
  "https://www.sithbusiness.com",
]);

export type ThreatType =
  | "MALWARE"
  | "SOCIAL_ENGINEERING"
  | "UNWANTED_SOFTWARE"
  | "POTENTIALLY_HARMFUL_APPLICATION";

export type ResultStatus =
  | "known_threat_detected"
  | "no_known_threat_detected"
  | "unavailable";

export type EnrichmentAvailability = "available" | "partial" | "unavailable";
export type ProviderAvailability = "available" | "unavailable";

export interface DnsEnrichment {
  status: ProviderAvailability;
  a: string[];
  aaaa: string[];
  mx: string[];
  ns: string[];
  cname: string | null;
}

export interface RegistrationEnrichment {
  status: ProviderAvailability;
  registrar: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  approximateAgeDays: number | null;
  domainStatuses: string[];
}

export interface NetworkEnrichment {
  status: ProviderAvailability;
  asn: number | null;
  organization: string | null;
  registrationCountry: string | null;
}

export interface CertificateTransparencyEnrichment {
  status: ProviderAvailability;
  certificateCount: number | null;
  earliestObservedAt: string | null;
  latestObservedAt: string | null;
  names: string[];
}

export interface EnrichmentResult {
  schemaVersion: "1.0";
  status: EnrichmentAvailability;
  dns: DnsEnrichment;
  registration: RegistrationEnrichment;
  network: NetworkEnrichment;
  certificateTransparency: CertificateTransparencyEnrichment;
}

export interface InspectionResponse {
  schema_version: "1.0";
  status: ResultStatus;
  risk_score: number | null;
  threats: ThreatType[];
  url_hash: string;
  provider: "google_safe_browsing";
  checked_at: string;
  enrichment: EnrichmentResult;
}

export interface ErrorResponse {
  schema_version: "1.0";
  status: "invalid_request" | "rate_limited" | "not_found";
  code: string;
  message: string;
}
