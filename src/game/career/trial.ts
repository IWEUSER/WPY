import { CLUBS, clubsByTier, clubsForSeason, type Club, type ClubTier } from './data/clubs';
import { countryForNationality, pickClubsBiasedToCountry } from './clubOffers';
import type { CalendarFixture, SeasonCalendar } from './calendar';
import { tierForRatio } from './transfers';
import {
  isTopTwentyNation,
  pickGeographicTrialClubs,
  youthTierForNation,
  youthTrialsAreMlsOnly,
} from './trialGeography';

/** Total finishing chances across the three club-trial matches. */
export const TRIAL_SHOTS = 10;
export const CLUB_TRIAL_GAMES = 3;
export const CLUB_TRIAL_CHANCE_SPLIT = [4, 3, 3] as const;

/** U16 goals-per-game → the tier that invites the player for a club trial. */
export function tierForYouthGoals(goals: number, games = 1, nationId?: string | null): ClubTier {
  const ratio = goals / Math.max(1, games);
  if (nationId && !isTopTwentyNation(nationId)) return youthTierForNation(ratio, nationId);
  return tierForRatio(ratio);
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
  /** When set, two of the three looks come from this nation's geographic path. */
  geographyNationId?: string | null;
  mlsOnly?: boolean;
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
  const geo = pickTrialClubs(tier, nationality, excludeIds, 1, options);
  if (geo[0]) return geo[0];
  const leftover = CLUBS.find(
    (c) => c.playable !== false && !excludeIds.includes(c.id) && (!options.sameTierOnly || c.tier === tier),
  );
  if (leftover) return leftover;
  return CLUBS.find((c) => c.playable !== false && !excludeIds.includes(c.id)) ?? CLUBS[0];
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
  const nationId = options.geographyNationId ?? nationality ?? null;
  const mlsOnly = Boolean(options.mlsOnly);
  if (mlsOnly) {
    const geo = pickGeographicTrialClubs(5, nationId, excludeIds, count, count);
    if (geo.length >= count) return geo.slice(0, count);
  }
  const geo = pickGeographicTrialClubs(tier, nationId, excludeIds, count, TRIAL_HOME_LOOKS);
  if (geo.length >= count && (options.requireHome || nationId)) return geo.slice(0, count);

  const picks: Club[] = [...geo];
  const exclude = [...excludeIds, ...picks.map((club) => club.id)];
  const preferCountry = options.preferCountry ?? countryForNationality(nationality);
  while (picks.length < count) {
    const pool = clubsByTier(tier).filter((c) => !exclude.includes(c.id));
    if (pool.length === 0) break;
    const home = preferCountry ? pool.filter((c) => c.country === preferCountry) : [];
    if (options.requireHome && home[0]) {
      const club = home[Math.floor(Math.random() * home.length)] ?? home[0];
      picks.push(club);
      exclude.push(club.id);
      continue;
    }
    const next = pickClubsBiasedToCountry(home.length ? home : pool, 1, preferCountry, home.length ? 1 : 0);
    if (!next[0] || exclude.includes(next[0].id)) break;
    picks.push(next[0]);
    exclude.push(next[0].id);
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
  const ratio = goals / Math.max(1, games);
  const tier = tierForYouthGoals(goals, games, nationality);
  return pickTrialClubs(tier, nationality, [], count, {
    sameTierOnly: true,
    geographyNationId: nationality,
    mlsOnly: youthTrialsAreMlsOnly(ratio, nationality),
  });
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
