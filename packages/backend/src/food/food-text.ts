/**
 * Text and barcode normalisation shared by the food search and the
 * importers in packages/food-data, so both sides compare the same strings.
 */

/**
 * Lowercase, without accents or punctuation, single-spaced:
 * "Crème Fraîche, 30% fat" → "creme fraiche 30 fat".
 */
export function searchKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[œ]/g, 'oe')
    .replace(/[æ]/g, 'ae')
    .replace(/[ø]/g, 'o')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The longest searchText stored for one food. */
export const SEARCH_TEXT_MAX = 600;

/**
 * What a food is found by: its name, brand and other names, each once.
 */
export function searchTextOf(
  name: string,
  brand?: string | null,
  otherNames: readonly string[] = [],
): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of [name, brand ?? '', ...otherNames]) {
    const key = searchKey(raw);
    if (key && !seen.has(key)) {
      seen.add(key);
      parts.push(key);
    }
  }
  return parts.join(' ').slice(0, SEARCH_TEXT_MAX).trim();
}

/**
 * A barcode as GTIN-13 (or GTIN-14 for case codes), so the same product
 * matches however it was written: UPC-A "049000028911" and EAN-13
 * "0049000028911" are one product, and EAN-8 codes get leading zeros.
 * Returns null for anything that isn't 8–14 digits.
 */
export function normaliseBarcode(code: string | null | undefined) {
  const digits = (code ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) return null;
  const gtin14 = digits.padStart(14, '0');
  return gtin14.startsWith('0') ? gtin14.slice(1) : gtin14;
}

/**
 * A UPC-E code (8 digits: number system, 6 digits, check digit) expanded to
 * its UPC-A form, or null if it isn't a valid UPC-E. US products often
 * carry UPC-E; an 8-digit scan may be UPC-E or EAN-8, so lookups try both.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const ns = code[0];
  const d = code.slice(1, 7);
  const check = code[7];
  const last = d[5];
  let body: string;
  if (last === '0' || last === '1' || last === '2') {
    body = `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`;
  } else if (last === '3') {
    body = `${d.slice(0, 3)}00000${d.slice(3, 5)}`;
  } else if (last === '4') {
    body = `${d.slice(0, 4)}00000${d[4]}`;
  } else {
    body = `${d.slice(0, 5)}0000${last}`;
  }
  const upcA = `${ns}${body}${check}`;
  return checkDigitOk(upcA) ? upcA : null;
}

/** Whether a GTIN's last digit is its correct check digit. */
export function checkDigitOk(code: string): boolean {
  if (!/^\d{8,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * The normalised forms to look a scanned code up by: as written, and for
 * 8 digits also as an expanded UPC-E.
 */
export function barcodeCandidates(code: string | null | undefined): string[] {
  const out = new Set<string>();
  const direct = normaliseBarcode(code);
  if (direct) out.add(direct);
  const digits = (code ?? '').replace(/\D/g, '');
  if (digits.length === 8) {
    const upcA = normaliseBarcode(expandUpcE(digits));
    if (upcA) out.add(upcA);
  }
  return [...out];
}
