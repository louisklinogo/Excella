export const DEFAULT_REDACT_KEYS = [
  "authorization",
  "token",
  "apikey",
  "password",
  "secret",
  "cookie",
  "session",
];

export const PII_EMAIL = ["email", "emailAddress", "contactEmail"];
export const PII_PHONE = ["phone", "phoneNumber"];
export const PAYMENT = ["card", "creditCard", "cvc", "iban", "accountNumber"];

export function mergeRedactKeys(...sets: Array<string[]>): string[] {
  const merged = new Set<string>();
  for (const keys of sets) {
    for (const key of keys) merged.add(key.toLowerCase());
  }
  return Array.from(merged);
}
