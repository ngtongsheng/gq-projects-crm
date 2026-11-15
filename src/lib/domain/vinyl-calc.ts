export const SKIRTING_HEIGHTS_MM = [0, 75, 100] as const;
export type SkirtingHeight = (typeof SKIRTING_HEIGHTS_MM)[number];

/** The four walls, named as the demo draws them: top and bottom run along the length. */
export const VINYL_SIDES = ["T", "R", "B", "L"] as const;
export type VinylSide = (typeof VINYL_SIDES)[number];

export type VinylInput = {
  /** Floor length and width in millimetres. */
  length: number;
  width: number;
  /** Skirting height in millimetres, added to both floor dimensions. */
  skirting: number;
  /** Roll width in millimetres; 0 uses 2000. */
  rollWidth: number;
  /** Roll length in metres; 0 uses 20. */
  rollLength: number;
  /** Walls that carry skirting. */
  sides: Partial<Record<VinylSide, boolean>>;
};

/** One way of laying the sheet. */
export type VinylLayout = {
  /** Drops (strips) of vinyl. */
  drops: number;
  /** Length of each drop in metres. */
  dropLength: number;
  /** Order length in running metres. */
  orderLength: number;
  /** Order area in m². */
  orderArea: number;
  weldJoints: number;
  /** Welding rod in metres: one joint line per weld. */
  weldingRod: number;
  /** Fraction of one roll, e.g. 0.4. */
  rolls: number;
};

export type VinylResult = {
  /** Coverage in millimetres, floor plus skirting. */
  coverageLength: number;
  coverageWidth: number;
  /** Drops across the length. */
  layoutA: VinylLayout;
  /** Drops across the width. */
  layoutB: VinylLayout;
  /** Total length of the walls with skirting, in metres: the cove former and the capping strip. */
  skirtingLength: number;
  /** The layout that uses less vinyl; null when equal. */
  lessVinyl: "A" | "B" | null;
  /** The layout that uses less welding rod; null when equal. */
  lessRod: "A" | "B" | null;
};

const DEFAULT_ROLL_WIDTH_MM = 2000;
const DEFAULT_ROLL_LENGTH_M = 20;

const roundUp = (value: number) => Math.ceil(Number(value.toFixed(6)));

// Compare to 6 decimals so 7.949999999 and 7.95 count as equal.
function cheaper(a: number, b: number): "A" | "B" | null {
  const [x, y] = [Number(a.toFixed(6)), Number(b.toFixed(6))];
  return x < y ? "A" : y < x ? "B" : null;
}

/**
 * Drops = coverage / roll width, rounded up. Order length = drops x length per drop. Weld joints =
 * drops - 1. Layout A runs the drops across the length, B across the width.
 */
export function calculateVinyl(input: VinylInput): VinylResult {
  const rollWidth = input.rollWidth || DEFAULT_ROLL_WIDTH_MM;
  const rollLength = input.rollLength || DEFAULT_ROLL_LENGTH_M;
  const coverageLength = input.length + input.skirting;
  const coverageWidth = input.width + input.skirting;

  const layout = (across: number, along: number): VinylLayout => {
    const drops = roundUp(across / rollWidth);
    const dropLength = along / 1000;
    const orderLength = drops * dropLength;
    const weldJoints = Math.max(drops - 1, 0);
    return {
      drops,
      dropLength,
      orderLength,
      orderArea: (orderLength * rollWidth) / 1000,
      weldJoints,
      weldingRod: weldJoints * dropLength,
      rolls: orderLength / rollLength,
    };
  };
  const layoutA = layout(coverageLength, coverageWidth);
  const layoutB = layout(coverageWidth, coverageLength);

  const sideLength: Record<VinylSide, number> = {
    T: input.length,
    R: input.width,
    B: input.length,
    L: input.width,
  };
  const skirtingLength = VINYL_SIDES.reduce(
    (total, side) => total + (input.sides[side] ? sideLength[side] / 1000 : 0),
    0,
  );

  return {
    coverageLength,
    coverageWidth,
    layoutA,
    layoutB,
    skirtingLength,
    lessVinyl: cheaper(layoutA.orderLength, layoutB.orderLength),
    lessRod: cheaper(layoutA.weldingRod, layoutB.weldingRod),
  };
}
