import { clampStrength, getClub, promotionTarget, SECOND_DIVISIONS, STRENGTH_CEILING, STRENGTH_FLOOR, type Club, type ClubTier } from './data/clubs';
import {
  averageWageForClubId,
  cheapestListedTopWage,
  starterWageForClubId,
  usesPublishedWages,
} from './data/clubWages';
import { countsTowardCareerRecord, displaySeasonNumber } from './seasonDisplay';
import type { PlayerRole, SeasonRecord, SquadStatus } from './types';

/** 18 at Barcelona with a 0.9 ratio is the €200m anchor. */
export const BARCELONA_ANCHOR_VALUE = 200_000_000;
const ANCHOR_STRENGTH = 91;
const ANCHOR_RATIO = 0.9;

export const TOP_LEAGUES = new Set(['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']);
export const SEMI_EURO_LEAGUES = new Set(['Primeira Liga', 'Eredivisie', 'Super Lig']);

/**
 * How much a league's goals-per-game counts toward market value.
 * A 0.9 in MLS is not treated like a 0.9 in the Premier League.
 */
export function leagueValueWeight(league: string): number {
  if (TOP_LEAGUES.has(league)) return 1;
  if (SEMI_EURO_LEAGUES.has(league)) return 0.55;
  if (league === 'Saudi Pro League') return 0.2;
  if (SECOND_DIVISIONS.has(league)) return 0.4;
  if (league === 'Brasileirao' || league === 'Liga Profesional') return 0.58;
  if (league === 'Liga MX') return 0.32;
  if (league === 'Primera A') return 0.34;
  if (league === 'J1 League') return 0.36;
  if (league === 'MLS') return 0.38;
  return 0.3;
}

/**
 * How much a league's goals-per-game counts toward transfer-offer bands.
 * A 0.81 in the Saudi League is not treated like a 0.81 at Madrid.
 */
export function leagueOfferWeight(league: string): number {
  if (TOP_LEAGUES.has(league)) return 1;
  if (SEMI_EURO_LEAGUES.has(league) && league !== 'Super Lig') return 0.72;
  if (league === 'Super Lig') return 0.62;
  if (league === 'Saudi Pro League') return 0.7;
  if (league === 'Brasileirao' || league === 'Liga Profesional') return 0.7;
  if (league === 'Liga MX') return 0.58;
  if (league === 'Primera A') return 0.56;
  if (league === 'J1 League') return 0.6;
  if (league === 'MLS') return 0.52;
  if (SECOND_DIVISIONS.has(league)) return 0.65;
  return 0.55;
}

export function leagueAdjustedRatio(ratio: number, league: string): number {
  return ratio * leagueValueWeight(league);
}

export function leagueAdjustedOfferRatio(ratio: number, league: string): number {
  return ratio * leagueOfferWeight(league);
}

/**
 * Young peak, then a hard fade from 27 even if the ratio stays elite.
 */
export function ageValueFactor(age: number): number {
  if (age <= 18) return 1;
  if (age <= 21) return 1.04;
  if (age <= 24) return 1;
  if (age <= 26) return 0.94;
  if (age === 27) return 0.8;
  if (age === 28) return 0.68;
  if (age === 29) return 0.56;
  if (age === 30) return 0.46;
  if (age <= 32) return 0.34;
  if (age <= 34) return 0.22;
  return 0.12;
}

export interface MarketValueParams {
  age: number;
  /** First-team career ratio when available, else last season. */
  ratio: number;
  careerGoals: number;
  club: Club;
}

