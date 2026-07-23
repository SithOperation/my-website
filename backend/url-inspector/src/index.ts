import { keyedHash } from "./privacy";
import { enrichHostname, unavailableEnrichment } from "./enrichment";
import { checkGoogleSafeBrowsing, scoreThreats, type ReputationResult } from "./reputation";
import { ALLOWED_ORIGINS, type EnrichmentResult, type Env, type ErrorResponse, type InspectionResponse } from "./types";
import { parseSubmittedUrl, UrlPolicyError } from "./url-policy";

const MAX_BODY_BYTES = 4 * 1024;
const ENDPOINT = "/api/url-check";

type ReputationChecker = (url: string, apiKey: string) => Promise<ReputationResult>;
type EnrichmentChecker = (hostname: string) => Promise<EnrichmentResult>;

function corsHeaders(origin: string | null, requestId?: string): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  if (requestId) headers.set("X-Request-ID", requestId);
  return headers;
}

function jsonResponse(
  payload: InspectionResponse | ErrorResponse,
  status: number,
  origin: string | null,
  requestId: string,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = corsHeaders(origin, requestId);
  Object.entries(extraHeaders ?? {}).forEach(([name, value]) => headers.set(name, value));
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(
  status: number,
  responseStatus: ErrorResponse["status"],
  code: string,
  message: string,
  origin: string | null,
  requestId: string,
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse(
    { schema_version: "1.0", status: responseStatus, code, message, request_id: requestId },
    status,
    origin,
    requestId,
    extraHeaders,
  );
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    const statedLength = Number(contentLength);
    if (!Number.isFinite(statedLength) || statedLength < 0 || statedLength > MAX_BODY_BYTES) {
      throw new UrlPolicyError("request_too_large", "request body exceeds 4096 bytes");
    }
  }
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) {
    throw new UrlPolicyError("request_too_large", "request body exceeds 4096 bytes");
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new UrlPolicyError("malformed_json", "request body must be valid UTF-8 JSON");
  }
}

function extractUrl(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new UrlPolicyError("invalid_body", "request body must be an object containing only url");
  }
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== "url") {
    throw new UrlPolicyError("invalid_body", "request body must contain exactly one field: url");
  }
  return (payload as { url: unknown }).url;
}

export function createHandler(
  checker: ReputationChecker = checkGoogleSafeBrowsing,
  enricher: EnrichmentChecker = checker === checkGoogleSafeBrowsing
    ? enrichHostname
    : async () => unavailableEnrichment(),
) {
  return async function handle(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("Origin");
    const requestId = crypto.randomUUID();

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return errorResponse(403, "invalid_request", "origin_not_allowed", "request origin is not allowed", null, requestId);
    }
    if (requestUrl.pathname !== ENDPOINT) {
      return errorResponse(404, "not_found", "not_found", "endpoint not found", origin, requestId);
    }
    if (request.method === "OPTIONS") {
      const headers = corsHeaders(origin, requestId);
      headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      headers.set("Access-Control-Max-Age", "86400");
      return new Response(null, {
        status: 204,
        headers,
      });
    }
    if (request.method !== "POST") {
      return errorResponse(
        405,
        "invalid_request",
        "method_not_allowed",
        "only POST and OPTIONS are permitted",
        origin,
        requestId,
        { Allow: "POST, OPTIONS" },
      );
    }
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return errorResponse(415, "invalid_request", "unsupported_media_type", "Content-Type must be application/json", origin, requestId);
    }

    try {
      const clientIdentity = request.headers.get("CF-Connecting-IP") ?? "anonymous";
      const rateKey = await keyedHash(env.APP_HASH_SECRET, `rate:${clientIdentity}`);
      const rateLimit = await env.URL_CHECK_RATE_LIMITER.limit({ key: rateKey });
      if (!rateLimit.success) {
        return errorResponse(
          429,
          "rate_limited",
          "rate_limit_exceeded",
          "request rate limit exceeded",
          origin,
          requestId,
          { "Retry-After": "60" },
        );
      }

      const payload = await readJsonBody(request);
      const parsed = parseSubmittedUrl(extractUrl(payload));
      const urlHash = await keyedHash(env.APP_HASH_SECRET, `url:${parsed.href}`);
      const [reputationSettled, enrichmentSettled] = await Promise.allSettled([
        checker(parsed.href, env.GOOGLE_SAFE_BROWSING_API_KEY),
        enricher(parsed.hostname.replace(/^\[|\]$/gu, "")),
      ]);
      const enrichment = enrichmentSettled.status === "fulfilled"
        ? enrichmentSettled.value
        : unavailableEnrichment();
      console.info("url_inspection_completed", {
        requestId,
        reputation: reputationSettled.status === "fulfilled" ? "available" : "unavailable",
        enrichment: enrichment.status,
        dns: enrichment.dns.status,
        registration: enrichment.registration.status,
        network: enrichment.network.status,
        certificateTransparency: enrichment.certificateTransparency.status,
      });
      if (reputationSettled.status === "rejected") {
        return jsonResponse({
          schema_version: "1.0",
          status: "unavailable",
          risk_score: null,
          threats: [],
          url_hash: urlHash,
          provider: "google_safe_browsing",
          checked_at: new Date().toISOString(),
          request_id: requestId,
          enrichment,
        }, 503, origin, requestId);
      }
      const result = reputationSettled.value;
      const threats = result.threats;
      return jsonResponse({
        schema_version: "1.0",
        status: threats.length ? "known_threat_detected" : "no_known_threat_detected",
        risk_score: scoreThreats(threats),
        threats,
        url_hash: urlHash,
        provider: "google_safe_browsing",
        checked_at: new Date().toISOString(),
        request_id: requestId,
        enrichment,
      }, 200, origin, requestId);
    } catch (error) {
      if (error instanceof UrlPolicyError) {
        const status = error.code === "request_too_large" ? 413 : 400;
        return errorResponse(status, "invalid_request", error.code, error.message, origin, requestId);
      }
      console.warn("url_inspection_failed", { requestId, category: "internal_failure" });
      return jsonResponse({
        schema_version: "1.0",
        status: "unavailable",
        risk_score: null,
        threats: [],
        url_hash: "unavailable",
        provider: "google_safe_browsing",
        checked_at: new Date().toISOString(),
        request_id: requestId,
        enrichment: unavailableEnrichment(),
      }, 503, origin, requestId);
    }
  };
}

const handle = createHandler();

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
} satisfies ExportedHandler<Env>;
