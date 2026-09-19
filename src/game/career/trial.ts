import { CLUBS, clubsByTier, clubsForSeason, type Club, type ClubTier } from './data/clubs';
import { countryForNationality, pickClubsBiasedToCountry } from './clubOffers';
import type { CalendarFixture, SeasonCalendar } from './calendar';
import { tierForRatio } from './transfers';

/** Total finishing chances across the three club-trial matches. */
export const TRIAL_SHOTS = 10;
export const CLUB_TRIAL_GAMES = 3;
export const CLUB_TRIAL_CHANCE_SPLIT = [4, 3, 3] as const;

/** U16 goals-per-game → the tier that invites the player for a club trial. */
export function tierForYouthGoals(goals: number, games = 1): ClubTier {
  return tierForRatio(goals / Math.max(1, games));
}

/** @deprecated Use tierForYouthGoals. Kept so older tests still compile. */
export function tierForTrial(goals: number): ClubTier {
  return tierForYouthGoals(goals);
}

/** Three trials at one level. Fail the first band and drop one level for three more. */
export const TRIALS_AT_LEVEL = 3;
/** After two bands (six trials) the player gets transfer offers. */
export const TRIAL_LEVEL_ROUNDS = 2;
/** Second-round trials prefer this many clubs from the original favourite country. */
export const TRIAL_HOME_LOOKS = 2;

export type TrialPickOptions = {
  sameTierOnly?: boolean;
  preferCountry?: string | null;
  requireHome?: boolean;
};

function trialPickOptions(opts?: boolean | TrialPickOptions): TrialPickOptions {
  if (opts == null) return {};
  if (typeof opts === 'boolean') return { sameTierOnly: opts };
  return opts;
}

export function pickTrialClub(
  tier: ClubTier,
  nationality?: string | null,
  excludeIds: string[] = [],
  opts: boolean | TrialPickOptions = false,
): Club {
  const options = trialPickOptions(opts);
  const taken = new Set(excludeIds);
  const maxStep = options.sameTierOnly ? 0 : 5 - tier;
  const preferCountry = options.preferCountry ?? countryForNationality(nationality);
  for (let step = 0; step <= maxStep; step++) {
    const candidateTier = (tier + step) as ClubTier;
    const pool = clubsByTier(candidateTier).filter((c) => !taken.has(c.id));
    if (pool.length === 0) continue;
    const home = preferCountry ? pool.filter((c) => c.country === preferCountry) : [];
    if (options.requireHome && home[0]) return home[Math.floor(Math.random() * home.length)] ?? home[0];
    const picks = pickClubsBiasedToCountry(home.length ? home : pool, 1, preferCountry, home.length ? 1 : 0);
    if (picks[0]) return picks[0];
  }
  const leftover = CLUBS.find(
    (c) => c.playable !== false && !taken.has(c.id) && (!options.sameTierOnly || c.tier === tier),
  );
  if (leftover) return leftover;
  return CLUBS.find((c) => c.playable !== false && !taken.has(c.id)) ?? CLUBS[0];
}

/** Three clubs at one band so the player can choose the order they trial. */
export function pickTrialClubs(
  tier: ClubTier,
  nationality?: string | null,
  excludeIds: string[] = [],
  count = TRIALS_AT_LEVEL,
  opts: boolean | TrialPickOptions = { sameTierOnly: true },
): Club[] {
  const options = trialPickOptions(opts);
  const picks: Club[] = [];
  const exclude = [...excludeIds];
  for (let i = 0; i < count; i++) {
    const club = pickTrialClub(tier, nationality, exclude, options);
    if (!club || exclude.includes(club.id)) break;
    if (options.sameTierOnly && club.tier !== tier) break;
    picks.push(club);
    exclude.push(club.id);
  }
  if (picks.length < count && options.sameTierOnly) {
    const extra = pickTrialClubs(
      tier,
      nationality,
      [...excludeIds, ...picks.map((club) => club.id)],
      count - picks.length,
      { ...options, sameTierOnly: false },
    );
    return [...picks, ...extra];
  }
  return picks;
}

/**
 * Picks up to `count` clubs from the tier the U16 performance earned.
 */
export function offerClubsForTrial(
  goals: number,
  count = 3,
  nationality?: string | null,
  games = 1,
): Club[] {
  return pickTrialClubs(tierForYouthGoals(goals, games), nationality, [], count, { sameTierOnly: true });
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
