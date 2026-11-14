import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * "View as": the MD sees the app as another person, through that person's own session, and
 * nothing can be saved while the cookie is there (see src/lib/supabase/view-only-fetch.ts).
 * The cookie remembers who the MD really is so they can switch back. It is signed with the
 * server secret, so nobody can make one up, and its view ends after a working day.
 */
export const IMPERSONATION_COOKIE = "gq_impersonation";
export const IMPERSONATION_MAX_AGE_SECONDS = 8 * 60 * 60;
/**
 * The cookie outlives its signed expiry on purpose: the session it rides on lasts as long as the
 * auth cookies do, so once the view expires the cookie must still be there to keep it read-only
 * until the MD switches back.
 */
export const IMPERSONATION_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export type Impersonation = {
  /** The MD, who really is behind this session. */
  adminId: string;
  /** The MD's name, for "Back to Vicky". */
  adminName: string;
  /** The person being viewed as. */
  targetId: string;
  /** The row in impersonation_log for this view. */
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
    const { adminId, adminName, targetId, logId, exp } = parsed as Record<
      string,
      unknown
    >;
    if (
      typeof adminId !== "string" ||
      typeof adminName !== "string" ||
      typeof targetId !== "string" ||
      typeof logId !== "string" ||
      typeof exp !== "number" ||
      exp < now
    ) {
      return null;
    }
    return { adminId, adminName, targetId, logId };
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

/**
 * Whether this request is a View as, so nothing may be saved. Any cookie counts, even an expired
 * or altered one: the session behind it may still be the other person's, so it fails closed.
 */
export async function isViewingAs(): Promise<boolean> {
  return Boolean((await cookies()).get(IMPERSONATION_COOKIE)?.value);
}
