import { clampStrength, type Club } from './data/clubs';

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

export function playerMarketValue(params: MarketValueParams): number {
  const { age, ratio, careerGoals, club } = params;
  const clubScale = club.strength / ANCHOR_STRENGTH;
  const ratioScale = Math.max(0.12, ratio / ANCHOR_RATIO);
  const volume = Math.min(1.15, Math.max(0.55, 0.7 + careerGoals / 70));
  const raw =
    BARCELONA_ANCHOR_VALUE *
    clubScale *
    leagueValueWeight(club.league) *
    ratioScale *
    ageValueFactor(age) *
    volume;
  return Math.max(100_000, Math.round(raw / 100_000) * 100_000);
}

/**
 * Weekly wage. Higher-ranked clubs pay more. Saudi clubs pay like a top
 * European side; MLS stays well below that band.
 */
export function weeklyWageForClub(club: Club, marketValue: number): number {
  let wageStrength = club.strength;
  if (club.country === 'Saudi Arabia') wageStrength = Math.min(94, club.strength + 12);
  if (club.league === 'MLS') wageStrength = Math.max(52, club.strength - 12);
  const t = (clampStrength(wageStrength) - 52) / 42;
  const base = 8_000 + t * t * 312_000;
  const prestige = marketValue * 0.00035;
  return Math.max(3_000, Math.round((base + prestige) / 1_000) * 1_000);
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
