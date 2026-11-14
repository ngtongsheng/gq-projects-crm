import { describe, expect, it } from "vitest";
import { authConfigBody, readAuthConfigEnv } from "./push-auth-config.ts";

const env = {
  SUPABASE_ACCESS_TOKEN: "token",
  SUPABASE_PROJECT_REF: "ref",
  GOOGLE_OAUTH_CLIENT_ID: "client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "client-secret",
  AUTH_SITE_URL: "https://office.example.com",
  AUTH_REDIRECT_URLS:
    " https://office.example.com/**, http://localhost:3000/** ,",
};

describe("push-auth-config", () => {
  it("turns Google on, keeps sign-ups off and sets the URLs", () => {
    expect(authConfigBody(readAuthConfigEnv(env))).toEqual({
      site_url: "https://office.example.com",
      uri_allow_list: "https://office.example.com/**,http://localhost:3000/**",
      disable_signup: true,
      external_google_enabled: true,
      external_google_client_id: "client-id",
      external_google_secret: "client-secret",
    });
  });

  it("names every missing variable before calling Supabase", () => {
    expect(() =>
      readAuthConfigEnv({
        ...env,
        SUPABASE_PROJECT_REF: " ",
        AUTH_SITE_URL: undefined,
      }),
    ).toThrow("Missing env vars: SUPABASE_PROJECT_REF, AUTH_SITE_URL");
  });
});
