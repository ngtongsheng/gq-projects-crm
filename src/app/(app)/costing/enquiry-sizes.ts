import { roundQuantity } from "@/lib/format/quantity";

export type SizeLine = { length: number; width: number; pieces: number };

// Purchasing pastes the supplier's size list as "1.83x1.5 x 799", one per line (demo parseSizes).
const SIZE_LINE =
  /([\d.]+)\s*m?\s*[x×*]\s*([\d.]+)\s*m?\s*(?:[x×*@=]|\s)\s*([\d,]+)\s*(?:pcs?|nos?)?/i;

/** The lines of a "length x width x pieces" list; lines that do not read that way are skipped. */
export function parseSizes(text: string): SizeLine[] {
  return (
    text
      .replace(/，/g, ",")
      // A comma inside a number (1,788) is a thousands mark; one followed by a space starts a new line.
      .split(/\n|;|,\s+(?=\d)/)
      .flatMap((line) => {
        const match = SIZE_LINE.exec(line);
        if (!match) return [];
        const length = Number(match[1]);
        const width = Number(match[2]);
        const pieces = Number(match[3].replace(/,/g, ""));
        return length > 0 && width > 0 && pieces > 0
          ? [{ length, width, pieces }]
          : [];
      })
  );
}

/** Total pieces and area of a size list, or null when no line reads. */
export function sizesTotal(
  text: string,
): { pieces: number; area: number } | null {
  const lines = parseSizes(text);
  if (lines.length === 0) return null;
  return {
    pieces: lines.reduce((sum, line) => sum + line.pieces, 0),
    area: roundQuantity(
      lines.reduce(
        (sum, line) => sum + line.length * line.width * line.pieces,
        0,
      ),
    ),
  };
}