export const DEFAULT_CONTRACT_YEARS = 5;
/** Opening Rising-star deal. European under-18s cannot sign longer than this. */
export const FIRST_CONTRACT_YEARS = 3;
/** Reserve-role offers are shorter than a full first-team deal. */
export const RESERVE_CONTRACT_YEARS = 2;
/** Floor used when a club's starter band is tiny. */
export const RESERVE_WEEKLY_WAGE = 500;
/** Championship / Segunda starters sit well above the €500 reserve floor. */
export const SECOND_DIVISION_STARTER_FLOOR = 8_000;
/** Second-division sides track this share of the parent league's cheapest listed top. */
const SECOND_DIVISION_PARENT_FACTOR = 0.28;
/** Reserve deals pay this fraction of the destination's listed average wage. */
export const RESERVE_WAGE_FACTOR = 0.2;
/** Rising-star first contracts pay this fraction of the club's squad-average wage. */
export const RISING_STAR_WAGE_FACTOR = 0.1;
/** A bid below this share of the asking fee is too cheap to accept. */
export const MIN_ACCEPTED_FEE_RATIO = 0.8;
/** Every loan is one season — never a multi-year loan deal. */
export const YOUTH_LOAN_YEARS = 1;
/** Public Season 1 stays at the youth value in week 1, then updates from week 2. */
export const SEASON_1_VALUE_LOCK_WEEKS = 1;
/** Market-value popups fire the first time the player crosses each mark. */
export const VALUE_MILESTONES = [
  1_000_000,
  10_000_000,
  50_000_000,
  100_000_000,
  200_000_000,
  300_000_000,
  400_000_000,
] as const;
export const YOUTH_MARKET_VALUE = 100_000;
export const SPONSORSHIP_VALUE_FLOOR = 10_000_000;
/** Ignore the live season until it has a real sample, or value swings week to week. */
export const VALUE_FORM_MIN_GAMES = 15;
export const PREMIER_LEAGUE_WAGE_FLOOR = 32_000;

/** Longer deals for teenagers; the max shortens as the player ages. */
export function maxContractYearsForAge(age: number): number {
  if (age >= 34) return 1;
  if (age >= 30) return 2;
  if (age >= 27) return 3;
  if (age >= 25) return 4;
  return DEFAULT_CONTRACT_YEARS;
}

export function newContractYears(age: number): number {
  return maxContractYearsForAge(age);
}

/** Full fee on a 5-year deal; expired / final year is a free transfer. */
export function contractValueFactor(yearsRemaining: number): number {
  if (yearsRemaining >= 5) return 1;
  if (yearsRemaining === 4) return 0.88;
  if (yearsRemaining === 3) return 0.72;
  if (yearsRemaining === 2) return 0.48;
  return 0;
}

/** Only these sides can fund a €200m+ transfer. */
export const MEGA_CLUB_IDS = new Set(['psg', 'real-madrid', 'man-city']);
export const MEGA_TRANSFER_FEE = 180_000_000;
/** Elite clubs do not buy below this market value. */
export const ELITE_TRANSFER_VALUE_FLOOR = 50_000_000;
/** Hard ceiling on what even a mega club will pay — not a cap on the player's value. */
export const MEGA_CLUB_TRANSFER_BUDGET = 250_000_000;

/**
 * Ceiling on what a club will pay, keyed to recent fee ranges:
 * Ajax/PSV-level Eredivisie sides buy in the €15–25m band, not €60m;
 * MLS Designated Player fees sit around €6–12m; 2. Bundesliga mid-table
 * deals are a few million. Player value can sit above this; the bid is
 * min(asking fee, this budget).
 */
/** Twilight Saudi giants can fund a European-star fee. Other SPL sides cannot. */
const SAUDI_GIANT_IDS = new Set(['al-hilal', 'al-nassr', 'al-ittihad', 'al-ahli']);

export function clubTransferBudget(club: Club): number {
  if (MEGA_CLUB_IDS.has(club.id)) return MEGA_CLUB_TRANSFER_BUDGET;
  if (SAUDI_GIANT_IDS.has(club.id)) return 180_000_000;
  const league = club.league;
  if (league === 'MLS') return club.tier <= 3 ? 12_000_000 : 6_000_000;
  if (SEMI_EURO_LEAGUES.has(league)) {
    if (club.tier <= 2) return 22_000_000;
    if (club.tier === 3) return 10_000_000;
    if (club.tier === 4) return 5_000_000;
    return 2_000_000;
  }
  if (league === 'Liga MX' || league === 'J1 League') return club.tier <= 3 ? 10_000_000 : 4_000_000;
  if (league === 'Primera A') return club.tier <= 3 ? 6_000_000 : 2_500_000;
  if (league === 'Brasileirao' || league === 'Liga Profesional') {
    if (club.tier <= 2) return 28_000_000;
    if (club.tier === 3) return 12_000_000;
    return 5_000_000;
  }
  if (league === 'Saudi Pro League') return club.tier <= 2 ? 70_000_000 : 12_000_000;
  if (SECOND_DIVISIONS.has(league)) {
    if (league === 'Championship') return 12_000_000;
    return 5_000_000;
  }
  if (league === 'Premier League') {
    if (club.tier === 1) return 130_000_000;
    if (club.tier === 2) return 50_000_000;
    if (club.tier === 3) return 22_000_000;
    if (club.tier === 4) return 10_000_000;
    return 4_000_000;
  }
  if (club.tier === 1) return 90_000_000;
  if (club.tier === 2) return 35_000_000;
  if (club.tier === 3) return 16_000_000;
  if (club.tier === 4) return 7_000_000;
  return 2_500_000;
}

