import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const supabaseUrl = "https://abcdef.supabase.co";

describe("contentSecurityPolicy", () => {
  it("allows the Supabase origin for data, files and realtime", () => {
    const csp = contentSecurityPolicy({ supabaseUrl, development: false });
    expect(csp).toContain(
      "connect-src 'self' https://abcdef.supabase.co wss://abcdef.supabase.co",
    );
    expect(csp).toContain(
      "img-src 'self' data: blob: https://abcdef.supabase.co",
    );
  });

  it("allows eval only in development", () => {
    expect(contentSecurityPolicy({ supabaseUrl, development: true })).toContain(
      "'unsafe-eval'",
    );
    expect(
      contentSecurityPolicy({ supabaseUrl, development: false }),
    ).not.toContain("'unsafe-eval'");
  });

  it("forbids framing and plugins", () => {
    const csp = contentSecurityPolicy({ supabaseUrl, development: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("still builds a policy when the Supabase URL is missing or invalid", () => {
    for (const bad of [undefined, "not a url"]) {
      const csp = contentSecurityPolicy({
        supabaseUrl: bad,
        development: false,
      });
      expect(csp).toContain("connect-src 'self'; ");
      expect(csp).not.toContain("wss://");
    }
  });
});

describe("securityHeaders", () => {
  it("lists the six headers", () => {
    const keys = securityHeaders({ supabaseUrl, development: false }).map(
      (header) => header.key,
    );
    expect(keys).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "Referrer-Policy",
      "X-Content-Type-Options",
      "Strict-Transport-Security",
      "Permissions-Policy",
    ]);
  });
});
