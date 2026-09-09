import { luminance } from './kitPalette';

/** Hair colours used on keepers and defenders. */
export const HAIR_BLONDE = '#d4b45a';
export const HAIR_DARK_BLONDE = '#a8843c';
export const HAIR_BROWN = '#5a3820';
export const HAIR_DARK_BROWN = '#2c1810';
export const HAIR_BLACK = '#120c08';

export type AppearanceRegion =
  | 'any'
  | 'africa'
  | 'nordic'
  | 'eastern-europe'
  | 'western-europe'
  | 'mediterranean'
  | 'latino'
  | 'caribbean'
  | 'middle-east'
  | 'east-asia'
  | 'south-asia'
  | 'pacific';

export interface PlayerLook {
  skin: string;
  hair: string;
}

const NORDIC = new Set([
  'sweden',
  'norway',
  'denmark',
  'finland',
  'iceland',
  'faroe-islands',
]);

const EASTERN_EUROPE = new Set([
  'albania',
  'belarus',
  'bosnia-and-herzegovina',
  'bulgaria',
  'croatia',
  'czechia',
  'estonia',
  'georgia',
  'hungary',
  'kosovo',
  'latvia',
  'lithuania',
  'moldova',
  'montenegro',
  'north-macedonia',
  'poland',
  'romania',
  'russia',
  'serbia',
  'slovakia',
  'slovenia',
  'ukraine',
]);

const WESTERN_EUROPE = new Set([
  'austria',
  'belgium',
  'england',
  'france',
  'germany',
  'liechtenstein',
  'luxembourg',
  'netherlands',
  'northern-ireland',
  'republic-of-ireland',
  'scotland',
  'switzerland',
  'wales',
]);

const MEDITERRANEAN = new Set([
  'andorra',
  'cyprus',
  'gibraltar',
  'greece',
  'israel',
  'italy',
  'malta',
  'portugal',
  'san-marino',
  'spain',
  'turkey',
]);

const LATINO = new Set([
  'argentina',
  'bolivia',
  'brazil',
  'chile',
  'colombia',
  'costa-rica',
  'cuba',
  'dominican-republic',
  'ecuador',
  'el-salvador',
  'guatemala',
  'honduras',
  'mexico',
  'nicaragua',
  'panama',
  'paraguay',
  'peru',
  'puerto-rico',
  'uruguay',
  'venezuela',
]);

const CARIBBEAN = new Set([
  'antigua-and-barbuda',
  'bahamas',
  'barbados',
  'dominica',
  'grenada',
  'guyana',
  'haiti',
  'jamaica',
  'saint-kitts-and-nevis',
  'saint-lucia',
  'saint-vincent-and-the-grenadines',
  'suriname',
  'trinidad-and-tobago',
]);

const EAST_ASIA = new Set([
  'china-pr',
  'japan',
  'south-korea',
  'north-korea',
  'chinese-taipei',
  'hong-kong',
  'mongolia',
]);

const SOUTH_ASIA = new Set([
  'india',
  'pakistan',
  'bangladesh',
  'sri-lanka',
  'nepal',
  'afghanistan',
]);

const MIDDLE_EAST = new Set([
  'saudi-arabia',
  'qatar',
  'uae',
  'united-arab-emirates',
  'iran',
  'iraq',
  'jordan',
  'kuwait',
  'lebanon',
  'oman',
  'bahrain',
  'syria',
  'yemen',
  'palestine',
]);

export function appearanceRegionForNation(
  nation?: { id: string; confederation: string } | null,
): AppearanceRegion {
  if (!nation) return 'any';
  const id = nation.id;
  if (nation.confederation === 'CAF') return 'africa';
  if (NORDIC.has(id)) return 'nordic';
  if (EASTERN_EUROPE.has(id)) return 'eastern-europe';
  if (LATINO.has(id)) return 'latino';
  if (CARIBBEAN.has(id)) return 'caribbean';
  if (WESTERN_EUROPE.has(id)) return 'western-europe';
  if (MEDITERRANEAN.has(id)) return 'mediterranean';
  if (EAST_ASIA.has(id)) return 'east-asia';
  if (SOUTH_ASIA.has(id)) return 'south-asia';
  if (MIDDLE_EAST.has(id)) return 'middle-east';
  if (nation.confederation === 'OFC') return 'pacific';
  if (nation.confederation === 'CONMEBOL') return 'latino';
  return 'any';
}