/** What a buying club would actually pay. Market value itself ignores the deal. */
export function transferFeeFromValue(marketValue: number, yearsRemaining: number): number {
  const factor = contractValueFactor(yearsRemaining);
  if (factor <= 0) return 0;
  return Math.round((marketValue * factor) / 100_000) * 100_000;
}

export function nextContractYearsRemaining(yearsRemaining: number, age: number): number {
  return yearsRemaining <= 1 ? newContractYears(age) : yearsRemaining - 1;
}

/** Loans are always one season, at every age and career stage. */
export function loanContractYearsRemaining(
  _seasonNumber?: number,
  _yearsRemaining?: number,
  _age?: number,
): number {
  return YOUTH_LOAN_YEARS;
}

export function isSeason1ValueLocked(
  seasonNumber?: number,
  calendarWeek?: number,
  opts?: { careerStart?: string | null; role?: PlayerRole },
): boolean {
  if (seasonNumber == null) return false;
  if (displaySeasonNumber(seasonNumber, opts) !== 1) return false;
  return (calendarWeek ?? 99) <= SEASON_1_VALUE_LOCK_WEEKS;
}

/** Boot / shirt money. Big-5 leagues only, and only once value reaches €10m. */
export function seasonalSponsorship(marketValue: number, league?: string | null): number {
  if (!league || !TOP_LEAGUES.has(league)) return 0;
  if (marketValue < SPONSORSHIP_VALUE_FLOOR) return 0;
  const raw = marketValue * 0.04;
  if (raw >= 1_000_000) return Math.round(raw / 100_000) * 100_000;
  if (raw >= 100_000) return Math.round(raw / 10_000) * 10_000;
  return Math.round(raw / 5_000) * 5_000;
}

/** A season under this is a collapse year for value and offer wages. */
export const VALUE_POOR_RATIO = 0.33;

/** Trailing first-team/loan seasons below a goals-per-game bar. */
export function consecutiveSeasonsBelow(seasons: SeasonRecord[], threshold: number): number {
  let n = 0;
  for (let i = seasons.length - 1; i >= 0; i--) {
    const season = seasons[i];
    if (!seasonCountsTowardForm(season)) continue;
    if (!countsTowardCareerRecord(season.seasonNumber, season.role)) continue;
    if (season.gamesPlayed <= 0) continue;
    if (season.goals / season.gamesPlayed < threshold) n += 1;
    else break;
  }
  return n;
}

/**
 * Seven failed seasons under 0.25 cannot leave a former €250m star at €40m.
 * Each extra collapse year compounds.
 */
export function consecutivePoorFactor(failedSeasons: number): number {
  if (failedSeasons <= 0) return 1;
  if (failedSeasons === 1) return 0.5;
  if (failedSeasons === 2) return 0.28;
  if (failedSeasons === 3) return 0.14;
  if (failedSeasons === 4) return 0.08;
  if (failedSeasons === 5) return 0.045;
  if (failedSeasons === 6) return 0.025;
  return 0.015;
}

export function clubStrengthScale(club: Club): number {
  return club.strength / ANCHOR_STRENGTH;
}

/** Club quality times the stature of the league those goals came in.
 * Second divisions use a square-root weight so league stature is not
 * applied twice as harshly as the ratio discount. */
export function clubLeagueScale(club: Club, league?: string | null): number {
  const weight = leagueValueWeight(league ?? club.league);
  return clubStrengthScale(club) * Math.sqrt(weight);
}

/**
 * Floor for a young standout in this division — a Championship golden boot
 * should be the most valuable player in that league, not a €5m afterthought.
 * Exceptional ratio over a long sample can still climb above this.
 */
