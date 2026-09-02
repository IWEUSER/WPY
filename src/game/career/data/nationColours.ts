import type { KitScheme, ShirtPattern } from '../../shooting/kitPalette';
import { getNation } from './nations';

/**
 * Home-shirt colours for national teams. Used for stadium crowds and the
 * opposition defender when the fixture is an international.
 *
 * Ids match `Nation.id` (slug of the FIFA association name).
 */
const PRIMARY: Record<string, string> = {
  albania: '#E41E20',
  andorra: '#D0103A',
  armenia: '#D90012',
  austria: '#ED2939',
  azerbaijan: '#00B5E2',
  belarus: '#C8102E',
  belgium: '#C8102E',
  'bosnia-and-herzegovina': '#002F6C',
  bulgaria: '#00966E',
  croatia: '#FF0000',
  cyprus: '#1E4D8C',
  czechia: '#D7141A',
  denmark: '#C60C30',
  england: '#FFFFFF',
  estonia: '#0072CE',
  'faroe-islands': '#005EB8',
  finland: '#003580',
  france: '#002395',
  georgia: '#E8112D',
  germany: '#FFFFFF',
  gibraltar: '#C8102E',
  greece: '#0D5EAF',
  hungary: '#CE2939',
  iceland: '#02529C',
  israel: '#0038B8',
  italy: '#0066B3',
  kazakhstan: '#00ABC8',
  kosovo: '#244AA5',
  latvia: '#9E3039',
  liechtenstein: '#002F6C',
  lithuania: '#FDB913',
  luxembourg: '#00A1DE',
  malta: '#CF142B',
  moldova: '#0046AD',
  montenegro: '#C8102E',
  netherlands: '#F36C21',
  'north-macedonia': '#D20000',
  'northern-ireland': '#00A651',
  norway: '#BA0C2F',
  poland: '#DC143C',
  portugal: '#FF0000',
  'republic-of-ireland': '#169B62',
  romania: '#002B7F',
  russia: '#D52B1E',
  'san-marino': '#5BA3D9',
  scotland: '#006EB6',
  serbia: '#C6363C',
  slovakia: '#0B4EA2',
  slovenia: '#005DAA',
  spain: '#C60B1E',
  sweden: '#FECC00',
  switzerland: '#FF0000',
  turkey: '#E30A17',
  ukraine: '#005BBB',
  wales: '#C8102E',
  argentina: '#75AADB',
  bolivia: '#007A33',
  brazil: '#FFDF00',
  chile: '#D52B1E',
  colombia: '#FFCD00',
  ecuador: '#FFD100',
  paraguay: '#D52B1E',
  peru: '#D91023',
  uruguay: '#7BADE3',
  venezuela: '#8B1A4A',
  canada: '#C8102E',
  'costa-rica': '#CE1126',
  jamaica: '#FED100',
  mexico: '#006847',
  panama: '#DA121A',
  'united-states': '#002868',
  algeria: '#007A33',
  cameroon: '#007A5E',
  'cape-verde': '#003893',
  egypt: '#C8102E',
  ghana: '#FCD116',
  'ivory-coast': '#FF8200',
  morocco: '#C1272D',
  nigeria: '#008751',
  senegal: '#00853F',
  'south-africa': '#007749',
  tunisia: '#E70013',
  australia: '#FFCD00',
  'china-pr': '#DE2910',
  india: '#FF9933',
  iran: '#239F40',
  iraq: '#007A3D',
  japan: '#02449B',
  qatar: '#8D1B3D',
  'saudi-arabia': '#006C35',
  'south-korea': '#C60C30',
  'united-arab-emirates': '#CE1126',
  'new-zealand': '#000000',
};

const SECONDARY: Record<string, string> = {
  england: '#CF081F',
  germany: '#000000',
  spain: '#F1BF00',
  brazil: '#009C3B',
  argentina: '#FFFFFF',
  france: '#ED2939',
  portugal: '#006600',
  netherlands: '#21468B',
  sweden: '#006AA7',
  ukraine: '#FFD700',
  jamaica: '#007847',
  ghana: '#EF3340',
  colombia: '#003893',
  mexico: '#CE1126',
  'united-states': '#BF0A30',
  'saudi-arabia': '#FFFFFF',
  japan: '#FFFFFF',
  italy: '#FFFFFF',
  croatia: '#FFFFFF',
  belgium: '#FAE042',
  australia: '#00843D',
  nigeria: '#FFFFFF',
  morocco: '#006233',
  senegal: '#FCD116',
  wales: '#FFFFFF',
  scotland: '#FFFFFF',
  'republic-of-ireland': '#FFFFFF',
  'south-korea': '#003478',
  'new-zealand': '#FFFFFF',
  uruguay: '#000000',
  ecuador: '#0033A0',
};

const FALLBACK = [
  '#C8102E',
  '#0033A0',
  '#007A33',
  '#F5C518',
  '#1B4F72',
  '#8B1E3F',
  '#E87722',
  '#0E4D92',
  '#5B2C6F',
  '#117A65',
];

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PATTERN: Record<string, ShirtPattern> = {
  argentina: 'vertical',
  uruguay: 'hoops',
  croatia: 'vertical',
};

const SHORTS: Record<string, string> = {
  england: '#00147A',
  germany: '#000000',
  spain: '#0033A0',
  brazil: '#002776',
  italy: '#FFFFFF',
  france: '#002395',
  argentina: '#000000',
  portugal: '#006600',
  'northern-ireland': '#FFFFFF',
  'republic-of-ireland': '#FFFFFF',
};

const SOCKS: Record<string, string> = {
  england: '#FFFFFF',
  germany: '#FFFFFF',
  spain: '#0033A0',
  brazil: '#FFFFFF',
  italy: '#0066B3',
  france: '#ED2939',
  argentina: '#FFFFFF',
  netherlands: '#F36C21',
  portugal: '#FF0000',
  belgium: '#C8102E',
  croatia: '#FF0000',
  scotland: '#006EB6',
  wales: '#C8102E',
  mexico: '#006847',
  uruguay: '#7BADE3',
};

export function nationKit(id: string): KitScheme {
  const primary = PRIMARY[id] ?? FALLBACK[hashId(id) % FALLBACK.length];
  const secondary = SECONDARY[id];
  const pattern = PATTERN[id];
  const shorts = SHORTS[id];
  const socks = SOCKS[id];
  return {
    primary,
    ...(secondary ? { secondary } : {}),
    ...(pattern ? { pattern } : {}),
    ...(shorts ? { shorts } : {}),
    ...(socks ? { socks } : {}),
  };
}

export function nationKitOrFallback(id: string | undefined | null): KitScheme {
  if (!id) return { primary: '#1D4ED8' };
  return nationKit(id);
}

/** True when this id is a known FIFA association in the career nation list. */
export function isKnownNation(id: string): boolean {
  return Boolean(getNation(id));
}
