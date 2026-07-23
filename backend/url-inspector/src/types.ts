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

export interface InspectionResponse {
  schema_version: "1.0";
  status: ResultStatus;
  risk_score: number | null;
  threats: ThreatType[];
  url_hash: string;
  provider: "google_safe_browsing";
  checked_at: string;
}

export interface ErrorResponse {
  schema_version: "1.0";
  status: "invalid_request" | "rate_limited" | "not_found";
  code: string;
  message: string;
}
