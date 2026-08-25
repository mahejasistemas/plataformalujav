import { createHmac, timingSafeEqual } from "node:crypto";

type TokenPayload = {
  email: string;
  purpose: "email-confirm" | "password-reset";
  iat: number;
  exp: number;
};

const ENC = "utf-8";
const B64URL = "base64url";

function secret(): Buffer {
  const s = process.env.AUTH_TOKEN_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_TOKEN_SECRET no configurado o muy débil (mín. 16 chars). Establécelo en .env.local."
    );
  }
  return Buffer.from(s, ENC);
}

function b64uEncode(buf: Buffer | string): string {
  return Buffer.from(buf as string, typeof buf === "string" ? ENC : undefined).toString(B64URL);
}

function b64uDecode(str: string): string {
  return Buffer.from(str, B64URL).toString(ENC);
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest(B64URL);
}

export function createSignedToken(
  payload: Omit<TokenPayload, "iat" | "exp">,
  ttlMinutes: number = Number(process.env.AUTH_TOKEN_TTL_MINUTES ?? 60)
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlMinutes * 60,
  };
  const body = b64uEncode(JSON.stringify(full));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifySignedToken(
  token: string,
  purpose: TokenPayload["purpose"]
): TokenPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;

    const expected = sign(body);
    const a = Buffer.from(sig, B64URL);
    const b = Buffer.from(expected, B64URL);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(b64uDecode(body)) as TokenPayload;
    if (payload.purpose !== purpose) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildVerificationUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/verify/${encodeURIComponent(token)}`;
}
