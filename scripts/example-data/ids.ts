import { createHash } from "node:crypto";

/**
 * A fixed id per example row, so a re-run replaces exactly the rows an earlier run made and
 * nothing the team added by hand. Shaped like a UUID (version 5 style) so uuid columns accept it.
 */
export function exampleId(table: string, key: string): string {
  const hex = createHash("sha1")
    .update(`gq-example-data:${table}:${key}`)
    .digest("hex");
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
