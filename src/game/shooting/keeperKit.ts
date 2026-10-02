import { kitFromScheme, luminance, parseHex, type DefenderKit } from './kitPalette';

export interface KeeperKit {
  shirt: string;
  shirtDark: string;
  shorts: string;
  socks: string;
  glove: string;
  gloveLine: string;
}

/** Bright orange — reserved for elite opposition keepers. */
export const ELITE_KEEPER_KIT: KeeperKit = {
  shirt: '#FF6A00',
  shirtDark: '#C2410C',
  shorts: '#111111',
  socks: '#FF6A00',
  glove: '#111111',
  gloveLine: '#FF6A00',
};

const KEEPER_PRESETS: KeeperKit[] = [
  { shirt: '#FDE047', shirtDark: '#CA8A04', shorts: '#14532D', socks: '#166534', glove: '#22C55E', gloveLine: '#166534' },
  { shirt: '#A3E635', shirtDark: '#4D7C0F', shorts: '#1E3A8A', socks: '#1E3A8A', glove: '#1E3A8A', gloveLine: '#14532D' },
  { shirt: '#C084FC', shirtDark: '#7E22CE', shorts: '#111827', socks: '#C084FC', glove: '#111827', gloveLine: '#7E22CE' },
  { shirt: '#FB7185', shirtDark: '#BE123C', shorts: '#0F172A', socks: '#FB7185', glove: '#0F172A', gloveLine: '#BE123C' },
  { shirt: '#22D3EE', shirtDark: '#0E7490', shorts: '#111827', socks: '#22D3EE', glove: '#111827', gloveLine: '#0E7490' },
  { shirt: '#F8FAFC', shirtDark: '#94A3B8', shorts: '#111827', socks: '#F8FAFC', glove: '#111827', gloveLine: '#334155' },
];

function colorDistance(a: string, b: string): number {
  const A = parseHex(a);
  const B = parseHex(b);
  const dr = A.r - B.r;
  const dg = A.g - B.g;
  const db = A.b - B.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function clashes(keeper: string, outfield: string): boolean {
  if (colorDistance(keeper, outfield) < 78) return true;
  return Math.abs(luminance(keeper) - luminance(outfield)) < 0.12;
}

export function isEliteOpposition(strength?: number | null): boolean {
  return (strength ?? 0) >= 88;
}

/** Shirt, shorts and socks that stay clear of the outfield kit. */
export function pickKeeperKit(defender?: DefenderKit | null, elite = false, seed = 0): KeeperKit {
  if (elite) return ELITE_KEEPER_KIT;
  const shirt = defender?.shirt ?? '#1D4ED8';
  const shorts = defender?.shorts ?? '#111827';
  const socks = defender?.socks ?? shorts;
  const usable = KEEPER_PRESETS.filter((kit) =>
    !clashes(kit.shirt, shirt)
    && !clashes(kit.shirt, shorts)
    && !clashes(kit.shorts, shorts)
    && !clashes(kit.socks, socks),
  );
  const pool = usable.length > 0 ? usable : [KEEPER_PRESETS[2]];
  return pool[Math.abs(seed) % pool.length];
}

export function keeperKitFromDefenderScheme(
  defender?: DefenderKit | null,
  elite = false,
): KeeperKit {
  return pickKeeperKit(defender ?? kitFromScheme({ primary: '#1D4ED8' }), elite);
}
