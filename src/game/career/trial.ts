import { CLUBS, clubsByTier, clubsForSeason, type Club, type ClubTier } from './data/clubs';
import { countryForNationality, pickClubsBiasedToCountry } from './clubOffers';
import type { CalendarFixture, SeasonCalendar } from './calendar';

/** Total finishing chances across the three club-trial matches. */
export const TRIAL_SHOTS = 10;
export const CLUB_TRIAL_GAMES = 3;
export const CLUB_TRIAL_CHANCE_SPLIT = [4, 3, 3] as const;

/** U16 tournament goals → the tier that invites the player for a club trial. */
export function tierForYouthGoals(goals: number): ClubTier {
  if (goals >= 7) return 1;
  if (goals >= 6) return 2;
  if (goals >= 5) return 3;
  if (goals >= 4) return 4;
  return 5;
}

/** @deprecated Use tierForYouthGoals. Kept so older tests still compile. */
export function tierForTrial(goals: number): ClubTier {
  return tierForYouthGoals(goals);
}

export function pickTrialClub(
  tier: ClubTier,
  nationality?: string | null,
  excludeIds: string[] = [],
): Club {
  const taken = new Set(excludeIds);
  for (let step = 0; step <= 5 - tier; step++) {
    const candidateTier = (tier + step) as ClubTier;
    const pool = clubsByTier(candidateTier).filter((c) => !taken.has(c.id));
    if (pool.length === 0) continue;
    const country = countryForNationality(nationality);
    const home = country ? pool.filter((c) => c.country === country) : [];
    const picks = pickClubsBiasedToCountry(home.length ? home : pool, 1, country, home.length ? 1 : 0);
    if (picks[0]) return picks[0];
  }
  return CLUBS.find((c) => c.playable !== false && !taken.has(c.id)) ?? CLUBS[0];
}

/**
 * Picks up to `count` clubs from the tier the U16 performance earned.
 * Used only by older tests; live careers now send the player to one club.
 */
export function offerClubsForTrial(goals: number, count = 3, nationality?: string | null): Club[] {
  const tier = tierForYouthGoals(goals);
  const picks: Club[] = [];
  const exclude: string[] = [];
  for (let i = 0; i < count; i++) {
    const club = pickTrialClub(tier, nationality, exclude);
    if (!club || exclude.includes(club.id)) break;
    picks.push(club);
    exclude.push(club.id);
  }
  return picks;
}

export type TrialRatioBar = 'reserve' | 'first-team';

export function trialRatioRequired(club: Club, bar: TrialRatioBar = 'reserve'): number {
  return bar === 'first-team' ? club.firstTeamGoalRatio : club.reserveGoalRatio;
}

export function trialGoalsNeeded(club: Club, games = CLUB_TRIAL_GAMES, bar: TrialRatioBar = 'reserve'): number {
  return Math.ceil(trialRatioRequired(club, bar) * games - 1e-9);
}

export function trialContractWon(
  club: Club,
  goals: number,
  games: number,
  bar: TrialRatioBar = 'reserve',
): boolean {
  if (games <= 0) return false;
  return goals / games >= trialRatioRequired(club, bar);
}

export function nextTrialTier(tier: ClubTier): ClubTier {
  return Math.min(5, (tier + 1) as ClubTier) as ClubTier;
}

export function buildClubTrialCalendar(club: Club): SeasonCalendar {
  const opponents = clubsForSeason(club, club.league).filter((c) => c.id !== club.id).slice(0, CLUB_TRIAL_GAMES);
  const fixtures: CalendarFixture[] = opponents.map((opponent, i) => ({
    week: i + 1,
    kind: 'league',
    isDecisive: false,
    opponentId: opponent.id,
    opponentLabel: opponent.name,
    isHome: i !== 1,
    playerChances: CLUB_TRIAL_CHANCE_SPLIT[i] ?? 3,
  }));
  return {
    seasonNumber: 0,
    totalWeeks: fixtures.length,
    fixtures,
  };
}
