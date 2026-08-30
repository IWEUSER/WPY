/** Hex kit helpers shared by the stadium crowd and the defender shirt. */

export interface DefenderKit {
  shirt: string;
  shirtDark: string;
  shorts: string;
}

export interface KitScheme {
  primary: string;
  secondary?: string;
}

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const raw = hex.trim().replace('#', '');
  const n = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(n, 16);
  if (!Number.isFinite(value)) return { r: 30, g: 64, b: 175 };
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Lighten (positive) or darken (negative) a hex colour. Amount is roughly -1…1. */
export function shadeHex(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  if (amount >= 0) {
    return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
  }
  const t = 1 + amount;
  return rgbToHex(r * t, g * t, b * t);
}

export function normalizeHex(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const trimmed = raw.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) return fallback;
  const full = trimmed.length === 3 ? trimmed.split('').map((c) => c + c).join('') : trimmed;
  return `#${full.toUpperCase()}`;
}

/**
 * Lift pitch-black kits so a crowd still reads, and pull pure white/gold
 * down slightly so seats do not blow out against floodlights.
 */
export function crowdSwatch(hex: string): string {
  const lum = luminance(hex);
  if (lum < 0.12) return mixHex(hex, '#6b7280', 0.42);
  if (lum > 0.82) return mixHex(hex, '#9ca3af', 0.28);
  return hex;
}

export function kitFromColor(hex: string): DefenderKit {
  const lum = luminance(hex);
  const shirt = lum < 0.08 ? shadeHex(hex, 0.12) : hex;
  return {
    shirt,
    shirtDark: shadeHex(shirt, -0.28),
    shorts: lum < 0.45 ? '#f8fafc' : '#1e1e1e',
  };
}

export function schemeFromColor(hex: string, secondary?: string): KitScheme {
  return secondary ? { primary: hex, secondary } : { primary: hex };
}
