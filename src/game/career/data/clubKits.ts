import type { KitScheme, ShirtPattern } from '../../shooting/kitPalette';
import type { Club } from './clubs';

/**
 * Shirt patterns and second colours for clubs whose home kit is not a
 * single block of `Club.color`. Used for the stadium crowd mix and the
 * opposition defender.
 */
const KITS: Record<string, KitScheme> = {
  'real-madrid': { primary: '#FFFFFF', shorts: '#FFFFFF', pattern: 'solid' },
  tottenham: { primary: '#FFFFFF', secondary: '#132257', shorts: '#132257', pattern: 'solid' },
  leeds: { primary: '#FFFFFF', secondary: '#FFCD00', shorts: '#1e1e1e', pattern: 'solid' },
  marseille: { primary: '#FFFFFF', secondary: '#2FA0DA', shorts: '#2FA0DA', pattern: 'solid' },

  barcelona: { primary: '#A50044', secondary: '#004D98', pattern: 'vertical', shorts: '#004D98' },
  juventus: { primary: '#000000', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#FFFFFF' },
  'ac-milan': { primary: '#FB090B', secondary: '#000000', pattern: 'vertical', shorts: '#FFFFFF' },
  inter: { primary: '#03256C', secondary: '#000000', pattern: 'vertical', shorts: '#000000' },
  'atletico-madrid': { primary: '#CB3524', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#003E7E' },
  newcastle: { primary: '#241F20', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#241F20' },
  'real-betis': { primary: '#00954C', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#00954C' },
  athletic: { primary: '#EE2523', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#000000' },
  'sporting-gijon': { primary: '#E20613', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#007A33' },
  southampton: { primary: '#D71920', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#000000' },
  stuttgart: { primary: '#E32219', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#000000' },
  nice: { primary: '#941C1F', secondary: '#000000', pattern: 'vertical', shorts: '#000000' },
  genoa: { primary: '#AD1919', secondary: '#003DA5', pattern: 'vertical', shorts: '#003DA5' },
  hertha: { primary: '#005CA9', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#005CA9' },
  'al-ittihad': { primary: '#000000', secondary: '#FFD100', pattern: 'vertical', shorts: '#000000' },
  udinese: { primary: '#000000', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#000000' },
  eibar: { primary: '#1D1D1B', secondary: '#005CA9', pattern: 'vertical', shorts: '#005CA9' },
  psg: { primary: '#004170', secondary: '#DA001C', pattern: 'vertical', shorts: '#004170' },
  cremonese: { primary: '#D21034', secondary: '#8B1A10', pattern: 'vertical', shorts: '#FFFFFF' },
  reims: { primary: '#E30613', secondary: '#FFFFFF', pattern: 'vertical', shorts: '#E30613' },

  'inter-miami': { primary: '#F7B5CD', secondary: '#000000', pattern: 'solid', shorts: '#000000' },
  liverpool: { primary: '#C8102E', secondary: '#FFFFFF', pattern: 'solid', shorts: '#C8102E' },
  arsenal: { primary: '#EF0107', secondary: '#FFFFFF', pattern: 'solid', shorts: '#FFFFFF' },
  chelsea: { primary: '#034694', secondary: '#FFFFFF', pattern: 'solid', shorts: '#034694' },
  'man-city': { primary: '#6CABDD', secondary: '#FFFFFF', pattern: 'solid', shorts: '#FFFFFF' },
  bayern: { primary: '#DC052D', secondary: '#FFFFFF', pattern: 'solid', shorts: '#FFFFFF' },
  dortmund: { primary: '#FDE100', secondary: '#000000', pattern: 'solid', shorts: '#000000' },
};

export function clubKit(club: Club | undefined, fallback = '#1D4ED8'): KitScheme {
  if (!club) return { primary: fallback, pattern: 'solid' };
  const override = KITS[club.id];
  if (override) return override;
  return { primary: club.color, pattern: 'solid' as ShirtPattern };
}