function pickWeighted<T>(seed: number, items: readonly { value: T; w: number }[]): T {
  const total = items.reduce((s, it) => s + it.w, 0);
  let r = (Math.abs(seed) % 1000) / 1000 * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

const FAIR = ['#f7e4cc', '#f6dec0', '#edd0a8'] as const;
const LIGHT_TAN = ['#e8b88a', '#e0c09a'] as const;
const LIGHT_BROWN = ['#d4a574', '#c68642'] as const;
const BROWN = ['#8d5524', '#c68642'] as const;
const DARK = ['#6b3d1f'] as const;

function skinsForRegion(region: AppearanceRegion): readonly string[] {
  switch (region) {
    case 'africa':
      return [...BROWN, ...DARK];
    case 'nordic':
    case 'eastern-europe':
      return FAIR;
    case 'western-europe':
      return [...FAIR, ...LIGHT_TAN, LIGHT_BROWN[0]];
    case 'mediterranean':
      return [...LIGHT_TAN, ...LIGHT_BROWN, FAIR[1]];
    case 'latino':
      return LIGHT_BROWN;
    case 'caribbean':
      return [...BROWN, ...DARK, LIGHT_BROWN[1]];
    case 'middle-east':
      return [...LIGHT_TAN, ...LIGHT_BROWN, BROWN[0]];
    case 'east-asia':
      return [LIGHT_TAN[0], LIGHT_BROWN[0], FAIR[2]];
    case 'south-asia':
      return [...BROWN, LIGHT_BROWN[1]];
    case 'pacific':
      return [...BROWN, ...DARK, LIGHT_BROWN[1]];
    default:
      return [...FAIR, ...LIGHT_TAN, ...LIGHT_BROWN, ...BROWN, ...DARK];
  }
}

function hairForRegion(region: AppearanceRegion, skin: string, seed: number): string {
  const fair = luminance(skin) > 0.58;
  switch (region) {
    case 'nordic':
      return pickWeighted(seed + 17, [
        { value: HAIR_BLONDE, w: 7 },
        { value: HAIR_DARK_BLONDE, w: 2 },
        { value: HAIR_BROWN, w: 1 },
      ]);
    case 'eastern-europe':
      return pickWeighted(seed + 17, [
        { value: HAIR_BROWN, w: 6 },
        { value: HAIR_DARK_BROWN, w: 3 },
        { value: HAIR_BLONDE, w: 1 },
      ]);
    case 'latino':
    case 'caribbean':
    case 'africa':
    case 'east-asia':
    case 'south-asia':
    case 'pacific':
      return pickWeighted(seed + 17, [
        { value: HAIR_BLACK, w: 8 },
        { value: HAIR_DARK_BROWN, w: 2 },
      ]);
    case 'mediterranean':
    case 'middle-east':
      return pickWeighted(seed + 17, [
        { value: HAIR_BLACK, w: 6 },
        { value: HAIR_DARK_BROWN, w: 3 },
        { value: HAIR_BROWN, w: 1 },
      ]);
    case 'western-europe':
      return fair
        ? pickWeighted(seed + 17, [
            { value: HAIR_BROWN, w: 4 },
            { value: HAIR_DARK_BROWN, w: 3 },
            { value: HAIR_BLONDE, w: 2 },
            { value: HAIR_DARK_BLONDE, w: 1 },
          ])
        : pickWeighted(seed + 17, [
            { value: HAIR_DARK_BROWN, w: 6 },
            { value: HAIR_BLACK, w: 3 },
            { value: HAIR_BROWN, w: 1 },
          ]);
    default:
      if (luminance(skin) > 0.65) {
        return pickWeighted(seed + 17, [
          { value: HAIR_BROWN, w: 4 },
          { value: HAIR_BLONDE, w: 3 },
          { value: HAIR_DARK_BLONDE, w: 2 },
          { value: HAIR_DARK_BROWN, w: 1 },
        ]);
      }
      if (fair) {
        return pickWeighted(seed + 17, [
          { value: HAIR_BROWN, w: 5 },
          { value: HAIR_DARK_BROWN, w: 3 },
          { value: HAIR_BLONDE, w: 2 },
        ]);
      }
      return pickWeighted(seed + 17, [
        { value: HAIR_BLACK, w: 6 },
        { value: HAIR_DARK_BROWN, w: 4 },
      ]);
  }
}

export function pickPlayerLook(seed: number, region: AppearanceRegion = 'any'): PlayerLook {
  const skins = skinsForRegion(region);
  const skin = skins[Math.abs(Math.floor(seed)) % skins.length];
  return { skin, hair: hairForRegion(region, skin, Math.floor(seed)) };
}

/** Fair skin only — used by tests and eastern-Europe sampling. */
export function isFairSkin(hex: string): boolean {
  return luminance(hex) > 0.58;
}

export function isBlondeHair(hex: string): boolean {
  const h = hex.toLowerCase();
  return h === HAIR_BLONDE.toLowerCase() || h === HAIR_DARK_BLONDE.toLowerCase();
}

export function isBlackHair(hex: string): boolean {
  return hex.toLowerCase() === HAIR_BLACK.toLowerCase();
}
