// The test copy's secret keys live in the private repo ngtongsheng/gq-dev-private (crm/.env.dev), never in this
// public repo. This fetches them for catch-up and merges them into .env.local. Prints and throws no key value.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  DEV_PROJECT_REF,
  PROD_PROJECT_REF,
} from "../../src/lib/supabase/test-copy.ts";
import { mergeEnv } from "../test-copy/env-local.ts";

export const DEV_KEYS_REPO = "ngtongsheng/gq-dev-private";
export const DEV_KEYS_PATH = "crm/.env.dev";
export const DEV_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_DEV_DB_URL",
];

/**
 * Reads NAME=value lines (comments and blank lines skipped, surrounding quotes removed).
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvText(text) {
  /** @type {Record<string, string>} */
  const entries = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    entries[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return entries;
}

/** The project ref a legacy JWT key was issued for, or null (new sb_secret_ keys carry none). */
function refInJwtKey(key) {
  const payload = key.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof claims.ref === "string" ? claims.ref : null;
  } catch {
    return null;
  }
}

/**
 * Throws unless both keys are present and point at the test copy. Messages name the variable, never the value.
 * @param {Record<string, string>} keys
 * @returns {Record<string, string>} only the two dev keys
 */
export function assertDevKeys(keys) {
  for (const name of DEV_KEY_NAMES) {
    if (!keys[name]) throw new Error(`${name} is missing.`);
  }
  const dbUrl = keys.SUPABASE_DEV_DB_URL;
  const secretKey = keys.SUPABASE_SERVICE_ROLE_KEY;
  if (
    dbUrl.includes(PROD_PROJECT_REF) ||
    secretKey.includes(PROD_PROJECT_REF)
  ) {
    throw new Error(
      "Refusing: a key points at the live app, not the test copy.",
    );
  }
  if (!dbUrl.includes(DEV_PROJECT_REF)) {
    throw new Error("Refusing: SUPABASE_DEV_DB_URL is not the test copy's.");
  }
  const keyRef = refInJwtKey(secretKey);
  if (keyRef !== null && keyRef !== DEV_PROJECT_REF) {
    throw new Error(
      "Refusing: SUPABASE_SERVICE_ROLE_KEY is not the test copy's.",
    );
  }
  return {
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
    SUPABASE_DEV_DB_URL: dbUrl,
  };
}

/**
 * Downloads and checks the test copy keys from the private repo. Needs `gh` signed in with read access.
 * @returns {Record<string, string>}
 */
export function fetchDevKeys() {
  let encoded;
  try {
    encoded = execFileSync(
      "gh",
      [
        "api",
        `repos/${DEV_KEYS_REPO}/contents/${DEV_KEYS_PATH}`,
        "--jq",
        ".content",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    throw new Error(
      `Could not read ${DEV_KEYS_PATH} from ${DEV_KEYS_REPO}. Check that gh is signed in and the invite is accepted.`,
    );
  }
  return assertDevKeys(parseEnvText(Buffer.from(encoded, "base64").toString()));
}

/**
 * Sets the dev keys in the env file, keeping every other line, and limits the file to its owner.
 * @param {string} path
 * @param {Record<string, string>} keys
 */
export function mergeEnvLocal(path, keys) {
  const checked = assertDevKeys(keys);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeFileSync(path, mergeEnv(existing, checked), { mode: 0o600 });
  chmodSync(path, 0o600);
}
