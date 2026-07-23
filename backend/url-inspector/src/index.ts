import { keyedHash } from "./privacy";
import { checkGoogleSafeBrowsing, ProviderUnavailableError, scoreThreats, type ReputationResult } from "./reputation";
import { ALLOWED_ORIGINS, type Env, type ErrorResponse, type InspectionResponse, type ThreatType } from "./types";
import { parseSubmittedUrl, UrlPolicyError } from "./url-policy";

const MAX_BODY_BYTES = 4 * 1024;
const ENDPOINT = "/api/url-check";

type ReputationChecker = (url: string, apiKey: string) => Promise<ReputationResult>;

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function jsonResponse(
  payload: InspectionResponse | ErrorResponse,
  status: number,
  origin: string | null,
  extraHeaders?: Record<string, string>,
): Response {
  const headers = corsHeaders(origin);
  Object.entries(extraHeaders ?? {}).forEach(([name, value]) => headers.set(name, value));
  return new Response(JSON.stringify(payload), { status, headers });
}

function errorResponse(
  status: number,
  responseStatus: ErrorResponse["status"],
  code: string,
  message: string,
  origin: string | null,
  extraHeaders?: Record<string, string>,
): Response {
  return jsonResponse(
    { schema_version: "1.0", status: responseStatus, code, message },
    status,
    origin,
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

export function createHandler(checker: ReputationChecker = checkGoogleSafeBrowsing) {
  return async function handle(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return errorResponse(403, "invalid_request", "origin_not_allowed", "request origin is not allowed", null);
    }
    if (requestUrl.pathname !== ENDPOINT) {
      return errorResponse(404, "not_found", "not_found", "endpoint not found", origin);
    }
    if (request.method === "OPTIONS") {
      const headers = corsHeaders(origin);
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
        { Allow: "POST, OPTIONS" },
      );
    }
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return errorResponse(415, "invalid_request", "unsupported_media_type", "Content-Type must be application/json", origin);
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
          { "Retry-After": "60" },
        );
      }

      const payload = await readJsonBody(request);
      const parsed = parseSubmittedUrl(extractUrl(payload));
      const urlHash = await keyedHash(env.APP_HASH_SECRET, `url:${parsed.href}`);
      let result: ReputationResult;
      try {
        result = await checker(parsed.href, env.GOOGLE_SAFE_BROWSING_API_KEY);
      } catch (error) {
        if (!(error instanceof ProviderUnavailableError)) {
          // Collapse all provider-layer failures into the same public state.
        }
        return jsonResponse({
          schema_version: "1.0",
          status: "unavailable",
          risk_score: null,
          threats: [],
          url_hash: urlHash,
          provider: "google_safe_browsing",
          checked_at: new Date().toISOString(),
        }, 503, origin);
      }
      const threats = result.threats;
      return jsonResponse({
        schema_version: "1.0",
        status: threats.length ? "known_threat_detected" : "no_known_threat_detected",
        risk_score: scoreThreats(threats),
        threats,
        url_hash: urlHash,
        provider: "google_safe_browsing",
        checked_at: new Date().toISOString(),
      }, 200, origin);
    } catch (error) {
      if (error instanceof UrlPolicyError) {
        const status = error.code === "request_too_large" ? 413 : 400;
        return errorResponse(status, "invalid_request", error.code, error.message, origin);
      }
      return jsonResponse({
        schema_version: "1.0",
        status: "unavailable",
        risk_score: null,
        threats: [],
        url_hash: "unavailable",
        provider: "google_safe_browsing",
        checked_at: new Date().toISOString(),
      }, 503, origin);
    }
  };
}

const handle = createHandler();

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
} satisfies ExportedHandler<Env>;
