import type { ClubTier } from './data/clubs';
import {
  continentalCupForClub,
  internationalTournamentForSeason,
  type Confederation,
  type ContinentalCupId,
  type InternationalTournamentId,
} from './data/competitions';

/**
 * What kind of fixture a calendar week holds. `continental-semi-final` and
 * `continental-final` are the two "decisive" rounds from the locked design -
 * a single match settled by the player's one defining chance (see
 * chanceEngine.ts) rather than a normal spread of chances.
 */
export type FixtureKind =
  | 'league'
  | 'continental-group'
  | 'continental-knockout'
  | 'continental-semi-final'
  | 'continental-final'
  | 'super-cup'
  | 'international';

export interface CalendarFixture {
  week: number;
  kind: FixtureKind;
  continentalCup?: ContinentalCupId;
  /** Semis and finals are decided by one chance; everything else gets the
   * regular league-style distribution. */
  isDecisive: boolean;
  /** Leg number for two-legged continental knockout ties. */
  leg?: 1 | 2;
}

export interface SeasonCalendar {
  seasonNumber: number;
  totalWeeks: number;
  fixtures: CalendarFixture[];
}

export interface BuildCalendarParams {
  seasonNumber: number;
  /** How many league match-weeks the season runs for (SEASON_LENGTH). */
  leagueMatchWeeks: number;
  clubTier: ClubTier;
  confederation: Confederation;
}

const GROUP_STAGE_MATCHDAYS = 8;
const KNOCKOUT_ROUNDS_BEFORE_SEMI = 2; // e.g. round of 16, quarter-final - both two-legged.

/**
 * Builds the season's week-by-week fixture list: league weeks plus, for
 * clubs that qualify, continental group/knockout weeks and an international
 * window - mixing league and Europe the way the locked design calls for.
 *
 * This only lays out *what kind* of match happens each week; it does not
 * simulate opponents, results, or a league table. That's the season 2-20
 * simulation engine (see matchEngine.ts), which is designed to plug in
 * behind this calendar without changing its shape.
 */
export function buildSeasonCalendar(params: BuildCalendarParams): SeasonCalendar {
  const { seasonNumber, leagueMatchWeeks, clubTier, confederation } = params;
  const cup = continentalCupForClub(clubTier, confederation);
  const fixtures: CalendarFixture[] = [];

  for (let week = 1; week <= leagueMatchWeeks; week++) {
    fixtures.push({ week, kind: 'league', isDecisive: false });
  }

  let week = leagueMatchWeeks;
  if (cup) {
    if (cup === 'ucl') {
      fixtures.push({ week: 0, kind: 'super-cup', continentalCup: cup, isDecisive: false });
    }

    // Group/league-phase matchdays are interleaved evenly across the
    // league's own run of weeks rather than tacked on afterwards.
    const groupInterval = Math.max(1, Math.floor(leagueMatchWeeks / GROUP_STAGE_MATCHDAYS));
    for (let i = 0; i < GROUP_STAGE_MATCHDAYS; i++) {
      const groupWeek = Math.min(leagueMatchWeeks, (i + 1) * groupInterval);
      fixtures.push({ week: groupWeek, kind: 'continental-group', continentalCup: cup, isDecisive: false });
    }

    // Two-legged knockout rounds, then the two single-match decisive rounds,
    // all scheduled after the domestic season's own weeks.
    for (let round = 0; round < KNOCKOUT_ROUNDS_BEFORE_SEMI; round++) {
      fixtures.push({ week: ++week, kind: 'continental-knockout', continentalCup: cup, isDecisive: false, leg: 1 });
      fixtures.push({ week: ++week, kind: 'continental-knockout', continentalCup: cup, isDecisive: false, leg: 2 });
    }
    fixtures.push({ week: ++week, kind: 'continental-semi-final', continentalCup: cup, isDecisive: true });
    fixtures.push({ week: ++week, kind: 'continental-final', continentalCup: cup, isDecisive: true });
  }

  const internationalTournament = internationalTournamentForSeason(seasonNumber);
  if (internationalTournament) {
    fixtures.push({ week: ++week, kind: 'international', isDecisive: false });
  }

  fixtures.sort((a, b) => a.week - b.week);
  return {
    seasonNumber,
    totalWeeks: Math.max(leagueMatchWeeks, week),
    fixtures,
  };
}

/** Convenience lookup for the UI: which international tournament (if any)
 * this calendar's season includes, without pulling in the full competitions
 * module just to check. */
export function calendarIncludesInternational(calendar: SeasonCalendar): InternationalTournamentId | null {
  return internationalTournamentForSeason(calendar.seasonNumber);
}
