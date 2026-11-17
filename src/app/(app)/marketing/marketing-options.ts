// The database stores the keys; the page shows the demo's words (MK_PAY and the currency list).
export const CURRENCIES = ["RM", "USD", "RMB", "EUR", "SGD", "other"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABEL: Record<Currency, string> = {
  RM: "RM",
  USD: "USD",
  RMB: "RMB",
  EUR: "EUR",
  SGD: "SGD",
  other: "Others",
};

export const PAYMENT_METHODS = [
  "bank_transfer",
  "company_card",
  "cash",
  "prepaid",
  "petty_cash",
  "others",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  company_card: "Company card",
  cash: "Cash",
  prepaid: "Prepaid / deposit",
  petty_cash: "Petty cash",
  others: "Others",
};

export const VENDOR_KINDS = ["company", "part_timer"] as const;
export type VendorKind = (typeof VENDOR_KINDS)[number];

// What a company supplies (demo MK_VTYPE).
export const VENDOR_SUPPLIES = [
  "samples_catalogues",
  "folders_sample_boards",
  "printing",
  "design_branding",
  "digital_marketing",
  "courier_logistics",
  "events",
  "merchandise",
  "others",
] as const;
export type VendorSupply = (typeof VENDOR_SUPPLIES)[number];

export const VENDOR_SUPPLY_LABEL: Record<VendorSupply, string> = {
  samples_catalogues: "Samples & catalogues",
  folders_sample_boards: "Folders & sample boards",
  printing: "Printing",
  design_branding: "Design & branding",
  digital_marketing: "Digital marketing",
  courier_logistics: "Courier & logistics",
  events: "Events",
  merchandise: "Merchandise",
  others: "Others",
};

// A part-timer's skills (demo MK_SKILL).
export const VENDOR_SKILLS = [
  "graphic_design",
  "video_shooting",
  "video_editing",
  "photography",
  "social_media",
  "copywriting",
  "others",
] as const;
export type VendorSkill = (typeof VENDOR_SKILLS)[number];

export const VENDOR_SKILL_LABEL: Record<VendorSkill, string> = {
  graphic_design: "Graphic design",
  video_shooting: "Video shooting",
  video_editing: "Video editing",
  photography: "Photography",
  social_media: "Social media",
  copywriting: "Copywriting",
  others: "Others",
};