export function youngDivisionStarFloor(params: {
  age: number;
  league: string;
  seasons: SeasonRecord[];
}): number {
  if (params.age > 24) return 0;
  let divisionGoals = 0;
  let starred = false;
  for (const season of params.seasons) {
    if (!countsTowardCareerRecord(season.seasonNumber, season.role)) continue;
    if (seasonLeague(season) !== params.league) continue;
    divisionGoals += season.goals;
    if (season.topGoalscorer) starred = true;
  }
  const mlsFloor = params.league === 'MLS' && divisionGoals >= 20;
  if (!starred && !mlsFloor && divisionGoals < 40) return 0;
  let base = 8_000_000;
  if (TOP_LEAGUES.has(params.league)) base = 80_000_000;
  else if (SECOND_DIVISIONS.has(params.league)) base = 36_000_000;
  else if (params.league === 'Saudi Pro League') base = 10_000_000;
  else if (params.league === 'Liga MX' || params.league === 'J1 League') base = 14_000_000;
  else if (params.league === 'Brasileirao' || params.league === 'Liga Profesional') base = 22_000_000;
  else if (params.league === 'Primera A') base = 10_000_000;
  else if (params.league === 'MLS') base = 8_000_000 + Math.max(0, divisionGoals - 20) * 250_000;
  return Math.max(100_000, Math.round((base * ageValueFactor(params.age)) / 100_000) * 100_000);
}

/** A 17-year-old scoring in a top division is not a €200k youth. */
export function youngTopFlightSeasonFloor(params: {
  age: number;
  seasons: SeasonRecord[];
}): number {
  if (params.age > 19) return 0;
  let best = 0;
  for (const season of params.seasons) {
    if (!countsTowardCareerRecord(season.seasonNumber, season.role)) continue;
    const league = seasonLeague(season);
    const top = TOP_LEAGUES.has(league);
    const semi = SEMI_EURO_LEAGUES.has(league);
    if (!top && !semi) continue;
    if (season.goals < (top ? 6 : 10)) continue;
    const raw = (top
      ? 6_000_000 + season.goals * 1_400_000
      : 5_000_000 + season.goals * 800_000) * ageValueFactor(params.age);
    best = Math.max(best, raw);
  }
  if (best <= 0) return 0;
  return Math.max(100_000, Math.round(best / 100_000) * 100_000);
}

export function playerMarketValue(params: MarketValueParams): number {
  const { age, ratio, careerGoals, club } = params;
  return valueFromScale(age, leagueAdjustedRatio(ratio, club.league), careerGoals, clubLeagueScale(club));
}

/**
 * Same formula, but club quality is a goal-weighted average of first-team
 * seasons and the ratio is league-weighted so MLS goals count less.
 */
export function seasonCountsTowardForm(season: SeasonRecord): boolean {
  if (!countsTowardCareerRecord(season.seasonNumber, season.role)) return false;
  if (season.gamesPlayed <= 0) return false;
  return season.gamesPlayed >= VALUE_FORM_MIN_GAMES;
}

export function lastSeasonRatio(seasons: SeasonRecord[]): number | null {
  for (let i = seasons.length - 1; i >= 0; i--) {
    const season = seasons[i];
    if (!seasonCountsTowardForm(season)) continue;
    return season.goals / season.gamesPlayed;
  }
  return null;
}

function seasonLeague(season: SeasonRecord, fallbackLeague?: string): string {
  return season.league ?? getClub(season.clubId)?.league ?? fallbackLeague ?? '';
}

/** Last finished season's ratio, scaled so MLS goals count less than Premier League goals. */
export function lastSeasonLeagueAdjustedRatio(seasons: SeasonRecord[]): number | null {
  for (let i = seasons.length - 1; i >= 0; i--) {
    const season = seasons[i];
    if (!seasonCountsTowardForm(season)) continue;
    return leagueAdjustedRatio(season.goals / season.gamesPlayed, seasonLeague(season));
  }
  return null;
}

/**
 * Career ratio with league stature: 20 Premier League goals move the needle
 * more than 20 MLS goals.
 */
export function leagueWeightedCareerRatio(
  seasons: SeasonRecord[],
  careerGoals: number,
  careerGames: number,
): number {
  let weightedGoals = 0;
  let games = 0;
  for (const season of seasons) {
    if (!countsTowardCareerRecord(season.seasonNumber, season.role) || season.gamesPlayed <= 0) continue;
    weightedGoals += season.goals * leagueValueWeight(seasonLeague(season));
    games += season.gamesPlayed;
  }
  if (games > 0) return weightedGoals / games;
  return careerGames > 0 ? careerGoals / careerGames : 0;
}

