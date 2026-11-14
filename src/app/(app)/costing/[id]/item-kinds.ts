import type { z } from "zod";
import type { ItemCategory, ItemType, ItemUnit } from "../quote-view";

type Category = z.infer<typeof ItemCategory>;
type Type = z.infer<typeof ItemType>;
type Unit = z.infer<typeof ItemUnit>;

// The demo's names (CATS, SOURCES, UL).
export const CATEGORY_LABEL: Record<Category, string> = {
  supply: "Supply only",
  si: "Supply & install",
  install: "Install",
  transport: "Transport",
  acc: "Accessory",
  sl: "Self levelling",
  labour: "Labour",
  disc: "Discount",
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export const SOURCE_LABEL = {
  local: "Local",
  import: "China (USD / RMB)",
  rug: "Custom rug (L x W)",
} as const;

export type Source = keyof typeof SOURCE_LABEL;
export const SOURCES = Object.keys(SOURCE_LABEL) as Source[];

export const UNIT_LABEL: Record<Unit, string> = {
  m2: "m²",
  sqft: "sqft",
  pc: "pc",
  m: "m",
  set: "set",
  lot: "lot",
  trip: "trip",
  day: "day",
  ls: "ls",
};

export const UNITS = Object.keys(UNIT_LABEL) as Unit[];

/** The cost formula a category can use; the database checks the same pairs. */
export const CATEGORY_TYPES: Record<Category, readonly Type[]> = {
  supply: ["local", "import", "rug"],
  si: ["local", "import", "rug"],
  install: ["labour"],
  transport: ["lump"],
  acc: ["simple"],
  sl: ["simple"],
  labour: ["simple"],
  disc: ["discount"],
};

export const isSupplyCategory = (category: Category): boolean =>
  category === "supply" || category === "si";

export const typeAllowedIn = (category: Category, type: Type): boolean =>
  CATEGORY_TYPES[category].includes(type);

/** The formula a new line of this category starts with; supply lines start Local. */
export function defaultType(
  category: Category,
  source: Source = "local",
): Type {
  return isSupplyCategory(category) ? source : CATEGORY_TYPES[category][0];
}
