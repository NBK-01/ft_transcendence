/**
 * Demo-checkout card checks. Everything here runs in the browser only: the
 * full number and CVC are validated, then dropped — the API gets the last 4
 * digits and the expiry, never more.
 */

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** "4242424242424242" → "4242 4242 4242 4242" while typing. */
export const formatCardNumber = (value: string) =>
  digitsOnly(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

/** Luhn checksum: catches typos in a card number. */
export function isValidCardNumber(value: string) {
  const digits = digitsOnly(value);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits.at(-1 - i));
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** "0427" / "04/27" → "04 / 27" while typing. */
export function formatExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

/** "04 / 27" → { month: 4, year: 2027 }, or null if malformed or already expired. */
export function parseExpiry(value: string, today = new Date()) {
  const digits = digitsOnly(value);
  if (digits.length !== 4) return null;
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) return null;
  const endOfMonth = new Date(year, month, 1);
  return endOfMonth > today ? { month, year } : null;
}

export const isValidCvc = (value: string) => /^\d{3,4}$/.test(value);
