/** Why the callback turned someone away; the sign-in page shows the matching message. */
export type SignInRefusal = "domain" | "not-added" | "left" | "failed";

export const SIGN_IN_REFUSAL_MESSAGE: Record<SignInRefusal, string> = {
  domain: "Sign in with your company Google account.",
  "not-added": "You haven't been added yet. Ask your admin to add you.",
  left: "You no longer have access. Ask your admin if this is a mistake.",
  failed: "Could not sign in. Try again in a moment.",
};

export function isSignInRefusal(value: unknown): value is SignInRefusal {
  return (
    typeof value === "string" && Object.hasOwn(SIGN_IN_REFUSAL_MESSAGE, value)
  );
}

/** `ALLOWED_EMAIL_DOMAINS` is a comma-separated list, e.g. `gqprojects.com.my,example.invalid`. */
export function parseAllowedDomains(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Who may stay signed in after Google: an email on an allowed domain whose person is in People
 * and still works here. No allowed domains configured refuses everyone.
 */
export function decideSignIn({
  email,
  allowedDomains,
  profile,
}: {
  email: string | undefined;
  allowedDomains: string[];
  profile: { active: boolean } | null;
}): SignInRefusal | null {
  const domain = email?.toLowerCase().split("@").at(-1);
  if (!domain || !email?.includes("@") || !allowedDomains.includes(domain)) {
    return "domain";
  }
  if (!profile) return "not-added";
  if (!profile.active) return "left";
  return null;
}
