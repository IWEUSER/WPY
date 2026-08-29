import type { Confederation, InternationalTournamentId } from './competitions';
import { NATIONS, getNation } from './nations';

/**
 * FIFA men's ranking order (1 = world number 1), seeded from a recent
 * snapshot and then filled with the remaining member associations so every
 * nation in `NATIONS` has a stable rank.
 */
const FIFA_RANK_ORDER: string[] = [
  'argentina',
  'france',
  'spain',
  'england',
  'brazil',
  'belgium',
  'netherlands',
  'portugal',
  'colombia',
  'italy',
  'germany',
  'uruguay',
  'croatia',
  'morocco',
  'united-states',
  'mexico',
  'switzerland',
  'japan',
  'senegal',
  'iran',
  'denmark',
  'austria',
  'south-korea',
  'australia',
  'ukraine',
  'turkey',
  'sweden',
  'wales',
  'poland',
  'serbia',
  'hungary',
  'czechia',
  'nigeria',
  'ecuador',
  'egypt',
  'algeria',
  'tunisia',
  'canada',
  'scotland',
  'norway',
  'greece',
  'romania',
  'ivory-coast',
  'cameroon',
  'mali',
  'chile',
  'peru',
  'venezuela',
  'paraguay',
  'qatar',
  'saudi-arabia',
  'panama',
  'costa-rica',
  'jamaica',
  'ghana',
  'south-africa',
  'dr-congo',
  'burkina-faso',
  'slovakia',
  'slovenia',
  'republic-of-ireland',
  'northern-ireland',
  'finland',
  'bosnia-and-herzegovina',
  'albania',
  'north-macedonia',
  'iceland',
  'israel',
  'georgia',
  'uzbekistan',
  'iraq',
  'united-arab-emirates',
  'oman',
  'jordan',
  'china-pr',
  'bolivia',
  'new-zealand',
  'cape-verde',
  'guinea',
  'equatorial-guinea',
  'russia',
  'montenegro',
  'kosovo',
  'armenia',
  'belarus',
  'bulgaria',
  'cyprus',
  'estonia',
  'faroe-islands',
  'kazakhstan',
  'latvia',
  'lithuania',
  'luxembourg',
  'malta',
  'moldova',
  'azerbaijan',
  'honduras',
  'el-salvador',
  'haiti',
  'guatemala',
  'trinidad-and-tobago',
  'curacao',
  'nicaragua',
  'suriname',
  'angola',
  'gabon',
  'zambia',
  'uganda',
  'benin',
  'mozambique',
  'madagascar',
  'kenya',
  'togo',
  'mauritania',
  'namibia',
  'libya',
  'bahrain',
  'syria',
  'palestine',
  'thailand',
  'vietnam',
  'kyrgyzstan',
  'tajikistan',
  'north-korea',
  'india',
  'indonesia',
  'malaysia',
  'lebanon',
  'fiji',
  'solomon-islands',
  'tahiti',
  'new-caledonia',
  'papua-new-guinea',
  'vanuatu',
  'andorra',
  'gibraltar',
  'liechtenstein',
  'san-marino',
];

/** World Cup finals berths by confederation (2026-style allocation, simplified). */
export const WORLD_CUP_SLOTS: Record<Confederation, number> = {
  UEFA: 16,
  CAF: 9,
  AFC: 8,
  CONMEBOL: 6,
  CONCACAF: 6,
  OFC: 1,
};

/** Continental championship berths. */
export const CONTINENTAL_SLOTS: Record<Confederation, number> = {
  UEFA: 24,
  CONMEBOL: 10,
  CONCACAF: 16,
  CAF: 24,
  AFC: 24,
  OFC: 8,
};

const RANK_BY_ID: Map<string, number> = (() => {
  const map = new Map<string, number>();
  let rank = 1;
  for (const id of FIFA_RANK_ORDER) {
    if (getNation(id) && !map.has(id)) map.set(id, rank++);
  }
  for (const nation of NATIONS) {
    if (!map.has(nation.id)) map.set(nation.id, rank++);
  }
  return map;
})();

export function fifaRank(nationId: string): number {
  return RANK_BY_ID.get(nationId) ?? 211;
}

/** Squad quality used by the international match engine. Rank 1 ≈ 95, rank 211 ≈ 50. */
export function nationStrength(nationId: string): number {
  const rank = fifaRank(nationId);
  const t = Math.log(rank) / Math.log(Math.max(2, NATIONS.length));
  return Math.round((95 - t * 45) * 10) / 10;
}

export function nationsInConfederation(confederation: Confederation) {
  return NATIONS.filter((n) => n.confederation === confederation).sort(
    (a, b) => fifaRank(a.id) - fifaRank(b.id),
  );
}

export function confederationRank(nationId: string): number {
  const nation = getNation(nationId);
  if (!nation) return 999;
  return nationsInConfederation(nation.confederation).findIndex((n) => n.id === nationId) + 1;
}

export function slotsForTournament(tournament: InternationalTournamentId, confederation: Confederation): number {
  if (tournament === 'world-cup') return WORLD_CUP_SLOTS[confederation];
  return CONTINENTAL_SLOTS[confederation];
}

