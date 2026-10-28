/**
 * Generates an RFC-4122 v4 UUID compatible with PostgreSQL `uuid` columns across
 * Hermes (React Native Android), Node.js, and modern browsers without external polyfills.
 */
export function createClientUuid(): string {
  const g = globalThis as unknown as {
    crypto?: {
      randomUUID?: () => string;
      getRandomValues?: (arr: Uint8Array) => Uint8Array;
    };
  };

  if (typeof g.crypto?.randomUUID === "function") {
    return g.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof g.crypto?.getRandomValues === "function") {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 version 4 & variant 10xx
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    hex.push((bytes[i] ?? 0).toString(16).padStart(2, "0"));
  }

  return (
    `${hex.slice(0, 4).join("")}-` +
    `${hex.slice(4, 6).join("")}-` +
    `${hex.slice(6, 8).join("")}-` +
    `${hex.slice(8, 10).join("")}-` +
    `${hex.slice(10, 16).join("")}`
  );
}
