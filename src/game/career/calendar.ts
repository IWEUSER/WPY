import type { ClubTier } from './data/clubs';
import {
  continentalCupForClub,
  domesticCupForCountry,
  internationalCampaignForSeason,
  internationalTournamentForSeason,
  type Confederation,
  type ContinentalCupId,
  type DomesticCupId,
  type InternationalTournamentId,
} from './data/competitions';
import { qualifierCountFor, tournamentKnockoutRounds } from './data/fifaRankings';

/**
 * What kind of fixture a calendar week holds. `continental-semi-final` and
 * `continental-final` are the two "decisive" rounds from the locked design -
 * a single match settled by the player's one defining chance (see
 * chanceEngine.ts) rather than a normal spread of chances.
 */
export type FixtureKind =
  | 'league'
  | 'domestic-cup'
  | 'continental-group'
  | 'continental-knockout'
  | 'continental-semi-final'
  | 'continental-final'
  | 'super-cup'
  | 'international';

export type DomesticCupStage = 'round-of-16' | 'quarter-final' | 'semi-final' | 'final';

export interface CalendarFixture {
  week: number;
  kind: FixtureKind;
  continentalCup?: ContinentalCupId;
  domesticCup?: DomesticCupId;
  domesticCupStage?: DomesticCupStage;
  /** Semis and finals are decided by one chance; everything else gets the
   * regular league-style distribution. */
  isDecisive: boolean;
  /** Leg number for two-legged continental knockout ties. */
  leg?: 1 | 2;
  /** Pre-assigned opponent for this fixture (club id, or a nation id for
   * international matches). */
  opponentId?: string;
  opponentLabel?: string;
  /** How many scoring chances the player gets - filled in by seasonSim. */
  playerChances?: number;
  internationalRound?:
    | 'qualifier'
    | 'group'
    | 'round-of-32'
    | 'round-of-16'
    | 'quarter-final'
    | 'semi-final'
    | 'final';
}

export interface SeasonCalendar {
  seasonNumber: number;
  totalWeeks: number;
  fixtures: CalendarFixture[];
  internationalTournament?: InternationalTournamentId | null;
  internationalPhase?: 'none' | 'qualifiers' | 'qualifiers-and-tournament';
  domesticCup?: DomesticCupId | null;
}

export interface BuildCalendarParams {
  seasonNumber: number;
  /** How many league match-weeks the season runs for (SEASON_LENGTH). */
  leagueMatchWeeks: number;
  clubTier: ClubTier;
  confederation: Confederation;
  /** Club country, used to schedule the domestic cup. */
  country?: string;
  /** Player's national confederation, used to pick Euro / Copa / AFCON / etc. */
  nationConfederation?: Confederation | null;
  /** When false, skip the international window (player not selected). */
  includeInternational?: boolean;
  includeDomesticCup?: boolean;
}

const GROUP_STAGE_MATCHDAYS = 8;
const KNOCKOUT_ROUNDS_BEFORE_SEMI = 2; // e.g. round of 16, quarter-final - both two-legged.

const DOMESTIC_CUP_WEEKS: { week: number; stage: DomesticCupStage }[] = [
  { week: 3, stage: 'round-of-16' },
  { week: 9, stage: 'quarter-final' },
  { week: 15, stage: 'semi-final' },
  { week: 21, stage: 'final' },
];

const KIND_ORDER: Record<FixtureKind, number> = {
  international: 0,
  'domestic-cup': 1,
  'super-cup': 2,
  'continental-group': 3,
  'continental-knockout': 4,
  'continental-semi-final': 5,
  'continental-final': 6,
  league: 7,
};

/**
 * Builds the season's week-by-week fixture list: league weeks plus domestic
 * cup ties, and for clubs that qualify, continental group/knockout weeks and
 * an international window.
 *
 * This only lays out *what kind* of match happens each week; opponents and
 * results are filled in by seasonSim.
 */
export function buildSeasonCalendar(params: BuildCalendarParams): SeasonCalendar {
  const {
    seasonNumber,
    leagueMatchWeeks,
    clubTier,
    confederation,
    country,
    nationConfederation,
    includeInternational = true,
    includeDomesticCup = true,
  } = params;
  const cup = continentalCupForClub(clubTier, confederation);
  const domesticCup = includeDomesticCup && country ? domesticCupForCountry(country) : null;
  const fixtures: CalendarFixture[] = [];

  for (let week = 1; week <= leagueMatchWeeks; week++) {
    fixtures.push({ week, kind: 'league', isDecisive: false });
  }

  if (domesticCup) {
    for (const round of DOMESTIC_CUP_WEEKS) {
      const week = Math.min(leagueMatchWeeks, round.week);
      fixtures.push({
        week,
        kind: 'domestic-cup',
        domesticCup,
        domesticCupStage: round.stage,
        isDecisive: false,
      });
    }
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

  const campaign = internationalCampaignForSeason(seasonNumber, nationConfederation ?? confederation);
  if (includeInternational && campaign.tournament && campaign.phase !== 'none') {
    const qualifierCount = campaign.qualifierGames || qualifierCountFor(campaign.tournament);
    const interval = leagueMatchWeeks / Math.max(1, qualifierCount);
    for (let i = 0; i < qualifierCount; i++) {
      const qualifierWeek = Math.max(1, Math.min(leagueMatchWeeks, Math.round((i + 0.5) * interval)));
      fixtures.push({
        week: qualifierWeek,
        kind: 'international',
        isDecisive: false,
        internationalRound: 'qualifier',
      });
    }
    if (campaign.phase === 'qualifiers-and-tournament') {
      for (let i = 0; i < 3; i++) {
        fixtures.push({ week: ++week, kind: 'international', isDecisive: false, internationalRound: 'group' });
      }
      for (const round of tournamentKnockoutRounds(campaign.tournament)) {
        fixtures.push({
          week: ++week,
          kind: 'international',
          isDecisive: round === 'semi-final' || round === 'final',
          internationalRound: round,
        });
      }
    }
  }

  fixtures.sort((a, b) => a.week - b.week || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return {
    seasonNumber,
    totalWeeks: Math.max(leagueMatchWeeks, week),
    fixtures,
    internationalTournament: includeInternational ? campaign.tournament : null,
    internationalPhase: includeInternational ? campaign.phase : 'none',
    domesticCup,
  };
}

/** Convenience lookup for the UI: which international tournament (if any)
 * this calendar actually scheduled. */
export function calendarIncludesInternational(calendar: SeasonCalendar): InternationalTournamentId | null {
  if (calendar.internationalTournament) return calendar.internationalTournament;
  if (calendar.fixtures.some((f) => f.kind === 'international')) {
    return internationalTournamentForSeason(calendar.seasonNumber);
  }
  return null;
}

export function calendarDomesticCup(calendar: SeasonCalendar): DomesticCupId | null {
  return calendar.domesticCup ?? calendar.fixtures.find((f) => f.domesticCup)?.domesticCup ?? null;
}
