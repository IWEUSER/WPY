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

export function qualifierCountFor(_tournament: InternationalTournamentId): number {
  return 5;
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

function pickSpread<T extends { id: string }>(
  source: T[],
  used: Set<string>,
  fallback: T[],
  /** 0 = strongest in the band, 1 = weakest. */
  towardWeaker: number,
  rng?: () => number,
): T | undefined {
  const available = source.filter((n) => !used.has(n.id));
  const pool = available.length > 0 ? available : fallback.filter((n) => !used.has(n.id));
  if (pool.length === 0) return source.find((n) => !used.has(n.id)) ?? fallback.find((n) => !used.has(n.id));
  const jitter = rng ? (rng() - 0.5) * 0.55 : 0;
  const t = Math.min(1, Math.max(0, towardWeaker + jitter));
  const idx = Math.min(pool.length - 1, Math.max(0, Math.round(t * (pool.length - 1))));
  return pool[idx];
}

export interface OpponentPickOptions {
  extraExcludeIds?: string[];
  rng?: () => number;
}

/** Spread opponents across stronger, similar, and weaker sides — not a gauntlet of #1s. */
export function pickMixedRankOpponents(
  nationId: string,
  count: number,
  pool: { id: string; name: string; confederation: Confederation }[],
  options?: OpponentPickOptions,
): { id: string; name: string; confederation: Confederation }[] {
  const exclude = new Set(options?.extraExcludeIds ?? []);
  const filtered = pool.filter((n) => n.id !== nationId && !exclude.has(n.id));
  if (filtered.length === 0 || count <= 0) return [];
  const ranked = [...filtered].sort((a, b) => fifaRank(a.id) - fifaRank(b.id));
  const self = fifaRank(nationId);
  const higher = ranked.filter((n) => fifaRank(n.id) + 5 < self);
  const peers = ranked.filter((n) => Math.abs(fifaRank(n.id) - self) <= 20);
  const lower = ranked.filter((n) => fifaRank(n.id) > self + 12);
  const used = new Set<string>();
  const picks: { id: string; name: string; confederation: Confederation }[] = [];
  // Cycle weaker / peer / stronger, taking a mid-to-low slice of each band
  // so Spain do not only draw France and England.
  const towardWeaker = [0.55, 0.45, 0.25];
  for (let i = 0; i < count; i++) {
    const band = i % 3;
    const source = (band === 0 ? lower : band === 1 ? peers : higher).length > 0
      ? band === 0
        ? lower
        : band === 1
          ? peers
          : higher
      : ranked;
    const pick = pickSpread(source, used, ranked, towardWeaker[band], options?.rng);
    if (pick) {
      used.add(pick.id);
      picks.push(pick);
    }
  }
  return picks;
}

export function qualifierOpponents(
  nationId: string,
  tournament: InternationalTournamentId,
  count?: number,
  options?: OpponentPickOptions,
) {
  const nation = getNation(nationId);
  if (!nation) return [];
  const n = count ?? qualifierCountFor(tournament);
  const pool = nationsInConfederation(nation.confederation).filter((x) => x.id !== nationId);
  let exclude = [...(options?.extraExcludeIds ?? [])];
  let picks = pickMixedRankOpponents(nationId, n, pool, { extraExcludeIds: exclude, rng: options?.rng });
  while (picks.length < n && exclude.length > 0) {
    exclude = exclude.slice(1);
    picks = pickMixedRankOpponents(nationId, n, pool, { extraExcludeIds: exclude, rng: options?.rng });
  }
  if (picks.length < n) {
    picks = pickMixedRankOpponents(nationId, n, pool, { rng: options?.rng });
  }
  return picks;
}

const GROUP_REUSE_KNOCKOUT = new Set<InternationalKnockoutRound>(['semi-final', 'final']);

/** World Cup quarter-finals are FIFA top 16; semi-final and final are top 8. */
export function worldCupKnockoutRankCap(round: InternationalKnockoutRound): number | undefined {
  if (round === 'quarter-final') return 16;
  if (round === 'semi-final' || round === 'final') return 8;
  return undefined;
}

function drawKnockoutOpponents(
  nationId: string,
  rounds: InternationalKnockoutRound[],
  pool: { id: string; name: string; confederation: Confederation }[],
  groupIds: Set<string>,
  options?: { rankCapForRound?: (round: InternationalKnockoutRound) => number | undefined; rng?: () => number },
): { id: string; name: string; confederation: Confederation }[] {
  const used = new Set<string>();
  const picks: { id: string; name: string; confederation: Confederation }[] = [];
  for (const round of rounds) {
    const cap = options?.rankCapForRound?.(round);
    const rankedPool = cap != null ? pool.filter((n) => fifaRank(n.id) <= cap) : pool;
    const roundPool = rankedPool.length > 0 ? rankedPool : pool;
    const allowGroup = GROUP_REUSE_KNOCKOUT.has(round);
    const eligible = roundPool.filter((n) => {
      if (used.has(n.id)) return false;
      if (!allowGroup && groupIds.has(n.id)) return false;
      return true;
    });
    const unusedInCap = roundPool.filter((n) => !used.has(n.id));
    const pickPool =
      eligible.length > 0 ? eligible : unusedInCap.length > 0 ? unusedInCap : roundPool;
    const pick = pickMixedRankOpponents(nationId, 1, pickPool, { rng: options?.rng })[0];
    if (pick) {
      used.add(pick.id);
      picks.push(pick);
    }
  }
  return picks;
}

/** Group then knockout opponents. World Cup mixes confederations; continental stays in-region.
 * Group sides cannot reappear until the semi-final. World Cup QF is top 16 only; SF/final top 8. */
export function tournamentOpponents(
  nationId: string,
  tournament: InternationalTournamentId,
  rng: () => number = Math.random,
) {
  const nation = getNation(nationId);
  if (!nation) return [];
  const groupCount = tournamentGroupGames();
  const knockoutRounds = tournamentKnockoutRounds(tournament);
  const worldPool = NATIONS.filter((n) => n.id !== nationId);
  const regional = nationsInConfederation(nation.confederation).filter((n) => n.id !== nationId);
  const knockoutOpts = {
    rng,
    rankCapForRound: tournament === 'world-cup' ? worldCupKnockoutRankCap : undefined,
  };
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
      const unused = confedList.filter((n) => !used.has(n.id));
      const pick =
        (unused.length > 0 ? unused[Math.floor(rng() * unused.length)] : undefined) ??
        worldPool.find((n) => !used.has(n.id) && (i === 0 ? fifaRank(n.id) > 30 : true));
      if (pick) {
        used.add(pick.id);
        group.push(pick);
      }
    }
    const groupIds = new Set(group.map((n) => n.id));
    return [...group, ...drawKnockoutOpponents(nationId, knockoutRounds, worldPool, groupIds, knockoutOpts)];
  }
  const group = pickMixedRankOpponents(nationId, groupCount, regional, { rng });
  const groupIds = new Set(group.map((n) => n.id));
  return [...group, ...drawKnockoutOpponents(nationId, knockoutRounds, regional, groupIds, { rng })];
}
