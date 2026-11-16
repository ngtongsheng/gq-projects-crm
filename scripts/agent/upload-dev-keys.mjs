// Owner runs this once: node scripts/agent/upload-dev-keys.mjs
// Reads the test copy keys from .env.local, checks they are the test copy's, and saves them to
// crm/.env.dev in the private repo ngtongsheng/gq-dev-private. Prints "Uploaded" or a plain error, never a value.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  assertDevKeys,
  DEV_KEYS_PATH,
  DEV_KEYS_REPO,
  parseEnvText,
} from "./dev-keys.mjs";

const ENV_FILE = ".env.local";
const endpoint = `repos/${DEV_KEYS_REPO}/contents/${DEV_KEYS_PATH}`;

/** The file's sha when it already exists (GitHub needs it to overwrite), else null. */
function existingSha() {
  try {
    const sha = execFileSync("gh", ["api", endpoint, "--jq", ".sha"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

try {
  const keys = assertDevKeys(parseEnvText(readFileSync(ENV_FILE, "utf8")));
  const text = `${Object.entries(keys)
    .map(([name, value]) => `${name}=${value}`)
    .join("\n")}\n`;
  const sha = existingSha();
  const body = {
    message: "chore(crm): update dev keys",
    content: Buffer.from(text).toString("base64"),
    ...(sha ? { sha } : {}),
  };
  // The body goes on stdin so the keys never appear in a command line.
  execFileSync("gh", ["api", "-X", "PUT", endpoint, "--input", "-"], {
    input: JSON.stringify(body),
    stdio: ["pipe", "ignore", "ignore"],
  });
  console.log("Uploaded");
} catch (error) {
  const known =
    error instanceof Error && /^(Refusing|SUPABASE_)/.test(error.message);
  console.error(
    known
      ? error.message
      : `Could not upload. Check that ${ENV_FILE} exists here and gh is signed in as the repo owner.`,
  );
  process.exitCode = 1;
}
