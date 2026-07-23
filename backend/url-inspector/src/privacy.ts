const encoder = new TextEncoder();

export async function keyedHash(secret: string, value: string): Promise<string> {
  if (!secret) {
    throw new Error("hash configuration unavailable");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  const digest = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `hmac-sha256:${digest}`;
}
