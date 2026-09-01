import { clampStrength, getClub, SECOND_DIVISIONS, type Club, type ClubTier } from './data/clubs';
import { countsTowardCareerRecord, displaySeasonNumber } from './seasonDisplay';
import type { PlayerRole, SeasonRecord } from './types';

/** 18 at Barcelona with a 0.9 ratio is the €200m anchor. */
export const BARCELONA_ANCHOR_VALUE = 200_000_000;
const ANCHOR_STRENGTH = 91;
const ANCHOR_RATIO = 0.9;

const TOP_LEAGUES = new Set(['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']);

/**
 * How much a league's goals-per-game counts toward market value.
 * A 0.9 in MLS is not treated like a 0.9 in the Premier League.
 */
export function leagueValueWeight(league: string): number {
  if (TOP_LEAGUES.has(league)) return 1;
  if (league === 'Saudi Pro League') return 0.42;
  if (SECOND_DIVISIONS.has(league)) return 0.4;
  if (league === 'Liga MX') return 0.32;
  if (league === 'MLS') return 0.22;
  return 0.3;
}

export function leagueAdjustedRatio(ratio: number, league: string): number {
  return ratio * leagueValueWeight(league);
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
/** First professional contract (trial signing and first-team promotion). */
export const FIRST_CONTRACT_YEARS = 2;
export const RESERVE_CONTRACT_YEARS = FIRST_CONTRACT_YEARS;
/** Academy / reserve wage — the same on every path. */
export const RESERVE_WEEKLY_WAGE = 1000;
/** Reserve-year and public-season-1 loans stay one year. */
export const YOUTH_LOAN_YEARS = 1;
/** Public Season 1 stays at the youth value until week 21, on every career path. */
export const SEASON_1_VALUE_LOCK_WEEKS = 20;
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

export function clubTransferBudget(club: Club): number {
  if (MEGA_CLUB_IDS.has(club.id)) return 260_000_000;
  if (club.tier === 1) return 130_000_000;
  if (club.tier === 2) return 60_000_000;
  if (club.tier === 3) return 25_000_000;
  if (club.tier === 4) return 8_000_000;
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

/** Reserve year and the first public season on loan are always one-year deals. */
export function loanContractYearsRemaining(
  seasonNumber: number,
  yearsRemaining: number,
  age: number,
): number {
  if (seasonNumber <= 2) return YOUTH_LOAN_YEARS;
  return nextContractYearsRemaining(yearsRemaining, age);
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
  if (failedSeasons === 1) return 0.62;
  if (failedSeasons === 2) return 0.36;
  if (failedSeasons === 3) return 0.2;
  if (failedSeasons === 4) return 0.11;
  if (failedSeasons === 5) return 0.06;
  if (failedSeasons === 6) return 0.035;
  return 0.02;
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
  if (!starred && divisionGoals < 40) return 0;
  let base = 8_000_000;
  if (TOP_LEAGUES.has(params.league)) base = 80_000_000;
  else if (SECOND_DIVISIONS.has(params.league)) base = 36_000_000;
  else if (params.league === 'Saudi Pro League') base = 18_000_000;
  else if (params.league === 'Liga MX' || params.league === 'MLS') base = 14_000_000;
  return Math.max(100_000, Math.round((base * ageValueFactor(params.age)) / 100_000) * 100_000);
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
 * Career ratio is the base. A collapse last season cuts the figure hard,
 * but a 0.08 year cannot wipe a 0.80 career down to the bottom of the market.
 */
export function formAdjustedRatio(careerRatio: number, recentRatio: number | null): number {
  if (recentRatio == null) return careerRatio;
  const blended = careerRatio * 0.65 + recentRatio * 0.35;
  const collapsed = careerRatio > 0.2 && recentRatio < careerRatio * 0.4;
  return Math.max(0, blended * (collapsed ? 0.7 : 1));
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
  const seasons = params.seasons.filter((season) => {
    if (!countsTowardCareerRecord(season.seasonNumber, season.role)) return true;
    if (season.gamesPlayed >= VALUE_FORM_MIN_GAMES) return true;
    careerGoals -= season.goals;
    careerGames -= season.gamesPlayed;
    return false;
  });
  const careerRatio = leagueWeightedCareerRatio(seasons, careerGoals, careerGames);
  const ratio = formAdjustedRatio(careerRatio, lastSeasonLeagueAdjustedRatio(seasons));
  let weighted = 0;
  let weight = 0;
  for (const season of seasons) {
    if (!countsTowardCareerRecord(season.seasonNumber, season.role)) continue;
    const club = getClub(season.clubId);
    if (!club || season.goals <= 0) continue;
    weighted += clubLeagueScale(club, seasonLeague(season, club.league)) * season.goals;
    weight += season.goals;
  }
  const scale = weight > 0 ? weighted / weight : clubLeagueScale(fallbackClub);
  const base = valueFromScale(age, ratio, careerGoals, scale, careerGames);
  const poor = consecutivePoorFactor(consecutiveSeasonsBelow(seasons, 0.25));
  const lastLeague = lastSeasonLeague(seasons) ?? fallbackClub.league;
  const floor = youngDivisionStarFloor({ age, league: lastLeague, seasons });
  const raw = Math.max(floor, base * poor);
  return Math.max(100_000, Math.round(raw / 100_000) * 100_000);
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

/** Which transfer band a fee belongs in. A €100m+ player is never tier 5. */
export function tierForMarketValue(value: number): ClubTier {
  if (value >= 70_000_000) return 1;
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
): number {
  const ratioScale = Math.max(0.015, ratio / ANCHOR_RATIO);
  const volume = Math.min(1.15, Math.max(0.18, 0.7 + careerGoals / 70));
  const proven =
    careerGames != null && careerGames >= 50
      ? Math.min(1.35, 0.92 + (careerGames - 50) / 200)
      : 1;
  const raw = BARCELONA_ANCHOR_VALUE * scale * ratioScale * ageValueFactor(age) * volume * proven;
  return Math.max(100_000, Math.round(raw / 100_000) * 100_000);
}

/**
 * Weekly wage. Premier League clubs pay a high English band no matter the
 * club's size. Saudi clubs pay like a top European side; MLS stays below that.
 */
export function weeklyWageForClub(club: Club, marketValue: number, playingLeague?: string | null): number {
  const league = playingLeague ?? club.league;
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
  if (club.country === 'Saudi Arabia' || league === 'Saudi Pro League') wage *= 1.2;
  if (league === 'MLS') wage *= 0.5;
  const prestigeRate = club.tier === 1 ? 0.00016 : club.tier === 2 ? 0.00004 : 0.000012;
  wage += marketValue * prestigeRate;
  const floor = club.tier >= 5 ? 500 : club.tier >= 4 ? 800 : 1_200;
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
