/** A quotation number as the demo normalises it (normNo): no spaces, capitals, only A-Z 0-9 - _ . */
export const normaliseQuoteNo = (text: string): string =>
  text
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9\-_.]/g, "");
