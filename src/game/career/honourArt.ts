/** Illustrated award / trophy art shown on beat and title-win screens. */

export type HonourArtKind =
  | 'golden-boot'
  | 'golden-ball'
  | 'player-award'
  | 'european-cup'
  | 'world-cup'
  | 'nations-cup'
  | 'league-trophy'
  | 'domestic-cup';

export const HONOUR_ART_SRC: Record<HonourArtKind, string> = {
  'golden-boot': '/honours/honour-golden-boot.jpg',
  'golden-ball': '/honours/honour-golden-ball.jpg',
  'player-award': '/honours/honour-player-award.jpg',
  'european-cup': '/honours/honour-european-cup.jpg',
  'world-cup': '/honours/honour-world-cup.jpg',
  'nations-cup': '/honours/honour-nations-cup.jpg',
  'league-trophy': '/honours/honour-league-trophy.jpg',
  'domestic-cup': '/honours/honour-domestic-cup.jpg',
};

const CLUB_CONTINENTAL = new Set([
  'European Cup',
  'European Trophy',
  'European Challenge',
  'Asian Club Cup',
  'North American Cup',
  'European Super Cup',
]);

/** Pick the illustration that looks like this honour. */
export function honourArtKind(name: string | null | undefined): HonourArtKind {
  const n = (name ?? '').trim();
  if (!n) return 'league-trophy';
  if (/top goalscorer/i.test(n)) return 'golden-boot';
  if (/World Player of the Year/i.test(n)) return 'golden-ball';
  if (/Player of the (Year|Tournament)/i.test(n)) return 'player-award';
  if (n === 'World Championship' || n.startsWith('World Championship ')) return 'world-cup';
  if (CLUB_CONTINENTAL.has(n)) return 'european-cup';
  if (
    n === 'Nations Cup'
    || n === 'European Nations Cup'
    || n === 'South American Championship'
    || n === 'North American Championship'
    || n === 'African Championship'
    || n === 'Asian Championship'
    || n === 'Oceania Championship'
    || n === 'Continental Championship'
  ) {
    return 'nations-cup';
  }
  if (n === 'American League Cup') return 'league-trophy';
  if (/Cup$/.test(n)) return 'domestic-cup';
  return 'league-trophy';
}

export function honourArtSrc(name: string | null | undefined): string {
  return HONOUR_ART_SRC[honourArtKind(name)];
}