/**
 * Career ratio is the base. A collapse last season cuts hard, and a second
 * or third blank year compounds via consecutivePoorFactor. A return to
 * form still lifts value back toward the career number.
 */
export function formAdjustedRatio(
  careerRatio: number,
  recentRatio: number | null,
  consecutivePoor = 0,
): number {
  if (recentRatio == null) return careerRatio;
  const recentWeight = Math.min(0.88, 0.6 + consecutivePoor * 0.1);
  const blended = careerRatio * (1 - recentWeight) + recentRatio * recentWeight;
  const collapsed = careerRatio > 0.2 && recentRatio < careerRatio * 0.4;
  return Math.max(0, blended * (collapsed ? 0.55 : 1));
}

export function playerMarketValueFromSeasons(params: {
  age: number;
  careerGoals: number;
  careerGames: number;
  seasons: SeasonRecord[];
  fallbackClub: Club;
  contractYearsRemaining?: number;
  seasonNumber?: number;
  calendarWeek?: number;
  careerStart?: string | null;
  role?: PlayerRole;
}): number {
  if (
    isSeason1ValueLocked(params.seasonNumber, params.calendarWeek, {
      careerStart: params.careerStart,
      role: params.role,
    })
  ) {
    return YOUTH_MARKET_VALUE;
  }
  const { age, fallbackClub } = params;
  let careerGoals = params.careerGoals;
  let careerGames = params.careerGames;
  const lastCounted = [...params.seasons]
    .reverse()
    .find((season) => countsTowardCareerRecord(season.seasonNumber, season.role) && season.gamesPlayed > 0);
  const seasons = params.seasons.filter((season) => {
    if (!countsTowardCareerRecord(season.seasonNumber, season.role)) return true;
    if (season.gamesPlayed >= VALUE_FORM_MIN_GAMES) return true;
    // Live form counts from the first appearance so value can move in week 2.
    if (season === lastCounted && season.gamesPlayed >= 1) return true;
    careerGoals -= season.goals;
    careerGames -= season.gamesPlayed;
    return false;
  });
  const careerRatio = leagueWeightedCareerRatio(seasons, careerGoals, careerGames);
  const poorSeasons = consecutiveSeasonsBelow(seasons, VALUE_POOR_RATIO);
  const ratio = formAdjustedRatio(careerRatio, lastSeasonLeagueAdjustedRatio(seasons), poorSeasons);
  let weighted = 0;
  let weight = 0;
  const counted = seasons.filter((season) => countsTowardCareerRecord(season.seasonNumber, season.role) && season.gamesPlayed > 0);
  counted.forEach((season, index) => {
    const club = getClub(season.clubId);
    if (!club) return;
    const fromEnd = counted.length - index;
    const recency = Math.pow(0.55, Math.max(0, fromEnd - 1));
    const sample = Math.max(season.gamesPlayed, 8);
    weighted += clubLeagueScale(club, seasonLeague(season, club.league)) * sample * recency;
    weight += sample * recency;
  });
  const scale = weight > 0 ? weighted / weight : clubLeagueScale(fallbackClub);
  const weightedGoals = seasons.reduce((sum, season) => {
    if (!countsTowardCareerRecord(season.seasonNumber, season.role) || season.gamesPlayed <= 0) return sum;
    return sum + season.goals * leagueValueWeight(seasonLeague(season));
  }, 0);
  const base = valueFromScale(age, ratio, careerGoals, scale, careerGames, weightedGoals);
  const poor = consecutivePoorFactor(poorSeasons);
  const lastLeague = lastSeasonLeague(seasons) ?? fallbackClub.league;
  const floor = poorSeasons >= 2
    ? 0
    : Math.max(
      youngDivisionStarFloor({ age, league: lastLeague, seasons }),
      youngTopFlightSeasonFloor({ age, seasons }),
    );
  const raw = Math.max(floor, base * poor);
  const capped = Math.min(raw, firstTopFlightValueCap(seasons) ?? raw);
  return Math.max(100_000, Math.round(capped / 100_000) * 100_000);
}

/**
 * One decent top-flight season after a lower-league apprenticeship is not
 * Haaland money. 16 Bundesliga goals after two 2. Liga years should sit
 * in the low-to-mid €20ms, not €60m+.
 */
