/** How a wallpaper is sold: by the full roll, or cut to the running metre. */
export type WallpaperSale = "roll" | "running-metre";

export type WallpaperType = {
  name: string;
  /** Standard roll width in metres. */
  width: number;
  /** Standard roll length in metres; a running-metre paper has none. */
  rollLength: number | null;
  sale: WallpaperSale;
};

export const WALLPAPER_TYPES = [
  { name: "European", width: 0.53, rollLength: 10.06, sale: "roll" },
  { name: "Korean", width: 1.06, rollLength: 15.5, sale: "roll" },
  { name: "Fabric Back", width: 1.37, rollLength: null, sale: "running-metre" },
] as const satisfies readonly WallpaperType[];

export type WallpaperTypeName = (typeof WALLPAPER_TYPES)[number]["name"];

export type WallpaperInput = {
  type: WallpaperTypeName;
  /** Wall width in metres. */
  wallWidth: number;
  /** Net wall height in metres. */
  wallHeight: number;
  /** Extra length cut on each panel, in metres. */
  allowance: number;
  /** Product's own roll width in metres; 0 uses the standard. */
  paperWidth: number;
  /** Product's own roll length in metres; 0 uses the standard. */
  rollLength: number;
};

type Shared = {
  /** Roll width used, in metres. */
  width: number;
  /** Height of one panel: wall height plus allowance. */
  cutHeight: number;
  /** Panels (drops) across the wall width. */
  panels: number;
  /** Total length of paper the panels need, in metres. */
  lengthNeeded: number;
};

export type WallpaperResult =
  | (Shared & {
      sale: "roll";
      rollLength: number;
      /** Whole full-height panels one roll gives; 0 when a panel is longer than the roll. */
      panelsPerRoll: number;
      /** Null when a panel does not fit on one roll. */
      rolls: number | null;
      /** Area ordered, in m². */
      area: number;
      /** Paper left over across the rolls, in metres. */
      offcut: number;
    })
  | (Shared & {
      sale: "running-metre";
      metres: number;
      area: number;
    });

// Floating point noise (2.0000000001 drops) must not add a whole extra panel or roll.
const roundUp = (value: number) => Math.ceil(Number(value.toFixed(6)));

/** The product's own size when keyed in, else the standard. Negative or blank counts as unset. */
const orStandard = (keyed: number, standard: number) =>
  keyed > 0 ? keyed : standard;

/**
 * Panels first (wall width / roll width, rounded up), then times the cutting height. Never by wall
 * area alone. Roll papers: each roll only gives whole full-height panels.
 */
export function calculateWallpaper(input: WallpaperInput): WallpaperResult {
  const type =
    WALLPAPER_TYPES.find((candidate) => candidate.name === input.type) ??
    WALLPAPER_TYPES[0];
  const width = orStandard(input.paperWidth, type.width);
  const cutHeight = input.wallHeight + input.allowance;
  const panels = roundUp(input.wallWidth / width);
  const lengthNeeded = panels * cutHeight;
  const shared = { width, cutHeight, panels, lengthNeeded };

  if (type.sale === "running-metre") {
    const metres = roundUp(lengthNeeded);
    return { ...shared, sale: "running-metre", metres, area: metres * width };
  }

  const rollLength = orStandard(input.rollLength, type.rollLength);
  const panelsPerRoll = cutHeight
    ? Math.floor(rollLength / cutHeight + 1e-9)
    : 0;
  const rolls = panelsPerRoll ? roundUp(panels / panelsPerRoll) : null;
  return {
    ...shared,
    sale: "roll",
    rollLength,
    panelsPerRoll,
    rolls,
    area: rolls ? rolls * width * rollLength : 0,
    offcut: rolls ? rolls * rollLength - lengthNeeded : 0,
  };
}
