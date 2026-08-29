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
 * What kind of fixture a calendar week holds. Continental knockouts through
 * the semi-final are two-legged. The continental final, Super Cup, domestic
 * cup final, and international final are one-off decisive matches (see
 * chanceEngine.ts).
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
  /** Finals and the Super Cup are decided by one chance; two-legged ties
   * and league matches use the regular chance distribution. */
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
  /** UEFA Super Cup — only the previous CL/EL winner (or a newly joined club that won it). */
  includeSuperCup?: boolean;
}

const GROUP_STAGE_MATCHDAYS = 8;
const KNOCKOUT_ROUNDS_BEFORE_SEMI = 2; // round of 16 and quarter-final, both two-legged.

const DOMESTIC_CUP_FRACTIONS: { fraction: number; stage: DomesticCupStage }[] = [
  { fraction: 0.12, stage: 'round-of-16' },
  { fraction: 0.38, stage: 'quarter-final' },
  { fraction: 0.62, stage: 'semi-final' },
  { fraction: 0.88, stage: 'final' },
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
    includeSuperCup = false,
  } = params;
  const cup = continentalCupForClub(clubTier, confederation);
  const domesticCup = includeDomesticCup && country ? domesticCupForCountry(country) : null;
  const fixtures: CalendarFixture[] = [];

  for (let week = 1; week <= leagueMatchWeeks; week++) {
    fixtures.push({ week, kind: 'league', isDecisive: false });
  }

  if (domesticCup) {
    for (const round of DOMESTIC_CUP_FRACTIONS) {
      const week = Math.max(1, Math.min(leagueMatchWeeks, Math.round(round.fraction * leagueMatchWeeks)));
      fixtures.push({
        week,
        kind: 'domestic-cup',
        domesticCup,
        domesticCupStage: round.stage,
        isDecisive: round.stage === 'final',
      });
    }
  }

  let week = leagueMatchWeeks;
  if (cup) {
    if (includeSuperCup) {
      fixtures.push({ week: 0, kind: 'super-cup', continentalCup: cup, isDecisive: true });
    }

    // Group/league-phase matchdays are interleaved evenly across the
    // league's own run of weeks rather than tacked on afterwards.
    const groupInterval = Math.max(1, Math.floor(leagueMatchWeeks / GROUP_STAGE_MATCHDAYS));
    for (let i = 0; i < GROUP_STAGE_MATCHDAYS; i++) {
      const groupWeek = Math.min(leagueMatchWeeks, (i + 1) * groupInterval);
      fixtures.push({ week: groupWeek, kind: 'continental-group', continentalCup: cup, isDecisive: false });
    }

    // Two-legged knockout through the semi-final, then a one-off final.
    for (let round = 0; round < KNOCKOUT_ROUNDS_BEFORE_SEMI; round++) {
      fixtures.push({ week: ++week, kind: 'continental-knockout', continentalCup: cup, isDecisive: false, leg: 1 });
      fixtures.push({ week: ++week, kind: 'continental-knockout', continentalCup: cup, isDecisive: false, leg: 2 });
    }
    fixtures.push({ week: ++week, kind: 'continental-semi-final', continentalCup: cup, isDecisive: false, leg: 1 });
    fixtures.push({ week: ++week, kind: 'continental-semi-final', continentalCup: cup, isDecisive: false, leg: 2 });
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

/** Club continental final, Super Cup, domestic-cup final, or international final. */
export function isFinalFixture(fixture: CalendarFixture): boolean {
  if (fixture.kind === 'continental-final' || fixture.kind === 'super-cup') return true;
  if (fixture.kind === 'domestic-cup' && fixture.domesticCupStage === 'final') return true;
  return fixture.kind === 'international' && fixture.internationalRound === 'final';
}