export function firstTopFlightValueCap(seasons: SeasonRecord[]): number | null {
  const counted = seasons.filter(
    (season) => countsTowardCareerRecord(season.seasonNumber, season.role) && season.gamesPlayed > 0,
  );
  const top = counted.filter((season) => TOP_LEAGUES.has(seasonLeague(season)));
  const lower = counted.filter((season) => !TOP_LEAGUES.has(seasonLeague(season)));
  if (top.length !== 1 || lower.length === 0) return null;
  const goals = top[0].goals;
  return Math.max(8_000_000, Math.round((6_000_000 + goals * 1_150_000) / 100_000) * 100_000);
}

function lastSeasonLeague(seasons: SeasonRecord[]): string | null {
  for (let i = seasons.length - 1; i >= 0; i--) {
    const season = seasons[i];
    if (!countsTowardCareerRecord(season.seasonNumber, season.role)) continue;
    if (season.gamesPlayed <= 0) continue;
    return seasonLeague(season);
  }
  return null;
}

/** Which transfer band a fee belongs in. A €50m+ player can still draw elite clubs. */
export function tierForMarketValue(value: number): ClubTier {
  if (value >= ELITE_TRANSFER_VALUE_FLOOR) return 1;
  if (value >= 28_000_000) return 2;
  if (value >= 12_000_000) return 3;
  if (value >= 4_000_000) return 4;
  return 5;
}

function valueFromScale(
  age: number,
  ratio: number,
  careerGoals: number,
  scale: number,
  careerGames?: number,
  weightedGoals?: number,
): number {
  const ratioScale = Math.max(0.015, ratio / ANCHOR_RATIO);
  const volumeGoals = weightedGoals ?? careerGoals;
  const volume = Math.min(1.12, Math.max(0.18, 0.62 + volumeGoals / 90));
  const proven =
    careerGames != null && careerGames >= 50
      ? Math.min(1.2, 0.9 + (careerGames - 50) / 280)
      : 1;
  /** Appearances-only path: the 200m Barcelona 0.9 anchor stays on playerMarketValue(). */
  const sampleVolume = careerGames != null
    ? Math.min(1.12, Math.max(0.12, 0.34 + volumeGoals / 100))
    : volume;
  const experience = careerGames != null
    ? Math.min(1, 0.22 + careerGames / 95)
    : 1;
  const raw = BARCELONA_ANCHOR_VALUE * scale * ratioScale * ageValueFactor(age) * sampleVolume * proven * experience;
  return Math.max(100_000, Math.round(raw / 100_000) * 100_000);
}

/**
 * Weekly wage. Premier League clubs pay a high English band no matter the
 * club's size. Saudi clubs pay like a top European side; MLS stays below that.
 */
function roundWeeklyWage(amount: number, floor = RESERVE_WEEKLY_WAGE): number {
  return Math.max(floor, Math.round(amount / 500) * 500);
}

function clubLeagueOf(clubId: string): string | undefined {
  return getClub(clubId)?.league;
}

/**
 * Listed starter wage is the 1.0 goals-per-game rate.
 * A 0.66 career ratio is offered 66% of that club's top wage; 1.0 or higher is the full band.
 */
