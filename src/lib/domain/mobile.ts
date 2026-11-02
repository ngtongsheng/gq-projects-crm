// Stored form: digits only with the 60 country code, matching the contacts.mobile check.
const STORED_MOBILE = /^60\d{8,10}$/;

/** Turns +60 12-345 6789, 60123456789 or 012-345 6789 into 60123456789; null when it is not a Malaysian number. */
export function normaliseMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `6${digits}`;
  else if (digits.startsWith("1")) digits = `60${digits}`;
  return STORED_MOBILE.test(digits) ? digits : null;
}
