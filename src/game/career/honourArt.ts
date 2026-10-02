/** Illustrated award / trophy art shown on beat and title-win screens. */

export type HonourArtKind =
  | 'golden-boot'
  | 'golden-ball'
  | 'ballon-dor'
  | 'player-award'
  | 'european-cup'
  | 'europa-league'
  | 'conference-league'
  | 'afc-club-cup'
  | 'leagues-cup'
  | 'super-cup'
  | 'world-cup'
  | 'nations-cup'
  | 'euro'
  | 'copa-america'
  | 'gold-cup'
  | 'afcon'
  | 'asian-cup'
  | 'ofc-cup'
  | 'english-league'
  | 'championship'
  | 'spanish-league'
  | 'italian-league'
  | 'german-league'
  | 'french-league'
  | 'portuguese-league'
  | 'dutch-league'
  | 'turkish-league'
  | 'saudi-league'
  | 'mls-cup'
  | 'liga-mx'
  | 'league-trophy'
  | 'fa-cup'
  | 'copa-del-rey'
  | 'coppa-italia'
  | 'dfb-pokal'
  | 'coupe-de-france'
  | 'domestic-cup';

export const HONOUR_ART_SRC: Record<HonourArtKind, string> = {
  'golden-boot': '/honours/honour-golden-boot.jpg',
  'golden-ball': '/honours/honour-golden-ball.jpg',
  'ballon-dor': '/honours/honour-ballon-dor.jpg',
  'player-award': '/honours/honour-player-award.jpg',
  'european-cup': '/honours/honour-european-cup.jpg',
  'europa-league': '/honours/honour-europa.jpg',
  'conference-league': '/honours/honour-conference.jpg',
  'afc-club-cup': '/honours/honour-afc-cl.jpg',
  'leagues-cup': '/honours/honour-leagues-cup.jpg',
  'super-cup': '/honours/honour-super-cup.jpg',
  'world-cup': '/honours/honour-world-cup.jpg',
  'nations-cup': '/honours/honour-nations-cup.jpg',
  'euro': '/honours/honour-euro.jpg',
  'copa-america': '/honours/honour-copa-america.jpg',
  'gold-cup': '/honours/honour-gold-cup.jpg',
  'afcon': '/honours/honour-afcon.jpg',
  'asian-cup': '/honours/honour-asian-cup.jpg',
  'ofc-cup': '/honours/honour-ofc.jpg',
  'english-league': '/honours/honour-english-league.jpg',
  'championship': '/honours/honour-championship.jpg',
  'spanish-league': '/honours/honour-spanish-league.jpg',
  'italian-league': '/honours/honour-italian-league.jpg',
  'german-league': '/honours/honour-german-league.jpg',
  'french-league': '/honours/honour-french-league.jpg',
  'portuguese-league': '/honours/honour-portuguese-league.jpg',
  'dutch-league': '/honours/honour-dutch-league.jpg',
  'turkish-league': '/honours/honour-turkish-league.jpg',
  'saudi-league': '/honours/honour-saudi-league.jpg',
  'mls-cup': '/honours/honour-mls-cup.jpg',
  'liga-mx': '/honours/honour-liga-mx.jpg',
  'league-trophy': '/honours/honour-league-trophy.jpg',
  'fa-cup': '/honours/honour-fa-cup.jpg',
  'copa-del-rey': '/honours/honour-copa-del-rey.jpg',
  'coppa-italia': '/honours/honour-coppa-italia.jpg',
  'dfb-pokal': '/honours/honour-dfb-pokal.jpg',
  'coupe-de-france': '/honours/honour-coupe-de-france.jpg',
  'domestic-cup': '/honours/honour-domestic-cup.jpg',
};

const TITLE_KIND: Record<string, HonourArtKind> = {
  'English League': 'english-league',
  'English Championship': 'championship',
  Championship: 'championship',
  'Spanish League': 'spanish-league',
  'Spanish Second': 'spanish-league',
  'Italian League': 'italian-league',
  'Italian Second': 'italian-league',
  'German League': 'german-league',
  'German Second': 'german-league',
  'French League': 'french-league',
  'French Second': 'french-league',
  'Portuguese League': 'portuguese-league',
  'Dutch League': 'dutch-league',
  'Turkish League': 'turkish-league',
  'Saudi League': 'saudi-league',
  'American League': 'mls-cup',
  'American League Cup': 'mls-cup',
  'Mexican League': 'liga-mx',
  'Brazilian League': 'league-trophy',
  'Argentine League': 'league-trophy',
  'Colombian League': 'league-trophy',
  'Japanese League': 'league-trophy',
  'South American Cup': 'copa-america',
  'South American Trophy': 'copa-america',
  'European Cup': 'european-cup',
  'European Trophy': 'europa-league',
  'European Challenge': 'conference-league',
  'Asian Club Cup': 'afc-club-cup',
  'North American Cup': 'leagues-cup',
  'European Super Cup': 'super-cup',
  'World Championship': 'world-cup',
  'Nations Cup': 'nations-cup',
  'European Nations Cup': 'euro',
  'South American Championship': 'copa-america',
  'North American Championship': 'gold-cup',
  'African Championship': 'afcon',
  'Asian Championship': 'asian-cup',
  'Oceania Championship': 'ofc-cup',
  'Continental Championship': 'nations-cup',
  'English Cup': 'fa-cup',
  'Spanish Cup': 'copa-del-rey',
  'Italian Cup': 'coppa-italia',
  'German Cup': 'dfb-pokal',
  'French Cup': 'coupe-de-france',
  'Portuguese Cup': 'domestic-cup',
  'Dutch Cup': 'domestic-cup',
  'Turkish Cup': 'domestic-cup',
  'Saudi Cup': 'domestic-cup',
  'American Cup': 'domestic-cup',
  'Mexican Cup': 'domestic-cup',
  'Brazilian Cup': 'domestic-cup',
  'Argentine Cup': 'domestic-cup',
  'Colombian Cup': 'domestic-cup',
  'Japanese Cup': 'domestic-cup',
};

/** Pick the illustration that looks like this honour. */
export function honourArtKind(name: string | null | undefined): HonourArtKind {
  const n = (name ?? '').trim();
  if (!n) return 'league-trophy';
  if (/top goalscorer/i.test(n)) return 'golden-boot';
  if (/World Player of the Year/i.test(n)) return 'ballon-dor';
  if (/Player of the Tournament/i.test(n)) return 'golden-ball';
  if (/Player of the Year/i.test(n)) return 'player-award';
  const exact = TITLE_KIND[n];
  if (exact) return exact;
  const prefix = Object.keys(TITLE_KIND).find((key) => n.startsWith(`${key} `));
  if (prefix) return TITLE_KIND[prefix]!;
  if (/Super Cup$/i.test(n)) return 'super-cup';
  if (/Cup$/.test(n)) return 'domestic-cup';
  return 'league-trophy';
}

export function honourArtSrc(name: string | null | undefined): string {
  return HONOUR_ART_SRC[honourArtKind(name)];
}
