import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * "Sign in as": the MD signs in as another person, and this cookie remembers who they really are
 * so they can switch back. It is signed with the server secret, so nobody can make one up, and it
 * only counts while the signed-in person is the one it names.
 */
export const IMPERSONATION_COOKIE = "gq_impersonation";
export const IMPERSONATION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type Impersonation = {
  /** The MD, who really is behind this session. */
  adminId: string;
  /** The person being signed in as. */
  targetId: string;
  /** The row in impersonation_log for this session. */
  logId: string;
};

const sign = (body: string, secret: string) =>
  createHmac("sha256", secret).update(body).digest("base64url");

export function signImpersonation(
  value: Impersonation,
  secret: string,
  now: number = Date.now(),
): string {
  const body = Buffer.from(
    JSON.stringify({
      ...value,
      exp: now + IMPERSONATION_MAX_AGE_SECONDS * 1000,
    }),
  ).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** The impersonation a cookie value proves, or null when it is missing, forged, altered or expired. */
export function verifyImpersonation(
  token: string | undefined,
  secret: string | undefined,
  now: number = Date.now(),
): Impersonation | null {
  if (!token || !secret) return null;
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    if (typeof parsed !== "object" || parsed === null) return null;
    const { adminId, targetId, logId, exp } = parsed as Record<string, unknown>;
    if (
      typeof adminId !== "string" ||
      typeof targetId !== "string" ||
      typeof logId !== "string" ||
      typeof exp !== "number" ||
      exp < now
    ) {
      return null;
    }
    return { adminId, targetId, logId };
  } catch {
    return null;
  }
}

/** The impersonation this request carries, if its cookie checks out. */
export async function readImpersonation(): Promise<Impersonation | null> {
  const store = await cookies();
  return verifyImpersonation(
    store.get(IMPERSONATION_COOKIE)?.value,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
