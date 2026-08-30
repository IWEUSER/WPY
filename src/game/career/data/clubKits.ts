import type { KitScheme, ShirtPattern } from '../../shooting/kitPalette';
import { defaultSocksForShirt } from '../../shooting/kitPalette';
import type { Club } from './clubs';

/**
 * Shirt patterns and second colours for clubs whose home kit is not a
 * single block of `Club.color`. Used for the stadium crowd mix and the
 * opposition defender.
 */
const KITS: Record<string, KitScheme> = {
  'real-madrid': { primary: '#FFFFFF', shorts: '#FFFFFF', socks: '#FFFFFF', pattern: 'solid' },
  tottenham: { primary: '#FFFFFF', secondary: '#132257', shorts: '#132257', socks: '#132257', pattern: 'solid' },
  leeds: { primary: '#FFFFFF', secondary: '#FFCD00', shorts: '#1e1e1e', socks: '#FFFFFF', pattern: 'solid' },
  marseille: { primary: '#FFFFFF', secondary: '#2FA0DA', shorts: '#2FA0DA', socks: '#FFFFFF', pattern: 'solid' },

  barcelona: { primary: '#A50044', secondary: '#004D98', pattern: 'vertical', shorts: '#004D98', socks: '#004D98' },
  juventus: { primary: '#000000', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#FFFFFF', socks: '#FFFFFF' },
  'ac-milan': { primary: '#FB090B', secondary: '#000000', pattern: 'vertical', shorts: '#FFFFFF', socks: '#000000' },
  inter: { primary: '#03256C', secondary: '#000000', pattern: 'vertical', shorts: '#000000', socks: '#000000' },
  'atletico-madrid': { primary: '#CB3524', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#003E7E', socks: '#003E7E' },
  newcastle: { primary: '#241F20', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#241F20', socks: '#241F20' },
  'real-betis': { primary: '#00954C', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#00954C', socks: '#00954C' },
  athletic: { primary: '#EE2523', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#000000', socks: '#000000' },
  'sporting-gijon': { primary: '#E20613', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#007A33', socks: '#E20613' },
  southampton: { primary: '#D71920', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#000000', socks: '#000000' },
  stuttgart: { primary: '#E32219', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#000000', socks: '#E32219' },
  nice: { primary: '#941C1F', secondary: '#000000', pattern: 'vertical', shorts: '#000000', socks: '#000000' },
  genoa: { primary: '#AD1919', secondary: '#003DA5', pattern: 'vertical', shorts: '#003DA5', socks: '#003DA5' },
  hertha: { primary: '#005CA9', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#005CA9', socks: '#005CA9' },
  'al-ittihad': { primary: '#000000', secondary: '#FFD100', pattern: 'vertical', shorts: '#000000', socks: '#000000' },
  udinese: { primary: '#000000', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#000000', socks: '#000000' },
  eibar: { primary: '#1D1D1B', secondary: '#005CA9', pattern: 'vertical', shorts: '#005CA9', socks: '#005CA9' },
  psg: { primary: '#004170', secondary: '#DA001C', pattern: 'vertical', shorts: '#004170', socks: '#004170' },
  cremonese: { primary: '#D21034', secondary: '#8B1A10', pattern: 'vertical', shorts: '#FFFFFF', socks: '#D21034' },
  reims: { primary: '#E30613', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#E30613', socks: '#E30613' },

  'inter-miami': { primary: '#F7B5CD', secondary: '#000000', pattern: 'solid', shorts: '#000000', socks: '#F7B5CD' },
  liverpool: { primary: '#C8102E', secondary: '#FFFFFF', pattern: 'solid', shorts: '#C8102E', socks: '#C8102E' },
  arsenal: { primary: '#EF0107', secondary: '#FFFFFF', pattern: 'solid', shorts: '#FFFFFF', socks: '#FFFFFF' },
  chelsea: { primary: '#034694', secondary: '#FFFFFF', pattern: 'solid', shorts: '#034694', socks: '#FFFFFF' },
  'man-city': { primary: '#6CABDD', secondary: '#FFFFFF', pattern: 'solid', shorts: '#FFFFFF', socks: '#FFFFFF' },
  bayern: { primary: '#DC052D', secondary: '#FFFFFF', pattern: 'solid', shorts: '#FFFFFF', socks: '#DC052D' },
  dortmund: { primary: '#FDE100', secondary: '#000000', pattern: 'solid', shorts: '#000000', socks: '#000000' },
};

/**
 * Home sock colours that differ from the shirt or from the shorts default.
 * Traditional home kit — white socks on Chelsea / Arsenal / City, black at
 * United, red at Bayern, and so on.
 */
const SOCK_OVERRIDES: Record<string, string> = {
  'man-united': '#000000',
  chelsea: '#FFFFFF',
  arsenal: '#FFFFFF',
  'man-city': '#FFFFFF',
  bayern: '#DC052D',
  'real-madrid': '#FFFFFF',
  barcelona: '#004D98',
  liverpool: '#C8102E',
  tottenham: '#132257',
  juventus: '#FFFFFF',
  'ac-milan': '#000000',
  inter: '#000000',
  dortmund: '#000000',
  'atletico-madrid': '#003E7E',
  newcastle: '#241F20',
  'aston-villa': '#670E36',
  'crystal-palace': '#1B458F',
  everton: '#003399',
  brighton: '#0057B8',
  'west-ham': '#7A263A',
  fulham: '#000000',
  wolves: '#000000',
  'nottingham-forest': '#E53233',
  brentford: '#E30613',
  leicester: '#003090',
  leeds: '#FFFFFF',
  bournemouth: '#000000',
  burnley: '#6C1D45',
  sunderland: '#EB172B',
  southampton: '#000000',
  luton: '#F78F1E',
  napoli: '#12A0D7',
  roma: '#8E1F2F',
  lazio: '#87D8F7',
  fiorentina: '#492E7C',
  atalanta: '#1E71B8',
  'real-sociedad': '#0A3F87',
  villarreal: '#FFE667',
  getafe: '#005999',
  'celta-vigo': '#8AC3EE',
  sevilla: '#FFFFFF',
  valencia: '#EE3524',
  psg: '#004170',
  monaco: '#E51A22',
  lille: '#E01D2B',
  marseille: '#FFFFFF',
  lyon: '#FFFFFF',
  'al-hilal': '#1B3D8F',
  'al-nassr': '#FED034',
  'al-ahli': '#006233',
  lafc: '#000000',
  'inter-miami': '#F7B5CD',
  seattle: '#5D9741',
  frankfurt: '#000000',
  gladbach: '#000000',
  werder: '#1D9053',
  leverkusen: '#E32219',
  leipzig: '#DD0741',
  'west-brom': '#122F67',
  stoke: '#E03A3E',
  cardiff: '#0070B5',
  swansea: '#000000',
  qpr: '#1D5BA4',
  norwich: '#FFF200',
  watford: '#FBEE23',
  'sheff-utd': '#EE2737',
};

export function clubKit(club: Club | undefined, fallback = '#1D4ED8'): KitScheme {
  if (!club) return { primary: fallback, pattern: 'solid', socks: defaultSocksForShirt(fallback) };
  const override = KITS[club.id];
  const socks = SOCK_OVERRIDES[club.id]
    ?? override?.socks
    ?? defaultSocksForShirt(override?.primary ?? club.color, override?.shorts);
  if (override) return { ...override, socks };
  return { primary: club.color, pattern: 'solid' as ShirtPattern, socks };
}
