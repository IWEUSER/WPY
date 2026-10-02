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
  | 'southeast-asia'
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

const SOUTHEAST_ASIA = new Set([
  'malaysia',
  'indonesia',
  'thailand',
  'vietnam',
  'singapore',
  'philippines',
  'myanmar',
  'cambodia',
  'laos',
  'brunei-darussalam',
  'brunei',
  'timor-leste',
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
  if (SOUTHEAST_ASIA.has(id)) return 'southeast-asia';
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
const DARK = ['#6b3d1f', '#4a2612', '#3a1c0e', '#381c10'] as const;

const COUNTRY_LOCALE: Record<string, string> = {
  argentina: 'argentina',
  brazil: 'brazil',
  colombia: 'colombia',
  mexico: 'mexico',
  japan: 'japan',
  'saudi-arabia': 'saudi-arabia',
  england: 'england',
  netherlands: 'netherlands',
  holland: 'netherlands',
  france: 'france',
  germany: 'germany',
  spain: 'spain',
  portugal: 'portugal',
  italy: 'italy',
  'united-states': 'united-states',
  usa: 'united-states',
  america: 'united-states',
};

export function appearanceLocaleForNation(nation?: { id: string } | null): string | null {
  if (!nation) return null;
  return COUNTRY_LOCALE[nation.id] ?? null;
}

export function appearanceLocaleForCountry(country?: string | null): string | null {
  if (!country) return null;
  const key = country.trim().toLowerCase().replace(/\s+/g, '-');
  return COUNTRY_LOCALE[key] ?? COUNTRY_LOCALE[country.trim().toLowerCase()] ?? null;
}

function weightedSkins(locale: string): { value: string; w: number }[] {
  const fair = FAIR.map((value) => ({ value, w: 1 }));
  const tan = LIGHT_TAN.map((value) => ({ value, w: 1 }));
  const lightBrown = LIGHT_BROWN.map((value) => ({ value, w: 1 }));
  const brown = BROWN.map((value) => ({ value, w: 1 }));
  const dark = DARK.map((value) => ({ value, w: 1 }));
  const mix = (items: readonly string[], w: number) => items.map((value) => ({ value, w }));
  switch (locale) {
    case 'argentina':
      return [...mix(FAIR, 8), ...mix(LIGHT_TAN, 2), ...mix(LIGHT_BROWN, 1)];
    case 'brazil':
      return [...mix(LIGHT_BROWN, 5), ...mix(BROWN, 4), ...mix(DARK, 3), ...mix(LIGHT_TAN, 1), ...mix(FAIR, 1)];
    case 'colombia':
    case 'saudi-arabia':
      return [...mix(LIGHT_BROWN, 5), ...mix(BROWN, 4), ...mix(DARK, 3), ...mix(FAIR, 1), ...mix(LIGHT_TAN, 1)];
    case 'mexico':
      return [...mix(LIGHT_BROWN, 6), ...mix(BROWN, 3), ...mix(DARK, 1)];
    case 'japan':
      return [...mix(FAIR, 6), ...mix(LIGHT_TAN, 5), ...mix(LIGHT_BROWN, 2)];
    case 'england':
    case 'netherlands':
    case 'france':
    case 'united-states':
      return [...fair, ...tan, ...lightBrown, ...brown, ...dark];
    case 'germany':
    case 'italy':
      return [...mix(FAIR, 7), ...mix(LIGHT_TAN, 3), ...mix(LIGHT_BROWN, 2), ...mix(BROWN, 2), ...mix(DARK, 2)];
    case 'spain':
    case 'portugal':
      return [...mix(LIGHT_BROWN, 5), ...mix(BROWN, 4), ...mix(DARK, 2), ...mix(FAIR, 2), ...mix(LIGHT_TAN, 2)];
    default:
      return [...fair, ...tan, ...lightBrown, ...brown, ...dark];
  }
}

function hairForLocale(locale: string, skin: string, seed: number): string {
  switch (locale) {
    case 'argentina':
      return pickWeighted(seed + 17, [
        { value: HAIR_BROWN, w: 5 },
        { value: HAIR_BLACK, w: 4 },
        { value: HAIR_DARK_BROWN, w: 3 },
      ]);
    case 'brazil':
    case 'colombia':
    case 'mexico':
      return pickWeighted(seed + 17, [
        { value: HAIR_BLACK, w: 6 },
        { value: HAIR_DARK_BROWN, w: 3 },
        { value: HAIR_BROWN, w: locale === 'mexico' ? 1 : 2 },
      ]);
    case 'japan':
      return pickWeighted(seed + 17, [
        { value: HAIR_BROWN, w: 6 },
        { value: HAIR_DARK_BROWN, w: 3 },
        { value: HAIR_BLACK, w: 2 },
        { value: HAIR_BLONDE, w: 2 },
        { value: HAIR_DARK_BLONDE, w: 1 },
      ]);
    case 'saudi-arabia':
      return pickWeighted(seed + 17, [
        { value: HAIR_BLACK, w: 6 },
        { value: HAIR_DARK_BROWN, w: 4 },
        { value: HAIR_BROWN, w: 2 },
        { value: HAIR_BLONDE, w: 1 },
      ]);
    case 'england':
    case 'netherlands':
    case 'france':
    case 'united-states':
      return pickWeighted(seed + 17, [
        { value: HAIR_BROWN, w: 4 },
        { value: HAIR_DARK_BROWN, w: 3 },
        { value: HAIR_BLACK, w: 3 },
        { value: HAIR_BLONDE, w: 2 },
        { value: HAIR_DARK_BLONDE, w: 2 },
      ]);
    case 'germany':
    case 'italy':
      return pickWeighted(seed + 17, [
        { value: HAIR_BROWN, w: 5 },
        { value: HAIR_DARK_BROWN, w: 4 },
        { value: HAIR_BLACK, w: 3 },
        { value: HAIR_DARK_BLONDE, w: locale === 'germany' ? 2 : 1 },
        { value: HAIR_BLONDE, w: locale === 'germany' ? 1 : 0 },
      ].filter((item) => item.w > 0));
    case 'spain':
    case 'portugal':
      return pickWeighted(seed + 17, [
        { value: HAIR_BROWN, w: 5 },
        { value: HAIR_BLACK, w: 5 },
        { value: HAIR_DARK_BROWN, w: 3 },
        { value: HAIR_BLONDE, w: 1 },
      ]);
    default:
      return hairForRegion('any', skin, seed);
  }
}

function skinsForRegion(region: AppearanceRegion): readonly string[] {
  switch (region) {
    case 'africa':
      return [...BROWN, '#6b3d1f', '#4a2612', '#3a1c0e', '#381c10'];
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
    case 'southeast-asia':
      return [...LIGHT_BROWN, BROWN[0]];
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
    case 'southeast-asia':
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

export function pickPlayerLook(
  seed: number,
  region: AppearanceRegion = 'any',
  locale?: string | null,
): PlayerLook {
  if (locale) {
    const skins = weightedSkins(locale);
    const skin = pickWeighted(Math.abs(Math.floor(seed)), skins);
    return { skin, hair: hairForLocale(locale, skin, Math.floor(seed)) };
  }
  const skins = skinsForRegion(region);
  const skin = skins[Math.abs(Math.floor(seed)) % skins.length];
  return { skin, hair: hairForRegion(region, skin, Math.floor(seed)) };
}

/** Player-selectable skin tones shown on the identity screens. */
export const SKIN_SWATCHES = [
  '#f7e4cc',
  '#f6dec0',
  '#edd0a8',
  '#e8b88a',
  '#e0c09a',
  '#d4a574',
  '#c68642',
  '#8d5524',
  '#6b3d1f',
  '#4a2612',
  '#3a1c0e',
  '#381c10',
] as const;

/** Player-selectable hair colours shown on the identity screens. */
export const HAIR_SWATCHES = [
  HAIR_BLONDE,
  HAIR_DARK_BLONDE,
  HAIR_BROWN,
  HAIR_DARK_BROWN,
  HAIR_BLACK,
] as const;

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
