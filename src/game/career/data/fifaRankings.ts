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

export function qualifierOpponents(nationId: string, tournament: InternationalTournamentId) {
  const nation = getNation(nationId);
  if (!nation) return [];
  const count = qualifierCountFor(tournament);
  const pool = nationsInConfederation(nation.confederation).filter((n) => n.id !== nationId);
  if (pool.length === 0) return [];
  const selfRank = confederationRank(nationId);
  const higher = pool.filter((n) => confederationRank(n.id) < selfRank);
  const lower = pool.filter((n) => confederationRank(n.id) > selfRank);
  const picks = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const fromHigher = i % 2 === 0 && higher.length > 0;
    const source = fromHigher ? higher : lower.length > 0 ? lower : pool;
    let pick = source.find((n) => !used.has(n.id)) ?? source[i % source.length];
    if (pick && used.has(pick.id)) {
      pick = pool.find((n) => !used.has(n.id)) ?? pick;
    }
    if (pick) {
      used.add(pick.id);
      picks.push(pick);
    }
  }
  return picks;
}

/** Group, semi-final and final opponents. World Cup draws from other confederations; continental tournaments stay in-region. */
export function tournamentOpponents(nationId: string, tournament: InternationalTournamentId) {
  const nation = getNation(nationId);
  if (!nation) return [];
  const count = 3;
  if (tournament === 'world-cup') {
    const confeds: Confederation[] = ['UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];
    const fromOtherConfeds = confeds
      .filter((c) => c !== nation.confederation)
      .map((c) => nationsInConfederation(c)[0])
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
    const rest = NATIONS.filter(
      (n) => n.id !== nationId && !fromOtherConfeds.some((p) => p.id === n.id),
    ).sort((a, b) => fifaRank(a.id) - fifaRank(b.id));
    return [...fromOtherConfeds, ...rest].slice(0, count);
  }
  const pool = nationsInConfederation(nation.confederation).filter((n) => n.id !== nationId);
  return pool.slice(0, count);
}