export function wageRatioScale(ratio: number | null | undefined): number {
  if (ratio == null || Number.isNaN(ratio)) return 1;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * Combined goals/game across the last `take` counted seasons.
 * Used as the second wage discount after last-season ratio.
 */
export function recentAggregateRatio(seasons: SeasonRecord[], take = 5): number | null {
  const counted = seasons.filter(
    (season) => countsTowardCareerRecord(season.seasonNumber, season.role) && season.gamesPlayed > 0,
  );
  const slice = counted.slice(-Math.max(1, take));
  const games = slice.reduce((n, season) => n + season.gamesPlayed, 0);
  const goals = slice.reduce((n, season) => n + season.goals, 0);
  if (games <= 0) return null;
  return goals / games;
}

/** Counted seasons needed before last-five aggregate can stand in for a career. */
export const WAGE_AGGREGATE_SEASONS = 5;

/**
 * Short-career pay: one hot year is not five years of listed form.
 * 1 season 50%, then 60 / 70 / 80, and 100% once five counted seasons exist.
 */
export function wageCareerMaturityScale(countedSeasonsCompleted: number): number {
  const n = Math.max(0, Math.floor(countedSeasonsCompleted));
  if (n >= WAGE_AGGREGATE_SEASONS) return 1;
  if (n === 4) return 0.8;
  if (n === 3) return 0.7;
  if (n === 2) return 0.6;
  if (n === 1) return 0.5;
  return 0.5;
}

/**
 * Strong clubs pay on the player's aggregate ratio — a one-season slump is
 * an opportunity, not a 90% wage cut. A second blank year discounts further.
 * One counted season still uses last-season × short-career maturity so a
 * single hot year cannot claim a five-year listed wage.
 */
export function wagePoorFactor(consecutivePoor = 0): number {
  if (consecutivePoor <= 0) return 1;
  if (consecutivePoor === 1) return 0.88;
  if (consecutivePoor === 2) return 0.52;
  return 0.35;
}

export function wageOfferScale(
  lastSeasonRatio: number | null | undefined,
  countedSeasonsCompleted?: number,
  aggregateRatio?: number | null,
  consecutivePoor = 0,
): number {
  const last = wageRatioScale(lastSeasonRatio);
  const seasons = Math.max(0, Math.floor(countedSeasonsCompleted ?? 0));
  const poor = wagePoorFactor(consecutivePoor);
  if (seasons < 2) {
    return last * wageCareerMaturityScale(seasons);
  }
  const aggregate = aggregateRatio == null ? null : wageRatioScale(aggregateRatio);
  if (aggregate == null) return last * last * poor;
  if (aggregate <= 0) return last * 0.5;
  return aggregate * poor;
}

export function countedSeasonsCompleted(seasons: SeasonRecord[]): number {
  return seasons.filter((season) => countsTowardCareerRecord(season.seasonNumber, season.role)).length;
}

/** Scale a club's listed wage by goals-per-game, capped at 1.0. */
export function weeklyWageForRatio(
  club: Club,
  marketValue: number,
  ratio: number | null | undefined,
  status: SquadStatus,
  playingLeague?: string | null,
): number {
  const top = weeklyWageForSquadStatus(club, marketValue, status, playingLeague);
  if (status !== 'starter') return top;
  const league = playingLeague ?? club.league;
  const floor = SECOND_DIVISIONS.has(league ?? '') ? SECOND_DIVISION_STARTER_FLOOR : RESERVE_WEEKLY_WAGE;
  return roundWeeklyWage(top * wageRatioScale(ratio), floor);
}

/** Incoming transfer / loan offer: aggregate ratio of the listed 1.0 wage. */
export function weeklyWageForTransferOffer(
  club: Club,
  marketValue: number,
  lastSeasonRatio: number | null | undefined,
  countedSeasonsCompleted: number,
  status: SquadStatus,
  playingLeague?: string | null,
  aggregateRatio?: number | null,
  consecutivePoor = 0,
): number {
  const top = weeklyWageForSquadStatus(club, marketValue, status, playingLeague);
  if (status !== 'starter') return top;
  const league = playingLeague ?? club.league;
  const floor = SECOND_DIVISIONS.has(league ?? '') ? SECOND_DIVISION_STARTER_FLOOR : RESERVE_WEEKLY_WAGE;
  return roundWeeklyWage(
    top * wageOfferScale(lastSeasonRatio, countedSeasonsCompleted, aggregateRatio, consecutivePoor),
    floor,
  );
}

/** Starter, Rising star, and reserve wages so transfer offers are not all the same band. */
export function weeklyWageForSquadStatus(
  club: Club,
  marketValue: number,
  status: SquadStatus,
  playingLeague?: string | null,
): number {
  const league = playingLeague ?? club.league;
  if (status === 'rising-star' && usesPublishedWages(league)) {
    const average = averageWageForClubId(club.id, league, clubLeagueOf);
    if (average != null) {
      return roundWeeklyWage(average * RISING_STAR_WAGE_FACTOR);
    }
  }
  if (status === 'reserve' && usesPublishedWages(league)) {
    const average = averageWageForClubId(club.id, league, clubLeagueOf);
    if (average != null) {
      return roundWeeklyWage(average * RESERVE_WAGE_FACTOR);
    }
  }
  const full = weeklyWageForClub(club, marketValue, playingLeague);
  if (status === 'reserve') {
    return roundWeeklyWage(full * RESERVE_WAGE_FACTOR);
  }
  if (status === 'rising-star' || status === 'impact') {
    return roundWeeklyWage(full * RISING_STAR_WAGE_FACTOR);
  }
  return full;
}

/**
 * Season 1 place-pick wages. Starter is the club's average weekly wage, not
 * the listed maximum used later for 1.0-ratio renewals and transfers.
 */
export function openingWeeklyWageForSquadStatus(
  club: Club,
  marketValue: number,
  status: SquadStatus,
  playingLeague?: string | null,
): number {
  if (status === 'starter') {
    const league = playingLeague ?? club.league;
    const average = averageWageForClubId(club.id, league, clubLeagueOf);
    if (average != null) {
      const floor = SECOND_DIVISIONS.has(league ?? '')
        ? SECOND_DIVISION_STARTER_FLOOR
        : club.tier >= 5
          ? 500
          : club.tier >= 4
            ? 800
            : 1_200;
      return roundWeeklyWage(average, floor);
    }
  }
  return weeklyWageForSquadStatus(club, marketValue, status, playingLeague);
}

export function weeklyWageForClub(club: Club, marketValue: number, playingLeague?: string | null): number {
  const league = playingLeague ?? club.league;
  if (SECOND_DIVISIONS.has(league)) {
    const t = (clampStrength(club.strength) - STRENGTH_FLOOR) / (STRENGTH_CEILING - STRENGTH_FLOOR);
    const parent = promotionTarget(league);
    const parentCheapest = parent ? cheapestListedTopWage(parent, clubLeagueOf) : null;
    const base = Math.max(12_000, (parentCheapest ?? 40_000) * SECOND_DIVISION_PARENT_FACTOR);
    const wage = base * (0.75 + 0.4 * t);
    return Math.max(SECOND_DIVISION_STARTER_FLOOR, Math.round(wage / 500) * 500);
  }
  if (usesPublishedWages(league)) {
    const listed = starterWageForClubId(club.id, league, clubLeagueOf);
    if (listed != null) return roundWeeklyWage(listed, club.tier >= 5 ? 500 : club.tier >= 4 ? 800 : 1_200);
  }
  const t = (clampStrength(club.strength) - 52) / 42;
  if (league === 'Premier League') {
    const plBase: Record<ClubTier, number> = {
      1: 130_000,
      2: 85_000,
      3: 58_000,
      4: 42_000,
      5: 36_000,
    };
    let wage = plBase[club.tier] * (0.85 + 0.35 * t);
    wage += marketValue * 0.0001;
    return Math.max(PREMIER_LEAGUE_WAGE_FLOOR, Math.round(wage / 500) * 500);
  }
  const tierBase: Record<ClubTier, number> = {
    1: 95_000,
    2: 22_000,
    3: 7_500,
    4: 2_200,
    5: 800,
  };
  let wage = tierBase[club.tier] * (0.7 + 0.6 * t);
  if (club.country === 'Saudi Arabia' || league === 'Saudi Pro League') {
    const saudiBase: Record<ClubTier, number> = {
      1: 48_000,
      2: 36_000,
      3: 26_000,
      4: 16_000,
      5: 9_000,
    };
    wage = saudiBase[club.tier] * (0.85 + 0.35 * t);
  }
  if (league === 'MLS') {
    const mlsBase: Record<ClubTier, number> = {
      1: 28_000,
      2: 22_000,
      3: 16_000,
      4: 10_000,
      5: 6_000,
    };
    wage = mlsBase[club.tier] * (0.85 + 0.35 * t);
  }
  const prestigeRate = club.tier === 1 ? 0.00016 : club.tier === 2 ? 0.00004 : 0.000012;
  wage += marketValue * prestigeRate;
  const floor = league === 'MLS'
    ? (club.tier >= 4 ? 4_000 : 8_000)
    : club.tier >= 5 ? 500 : club.tier >= 4 ? 800 : 1_200;
  return Math.max(floor, Math.round(wage / 500) * 500);
}

export function formatEuros(amount: number): string {
  if (amount >= 10_000_000) return `€${Math.round(amount / 1_000_000)}m`;
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}m`;
  if (amount >= 1_000) return `€${Math.round(amount / 1_000)}k`;
  return `€${amount}`;
}

export function formatWeeklyWage(amount: number): string {
  return `${formatEuros(amount)}/week`;
}
