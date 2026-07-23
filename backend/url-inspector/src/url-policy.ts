export class UrlPolicyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "UrlPolicyError";
  }
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const NUMERIC_HOST = /^(?:0x[0-9a-f]+|\d+)(?:\.(?:0x[0-9a-f]+|\d+))*$/iu;
const STRICT_IPV4 = /^\d+\.\d+\.\d+\.\d+$/u;
const METADATA_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.azure.internal",
]);

function originalHostname(input: string): string {
  const schemeEnd = input.indexOf("://");
  const authorityEnd = input.slice(schemeEnd + 3).search(/[/?#]/u);
  const authority = authorityEnd < 0
    ? input.slice(schemeEnd + 3)
    : input.slice(schemeEnd + 3, schemeEnd + 3 + authorityEnd);
  const hostPort = authority.slice(authority.lastIndexOf("@") + 1);
  if (hostPort.startsWith("[")) {
    const closing = hostPort.indexOf("]");
    return closing < 0 ? hostPort : hostPort.slice(0, closing + 1);
  }
  const colon = hostPort.lastIndexOf(":");
  return colon < 0 ? hostPort : hostPort.slice(0, colon);
}

function parseStrictIpv4(host: string): [number, number, number, number] | null {
  if (!STRICT_IPV4.test(host)) return null;
  const parts = host.split(".");
  const bytes = parts.map(Number);
  if (
    bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255) ||
    parts.some((part, index) => String(bytes[index]) !== part)
  ) {
    return null;
  }
  return bytes as [number, number, number, number];
}

function ipv4Blocked(bytes: number[]): boolean {
  const [a = 0, b = 0, c = 0, d = 0] = bytes;
  const exactMetadata =
    (a === 100 && b === 100 && c === 100 && d === 200) ||
    (a === 168 && b === 63 && c === 129 && d === 16);
  return exactMetadata ||
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224;
}

function ipv6ToBigInt(host: string): bigint | null {
  const value = host.replace(/^\[|\]$/gu, "").toLowerCase();
  if (!value.includes(":")) return null;
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array<string>(missing).fill("0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) return null;
  return groups.reduce((total, group) => (total << 16n) | BigInt(`0x${group}`), 0n);
}

function inIpv6Prefix(value: bigint, prefix: bigint, bits: number): boolean {
  const shift = BigInt(128 - bits);
  return value >> shift === prefix >> shift;
}

function ipv6Blocked(value: bigint): boolean {
  const mappedPrefix = 0xffffn;
  if (value >> 32n === mappedPrefix) {
    const ipv4 = Number(value & 0xffffffffn);
    return ipv4Blocked([
      (ipv4 >>> 24) & 255,
      (ipv4 >>> 16) & 255,
      (ipv4 >>> 8) & 255,
      ipv4 & 255,
    ]);
  }
  const globallyRoutable = inIpv6Prefix(value, 0x20000000000000000000000000000000n, 3);
  const documentation = inIpv6Prefix(value, 0x20010db8000000000000000000000000n, 32);
  const benchmarking = inIpv6Prefix(value, 0x20010002000000000000000000000000n, 48);
  return !globallyRoutable || documentation || benchmarking;
}

export function parseSubmittedUrl(input: unknown): URL {
  if (typeof input !== "string") {
    throw new UrlPolicyError("invalid_url", "url must be a string");
  }
  if (input.length === 0 || input.length > 2048) {
    throw new UrlPolicyError("invalid_url_length", "url must contain between 1 and 2048 characters");
  }
  if (input !== input.trim() || CONTROL_CHARACTERS.test(input)) {
    throw new UrlPolicyError("invalid_url_characters", "url contains prohibited characters");
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new UrlPolicyError("malformed_url", "url is malformed");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlPolicyError("unsupported_scheme", "only http and https URLs are accepted");
  }
  if (parsed.username || parsed.password) {
    throw new UrlPolicyError("embedded_credentials", "embedded URL credentials are prohibited");
  }

  const submittedHost = originalHostname(input).toLowerCase();
  const hostname = parsed.hostname.replace(/^\[|\]$/gu, "").toLowerCase().replace(/\.$/u, "");
  if (!hostname) {
    throw new UrlPolicyError("malformed_url", "url hostname is missing");
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new UrlPolicyError("blocked_hostname", "localhost destinations are prohibited");
  }
  if (METADATA_HOSTS.has(hostname) || hostname.endsWith(".metadata.google.internal")) {
    throw new UrlPolicyError("blocked_hostname", "cloud metadata destinations are prohibited");
  }

  const submittedBareHost = submittedHost.replace(/^\[|\]$/gu, "");
  if (NUMERIC_HOST.test(submittedBareHost) && !STRICT_IPV4.test(submittedBareHost)) {
    throw new UrlPolicyError("ambiguous_ip", "ambiguous numeric IP forms are prohibited");
  }
  if (STRICT_IPV4.test(submittedBareHost) && !parseStrictIpv4(submittedBareHost)) {
    throw new UrlPolicyError("ambiguous_ip", "ambiguous non-canonical IPv4 forms are prohibited");
  }

  const ipv4 = parseStrictIpv4(hostname);
  if (ipv4 && ipv4Blocked(ipv4)) {
    throw new UrlPolicyError("blocked_ip", "non-public IP destinations are prohibited");
  }
  const ipv6 = ipv6ToBigInt(hostname);
  if (ipv6 !== null && ipv6Blocked(ipv6)) {
    throw new UrlPolicyError("blocked_ip", "non-public IP destinations are prohibited");
  }

  parsed.hash = "";
  return parsed;
}
