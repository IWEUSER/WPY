import { clampStrength, getClub, type Club, type ClubTier } from './data/clubs';
import { countsTowardCareerRecord } from './seasonDisplay';
import type { SeasonRecord } from './types';

/** 18 at Barcelona with a 0.9 ratio is the €200m anchor. */
export const BARCELONA_ANCHOR_VALUE = 200_000_000;
const ANCHOR_STRENGTH = 91;
const ANCHOR_RATIO = 0.9;

const TOP_LEAGUES = new Set(['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']);

export function leagueValueWeight(league: string): number {
  if (TOP_LEAGUES.has(league)) return 1;
  if (league === 'Saudi Pro League') return 0.48;
  if (league === 'MLS') return 0.3;
  return 0.36;
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

/** Full fee on a 5-year deal; one year left is a fire sale; expired is free. */
export function contractValueFactor(yearsRemaining: number): number {
  if (yearsRemaining >= 5) return 1;
  if (yearsRemaining === 4) return 0.88;
  if (yearsRemaining === 3) return 0.72;
  if (yearsRemaining === 2) return 0.48;
  if (yearsRemaining === 1) return 0.22;
  return 0;
}

export function nextContractYearsRemaining(yearsRemaining: number): number {
  return yearsRemaining <= 1 ? DEFAULT_CONTRACT_YEARS : yearsRemaining - 1;
}

/** Trailing first-team/loan seasons below a goals-per-game bar. */
export function consecutiveSeasonsBelow(seasons: SeasonRecord[], threshold: number): number {
  let n = 0;
  for (let i = seasons.length - 1; i >= 0; i--) {
    const season = seasons[i];
    if (!countsTowardCareerRecord(season.seasonNumber)) continue;
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

export function clubLeagueScale(club: Club): number {
  return (club.strength / ANCHOR_STRENGTH) * leagueValueWeight(club.league);
}

export function playerMarketValue(params: MarketValueParams): number {
  const { age, ratio, careerGoals, club } = params;
  return valueFromScale(age, ratio, careerGoals, clubLeagueScale(club));
}

/**
 * Same formula, but the club/league multiplier is a goal-weighted average of
 * every first-team season so a spell at Barcelona still counts after a move.
 */
export function lastSeasonRatio(seasons: SeasonRecord[]): number | null {
  for (let i = seasons.length - 1; i >= 0; i--) {
    const season = seasons[i];
    if (!countsTowardCareerRecord(season.seasonNumber)) continue;
    if (season.gamesPlayed <= 0) continue;
    return season.goals / season.gamesPlayed;
  }
  return null;
}

/**
 * Career ratio is the base. A collapse last season cuts the figure hard,
 * but a 0.08 year cannot wipe a 0.80 career down to the bottom of the market.
 */
export function formAdjustedRatio(careerRatio: number, recentRatio: number | null): number {
  if (recentRatio == null) return careerRatio;
  const blended = careerRatio * 0.65 + recentRatio * 0.35;
  const collapsed = careerRatio > 0.2 && recentRatio < careerRatio * 0.4;
  return Math.max(0.05, blended * (collapsed ? 0.7 : 1));
}

export function playerMarketValueFromSeasons(params: {
  age: number;
  careerGoals: number;
  careerGames: number;
  seasons: SeasonRecord[];
  fallbackClub: Club;
  contractYearsRemaining?: number;
}): number {
  const { age, careerGoals, careerGames, seasons, fallbackClub } = params;
  const yearsLeft = params.contractYearsRemaining ?? DEFAULT_CONTRACT_YEARS;
  const careerRatio = careerGames > 0 ? careerGoals / careerGames : 0;
  const ratio = formAdjustedRatio(careerRatio, lastSeasonRatio(seasons));
  let weighted = 0;
  let weight = 0;
  for (const season of seasons) {
    if (!countsTowardCareerRecord(season.seasonNumber)) continue;
    const club = getClub(season.clubId);
    if (!club || season.goals <= 0) continue;
    weighted += clubLeagueScale(club) * season.goals;
    weight += season.goals;
  }
  const scale = weight > 0 ? weighted / weight : clubLeagueScale(fallbackClub);
  const base = valueFromScale(age, ratio, careerGoals, scale);
  const poor = consecutivePoorFactor(consecutiveSeasonsBelow(seasons, 0.25));
  const contract = contractValueFactor(yearsLeft);
  const raw = base * poor * (contract <= 0 ? 0.08 : contract);
  return Math.max(100_000, Math.round(raw / 100_000) * 100_000);
}

/** Which transfer band a fee belongs in. A €100m+ player is never tier 5. */
export function tierForMarketValue(value: number): ClubTier {
  if (value >= 70_000_000) return 1;
  if (value >= 28_000_000) return 2;
  if (value >= 12_000_000) return 3;
  if (value >= 4_000_000) return 4;
  return 5;
}

function valueFromScale(age: number, ratio: number, careerGoals: number, scale: number): number {
  const ratioScale = Math.max(0.12, ratio / ANCHOR_RATIO);
  const volume = Math.min(1.15, Math.max(0.55, 0.7 + careerGoals / 70));
  const raw = BARCELONA_ANCHOR_VALUE * scale * ratioScale * ageValueFactor(age) * volume;
  return Math.max(100_000, Math.round(raw / 100_000) * 100_000);
}

/**
 * Weekly wage. Higher-ranked clubs pay more. Saudi clubs pay like a top
 * European side; MLS stays well below that band.
 */
export function weeklyWageForClub(club: Club, marketValue: number): number {
  const tierBase: Record<ClubTier, number> = {
    1: 95_000,
    2: 22_000,
    3: 7_500,
    4: 2_200,
    5: 800,
  };
  const t = (clampStrength(club.strength) - 52) / 42;
  let wage = tierBase[club.tier] * (0.7 + 0.6 * t);
  if (club.country === 'Saudi Arabia') wage *= 1.2;
  if (club.league === 'MLS') wage *= 0.5;
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
