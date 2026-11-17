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