export function qualifierCountFor(tournament: InternationalTournamentId): number {
  if (tournament === 'copa-america' || tournament === 'gold-cup' || tournament === 'ofc-nations-cup') return 4;
  return 6;
}

export type InternationalKnockoutRound =
  | 'round-of-32'
  | 'round-of-16'
  | 'quarter-final'
  | 'semi-final'
  | 'final';

/** World Cup: last 32 through the final. Continental: last 16 through the final. */
export function tournamentKnockoutRounds(tournament: InternationalTournamentId): InternationalKnockoutRound[] {
  if (tournament === 'world-cup') {
    return ['round-of-32', 'round-of-16', 'quarter-final', 'semi-final', 'final'];
  }
  return ['round-of-16', 'quarter-final', 'semi-final', 'final'];
}

export function tournamentGroupGames(): number {
  return 3;
}

/**
 * Whether the player's country reaches the finals, combining FIFA ranking
 * (how many berths that confederation has) with qualifying-form points.
 */
export function doesNationQualify(
  nationId: string,
  tournament: InternationalTournamentId,
  points: number,
  played: number,
): boolean {
  const nation = getNation(nationId);
  if (!nation || played <= 0) return false;
  const slots = slotsForTournament(tournament, nation.confederation);
  const rank = confederationRank(nationId);
  const maxPoints = played * 3;
  if (rank <= slots) return points >= Math.max(1, Math.ceil(maxPoints * 0.2));
  if (rank <= slots + 3) return points >= Math.ceil(maxPoints * 0.55);
  return points >= Math.ceil(maxPoints * 0.8);
}

function pickFrom<T extends { id: string }>(source: T[], used: Set<string>, fallback: T[]): T | undefined {
  return source.find((n) => !used.has(n.id)) ?? fallback.find((n) => !used.has(n.id)) ?? source[0] ?? fallback[0];
}

/** Spread opponents across stronger, similar, and weaker sides — not a gauntlet of #1s. */
export function pickMixedRankOpponents(
  nationId: string,
  count: number,
  pool: { id: string; name: string; confederation: Confederation }[],
): { id: string; name: string; confederation: Confederation }[] {
  if (pool.length === 0 || count <= 0) return [];
  const self = fifaRank(nationId);
  const higher = pool.filter((n) => fifaRank(n.id) + 5 < self);
  const peers = pool.filter((n) => Math.abs(fifaRank(n.id) - self) <= 20);
  const lower = pool.filter((n) => fifaRank(n.id) > self + 12);
  const bands = [lower, peers, higher, pool];
  const used = new Set<string>();
  const picks: { id: string; name: string; confederation: Confederation }[] = [];
  for (let i = 0; i < count; i++) {
    const source = bands[i % 3].length > 0 ? bands[i % 3] : pool;
    const pick = pickFrom(source, used, pool);
    if (pick) {
      used.add(pick.id);
      picks.push(pick);
    }
  }
  return picks;
}

export function qualifierOpponents(nationId: string, tournament: InternationalTournamentId, count?: number) {
  const nation = getNation(nationId);
  if (!nation) return [];
  const n = count ?? qualifierCountFor(tournament);
  const pool = nationsInConfederation(nation.confederation).filter((x) => x.id !== nationId);
  return pickMixedRankOpponents(nationId, n, pool);
}

/** Group then knockout opponents. World Cup mixes confederations; continental stays in-region. */
export function tournamentOpponents(nationId: string, tournament: InternationalTournamentId) {
  const nation = getNation(nationId);
  if (!nation) return [];
  const groupCount = tournamentGroupGames();
  const knockoutCount = tournamentKnockoutRounds(tournament).length;
  const worldPool = NATIONS.filter((n) => n.id !== nationId);
  const regional = nationsInConfederation(nation.confederation).filter((n) => n.id !== nationId);
  if (tournament === 'world-cup') {
    const confeds: Confederation[] = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];
    const byConfed = confeds
      .filter((c) => c !== nation.confederation)
      .map((c) => nationsInConfederation(c))
      .filter((list) => list.length > 0);
    const group: typeof worldPool = [];
    const used = new Set<string>();
    const bandFor = (i: number) => {
      const lists = byConfed.map((list) => {
        if (i === 0) return list.filter((n) => fifaRank(n.id) > 40);
        if (i === 1) return list.filter((n) => fifaRank(n.id) > 15 && fifaRank(n.id) <= 60);
        return list.filter((n) => fifaRank(n.id) <= 25);
      });
      return lists;
    };
    for (let i = 0; i < groupCount; i++) {
      const bands = bandFor(i);
      const confedList = bands[i % Math.max(1, bands.length)] ?? [];
      const pick =
        confedList.find((n) => !used.has(n.id)) ??
        worldPool.find((n) => !used.has(n.id) && (i === 0 ? fifaRank(n.id) > 30 : true));
      if (pick) {
        used.add(pick.id);
        group.push(pick);
      }
    }
    const remaining = worldPool.filter((n) => !used.has(n.id));
    return [...group, ...pickMixedRankOpponents(nationId, knockoutCount, remaining)];
  }
  return [
    ...pickMixedRankOpponents(nationId, groupCount, regional),
    ...pickMixedRankOpponents(nationId, knockoutCount, regional),
  ];
}
