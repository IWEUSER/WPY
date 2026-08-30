/** Hex kit helpers shared by the stadium crowd and the defender shirt. */

export type ShirtPattern = 'solid' | 'vertical' | 'hoops';

export interface DefenderKit {
  shirt: string;
  shirtDark: string;
  shorts: string;
  socks: string;
  stripe?: string;
  pattern: ShirtPattern;
}

export interface KitScheme {
  primary: string;
  secondary?: string;
  /** If omitted, shorts are light on a dark shirt and dark on a light shirt. */
  shorts?: string;
  /** Knee-high sock colour. Falls back to shorts, then the shirt. */
  socks?: string;
  pattern?: ShirtPattern;
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

export function defaultSocksForShirt(primary: string, shorts?: string): string {
  if (shorts) return shorts;
  const lum = luminance(primary);
  if (lum > 0.72) return '#111827';
  return primary;
}

export function kitFromColor(hex: string, secondary?: string, extras?: Pick<KitScheme, 'shorts' | 'socks' | 'pattern'>): DefenderKit {
  return kitFromScheme({
    primary: hex,
    secondary,
    shorts: extras?.shorts,
    socks: extras?.socks,
    pattern: extras?.pattern,
  });
}

export function kitFromScheme(scheme: KitScheme): DefenderKit {
  const lum = luminance(scheme.primary);
  const shirt = lum < 0.08 ? shadeHex(scheme.primary, 0.12) : scheme.primary;
  const pattern = scheme.pattern && scheme.secondary ? scheme.pattern : 'solid';
  const shorts = scheme.shorts
    ?? (lum < 0.45 ? '#f8fafc' : '#1e1e1e');
  const socks = scheme.socks ?? defaultSocksForShirt(scheme.primary, scheme.shorts);
  return {
    shirt,
    shirtDark: shadeHex(shirt, -0.28),
    shorts,
    socks,
    stripe: pattern !== 'solid' ? scheme.secondary : undefined,
    pattern,
  };
}

export function schemeFromColor(hex: string, secondary?: string): KitScheme {
  return secondary ? { primary: hex, secondary } : { primary: hex };
}
