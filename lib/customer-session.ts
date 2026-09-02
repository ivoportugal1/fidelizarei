import { createHmac, timingSafeEqual } from "node:crypto";

type CustomerSession = { customerId: string; expiresAt: number };

function getSecret() {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (!secret) throw new Error("CUSTOMER_SESSION_SECRET is not configured.");
  return secret;
}

export function createCustomerSession(customerId: string) {
  const payload: CustomerSession = { customerId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 180 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function readCustomerSession(token?: string): CustomerSession | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CustomerSession;
    return payload.expiresAt > Date.now() && payload.customerId ? payload : null;
  } catch { return null; }
}
