import type { ClubTier } from './data/clubs';
import {
  campaignSchedulesInternational,
  continentalCupForClub,
  domesticCupForCountry,
  internationalCampaignForSeason,
  internationalTournamentForSeason,
  type Confederation,
  type ContinentalCupId,
  type DomesticCupId,
  type InternationalCampaignPhase,
  type InternationalTournamentId,
} from './data/competitions';
import { qualifierCountFor, tournamentGroupGames, tournamentKnockoutRounds } from './data/fifaRankings';

/**
 * What kind of fixture a calendar week holds. Continental knockouts through
 * the semi-final are two-legged. Finals are one-off ties that still use the
 * regular chance distribution; missed chances cut the club's win odds.
 */
export type FixtureKind =
  | 'league'
  | 'domestic-cup'
  | 'continental-group'
  | 'continental-knockout'
  | 'continental-semi-final'
  | 'continental-final'
  | 'super-cup'
  | 'leagues-cup'
  | 'playoff'
  | 'international'
  | 'rest';

export type PlayoffRound = 'first-round' | 'conference-semi' | 'conference-final' | 'mls-cup';
export type LeaguesCupStage = 'group' | 'quarter-final' | 'semi-final' | 'final';
export type SuperCupStage = 'semi-final' | 'final';

export type DomesticCupStage = 'round-of-16' | 'quarter-final' | 'semi-final' | 'final';

export interface CalendarFixture {
  week: number;
  kind: FixtureKind;
  continentalCup?: ContinentalCupId;
  domesticCup?: DomesticCupId;
  domesticCupStage?: DomesticCupStage;
  /** Legacy flag. Finals no longer use a single decisive chance. */
  isDecisive: boolean;
  /** Leg number for two-legged continental knockout ties. */
  leg?: 1 | 2;
  /** Pre-assigned opponent for this fixture (club id, or a nation id for
   * international matches). */
  opponentId?: string;
  opponentLabel?: string;
  /** How many scoring chances the player gets - filled in by seasonSim. */
  playerChances?: number;
  /** Home/away. League: first meeting is home, the return is away.
   * Two-legged cups: first leg home. Neutral cup finals leave this unset
   * for the venue and use it only for kit tint. */
  isHome?: boolean;
  /** One-off domestic and European finals are played at a large neutral ground. */
  neutral?: boolean;
  playoffRound?: PlayoffRound;
  leaguesCupStage?: LeaguesCupStage;
  superCupStage?: SuperCupStage;
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
  internationalPhase?: InternationalCampaignPhase;
  domesticCup?: DomesticCupId | null;
}

/** World Cup, continental championship, and Nations League ties — not qualifiers. */
export function isInternationalTournamentFixture(fixture: CalendarFixture): boolean {
  return fixture.kind === 'international' && fixture.internationalRound != null && fixture.internationalRound !== 'qualifier';
}

/** Domestic and European one-off finals at the large club-final stadium. */
export function isClubFinalNeutral(fixture: CalendarFixture): boolean {
  if (fixture.kind === 'international') return false;
  if (fixture.neutral) return true;
  return (
    fixture.kind === 'continental-final'
    || (fixture.kind === 'domestic-cup' && fixture.domesticCupStage === 'final')
    || (fixture.kind === 'super-cup' && (fixture.superCupStage === 'final' || !fixture.superCupStage))
    || (fixture.kind === 'leagues-cup' && fixture.leaguesCupStage === 'final')
    || (fixture.kind === 'playoff' && fixture.playoffRound === 'mls-cup')
  );
}

/** Club finals and international tournament games are not home or away. */
export function fixtureIsNeutral(fixture: CalendarFixture): boolean {
  return isClubFinalNeutral(fixture) || isInternationalTournamentFixture(fixture);
}

export function fixtureVenueLabel(fixture: CalendarFixture): 'Neutral' | 'Home' | 'Away' {
  if (fixtureIsNeutral(fixture)) return 'Neutral';
  return fixtureIsHome(fixture) ? 'Home' : 'Away';
}

/** Player's side is at home. Prefers the stored flag, then two-legged legs, then week parity. */
export function fixtureIsHome(fixture: CalendarFixture): boolean {
  if (fixtureIsNeutral(fixture)) return false;
  if (typeof fixture.isHome === 'boolean') return fixture.isHome;
  if (fixture.leg === 2) return false;
  if (fixture.leg === 1) return true;
  return fixture.week % 2 === 1;
}

/**
 * Share of seats given to the away support. Neutral ties (club finals and
 * international tournament games) are a true 50/50 split by club or country.
 */
export function fixtureCrowdAwayShare(fixture: CalendarFixture): number {
  if (fixtureIsNeutral(fixture)) return 0.5;
  return 0.2;
}

function fixtureKickoffSeed(fixture: CalendarFixture): number {
  const key = `${fixture.week}|${fixture.kind}|${fixture.opponentId ?? ''}|${fixture.isHome === false ? 'A' : 'H'}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Night kick-offs: every European club tie, international knockout rounds,
 * and about one in five domestic league games (hashed so the same fixture
 * is always the same kick-off).
 */
export function fixtureIsNight(fixture: CalendarFixture): boolean {
  if (
    fixture.kind === 'continental-group'
    || fixture.kind === 'continental-knockout'
    || fixture.kind === 'continental-semi-final'
    || fixture.kind === 'continental-final'
  ) {
    return true;
  }
  if (fixture.kind === 'international') {
    const round = fixture.internationalRound;
    return round === 'round-of-32'
      || round === 'round-of-16'
      || round === 'quarter-final'
      || round === 'semi-final'
      || round === 'final';
  }
  if (fixture.kind === 'league') {
    return fixtureKickoffSeed(fixture) % 5 === 0;
  }
  return false;
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
  /** MLS playoffs + MLS Cup after the regular season. */
  includePlayoffs?: boolean;
  /** MLS + Liga MX summer cup. */
  includeLeaguesCup?: boolean;
  /** Saudi four-team Super Cup (semi-final + final). */
  includeSaudiSuperCup?: boolean;
  league?: string;
  /** Override the club-tier default so last season's table can place the club. */
  continentalCup?: ContinentalCupId | null;
}

const GROUP_STAGE_MATCHDAYS = 8;
const KNOCKOUT_ROUNDS_BEFORE_SEMI = 2; // round of 16 and quarter-final, both two-legged.
const KNOCKOUT_LEGS_BEFORE_FINAL = KNOCKOUT_ROUNDS_BEFORE_SEMI * 2 + 2; // R16×2, QF×2, SF×2

const DOMESTIC_CUP_EARLY: { fraction: number; stage: Exclude<DomesticCupStage, 'final'> }[] = [
  { fraction: 0.12, stage: 'round-of-16' },
  { fraction: 0.38, stage: 'quarter-final' },
  { fraction: 0.62, stage: 'semi-final' },
];

const KIND_ORDER: Record<FixtureKind, number> = {
  international: 0,
  'domestic-cup': 1,
  'super-cup': 2,
  'leagues-cup': 3,
  'continental-group': 4,
  'continental-knockout': 5,
  'continental-semi-final': 6,
  'continental-final': 7,
  playoff: 8,
  league: 9,
  rest: 10,
};

/** Empty weeks between the last club match and the national tournament. */
export const INTERNATIONAL_BREAK_WEEKS = 3;

export function tournamentWeekCount(tournament: InternationalTournamentId | null | undefined): number {
  if (!tournament) return 0;
  return tournament === 'world-cup' ? 5 : 4;
}

/**
 * Builds the season's week-by-week fixture list.
 *
 * League weeks run first. Earlier domestic-cup and continental ties share
 * those weeks. The domestic-cup final is the week after the last league
 * game; the continental final is the last club week. National tournaments
 * then start three weeks later and last 4 weeks (continental) or 5 (World Cup).
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
    includePlayoffs = false,
    includeLeaguesCup = false,
    includeSaudiSuperCup = false,
  } = params;
  const cup =
    params.continentalCup !== undefined
      ? params.continentalCup
      : continentalCupForClub(clubTier, confederation);
  const domesticCup = includeDomesticCup && country ? domesticCupForCountry(country) : null;
  const fixtures: CalendarFixture[] = [];

  for (let week = 1; week <= leagueMatchWeeks; week++) {
    fixtures.push({ week, kind: 'league', isDecisive: false });
  }

  if (domesticCup) {
    for (const round of DOMESTIC_CUP_EARLY) {
      const week = Math.max(1, Math.min(leagueMatchWeeks, Math.round(round.fraction * leagueMatchWeeks)));
      fixtures.push({
        week,
        kind: 'domestic-cup',
        domesticCup,
        domesticCupStage: round.stage,
        isDecisive: false,
      });
    }
  }

  if (includeSaudiSuperCup) {
    fixtures.push({ week: 1, kind: 'super-cup', superCupStage: 'semi-final', isDecisive: false });
    fixtures.push({ week: 2, kind: 'super-cup', superCupStage: 'final', isDecisive: false, neutral: true });
  } else if (cup && includeSuperCup) {
    fixtures.push({
      week: 1,
      kind: 'super-cup',
      continentalCup: cup,
      superCupStage: 'final',
      isDecisive: false,
      neutral: true,
    });
  }

  if (includeLeaguesCup) {
    const groupWeeks = [0.28, 0.48].map((f) => Math.max(1, Math.min(leagueMatchWeeks, Math.round(f * leagueMatchWeeks))));
    for (const week of groupWeeks) {
      fixtures.push({ week, kind: 'leagues-cup', continentalCup: 'leagues-cup', leaguesCupStage: 'group', isDecisive: false });
    }
    fixtures.push({
      week: Math.max(1, Math.min(leagueMatchWeeks, Math.round(0.66 * leagueMatchWeeks))),
      kind: 'leagues-cup',
      continentalCup: 'leagues-cup',
      leaguesCupStage: 'quarter-final',
      isDecisive: false,
    });
    fixtures.push({
      week: Math.max(1, Math.min(leagueMatchWeeks, Math.round(0.82 * leagueMatchWeeks))),
      kind: 'leagues-cup',
      continentalCup: 'leagues-cup',
      leaguesCupStage: 'semi-final',
      isDecisive: false,
    });
  }

  if (cup) {

    const groupInterval = Math.max(1, Math.floor(leagueMatchWeeks / GROUP_STAGE_MATCHDAYS));
    for (let i = 0; i < GROUP_STAGE_MATCHDAYS; i++) {
      const groupWeek = Math.min(leagueMatchWeeks, (i + 1) * groupInterval);
      fixtures.push({ week: groupWeek, kind: 'continental-group', continentalCup: cup, isDecisive: false });
    }

    const knockoutStart = Math.max(1, leagueMatchWeeks - KNOCKOUT_LEGS_BEFORE_FINAL + 1);
    let knockoutWeek = knockoutStart;
    for (let round = 0; round < KNOCKOUT_ROUNDS_BEFORE_SEMI; round++) {
      fixtures.push({
        week: Math.min(leagueMatchWeeks, knockoutWeek++),
        kind: 'continental-knockout',
        continentalCup: cup,
        isDecisive: false,
        leg: 1,
      });
      fixtures.push({
        week: Math.min(leagueMatchWeeks, knockoutWeek++),
        kind: 'continental-knockout',
        continentalCup: cup,
        isDecisive: false,
        leg: 2,
      });
    }
    fixtures.push({
      week: Math.min(leagueMatchWeeks, knockoutWeek++),
      kind: 'continental-semi-final',
      continentalCup: cup,
      isDecisive: false,
      leg: 1,
    });
    fixtures.push({
      week: Math.min(leagueMatchWeeks, knockoutWeek++),
      kind: 'continental-semi-final',
      continentalCup: cup,
      isDecisive: false,
      leg: 2,
    });
  }

  const campaign = internationalCampaignForSeason(seasonNumber, nationConfederation ?? confederation);
  const intlLive = includeInternational && campaign.tournament && campaignSchedulesInternational(campaign.phase);
  if (intlLive && campaign.qualifierGames > 0) {
    const qualifierCount = campaign.qualifierGames || qualifierCountFor(campaign.tournament!);
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
  }

  if (intlLive && campaign.phase === 'nations-league' && campaign.tournament) {
    const groupCount = tournamentGroupGames(campaign.tournament);
    for (let i = 0; i < groupCount; i++) {
      const fraction = 0.08 + (i / Math.max(1, groupCount - 1)) * 0.62;
      const week = Math.max(1, Math.min(leagueMatchWeeks, Math.round(fraction * leagueMatchWeeks)));
      fixtures.push({
        week,
        kind: 'international',
        isDecisive: false,
        internationalRound: 'group',
      });
    }
    const [qfWeek, sfWeek, finalWeek] = nationsLeagueKnockoutWeeks(leagueMatchWeeks);
    const ko: { week: number; round: NonNullable<CalendarFixture['internationalRound']> }[] = [
      { week: qfWeek, round: 'quarter-final' },
      { week: sfWeek, round: 'semi-final' },
      { week: finalWeek, round: 'final' },
    ];
    for (const packed of ko) {
      fixtures.push({
        week: packed.week,
        kind: 'international',
        isDecisive: false,
        internationalRound: packed.round,
      });
    }
  }

  let week = leagueMatchWeeks;
  if (domesticCup) {
    fixtures.push({
      week: ++week,
      kind: 'domestic-cup',
      domesticCup,
      domesticCupStage: 'final',
      isDecisive: false,
      neutral: true,
    });
  }
  if (includeLeaguesCup) {
    fixtures.push({
      week: ++week,
      kind: 'leagues-cup',
      continentalCup: 'leagues-cup',
      leaguesCupStage: 'final',
      isDecisive: false,
      neutral: true,
    });
  }
  if (cup) {
    fixtures.push({
      week: ++week,
      kind: 'continental-final',
      continentalCup: cup,
      isDecisive: false,
      neutral: true,
    });
  }
  if (includePlayoffs) {
    const rounds: PlayoffRound[] = ['first-round', 'conference-semi', 'conference-final', 'mls-cup'];
    for (const playoffRound of rounds) {
      fixtures.push({
        week: ++week,
        kind: 'playoff',
        playoffRound,
        isDecisive: false,
        neutral: playoffRound === 'mls-cup',
      });
    }
  }

  if (
    intlLive &&
    campaign.tournament &&
    (campaign.phase === 'qualifiers-and-tournament' || campaign.phase === 'tournament-only')
  ) {
    for (let i = 0; i < INTERNATIONAL_BREAK_WEEKS; i++) {
      fixtures.push({ week: ++week, kind: 'rest', isDecisive: false });
    }
    const finalsWeeks = tournamentWeekCount(campaign.tournament);
    const groupRounds: CalendarFixture['internationalRound'][] = Array.from(
      { length: tournamentGroupGames(campaign.tournament) },
      () => 'group',
    );
    const rounds: CalendarFixture['internationalRound'][] = [
      ...groupRounds,
      ...tournamentKnockoutRounds(campaign.tournament),
    ];
    for (const packed of packIntoWeeks(rounds, finalsWeeks, week + 1)) {
      fixtures.push({
        week: packed.week,
        kind: 'international',
        isDecisive: false,
        internationalRound: packed.round,
      });
      week = Math.max(week, packed.week);
    }
  }

  fixtures.sort((a, b) => a.week - b.week || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const totalWeeks = fixtures.reduce((max, f) => Math.max(max, f.week), leagueMatchWeeks);
  return {
    seasonNumber,
    totalWeeks,
    fixtures,
    internationalTournament: includeInternational && campaignSchedulesInternational(campaign.phase)
      ? campaign.tournament
      : null,
    internationalPhase: includeInternational && campaignSchedulesInternational(campaign.phase)
      ? campaign.phase
      : 'none',
    domesticCup,
  };
}

/** Nations League knockout sits around week 30, not after the club season. */
export function nationsLeagueKnockoutWeeks(leagueMatchWeeks: number): [number, number, number] {
  const finalWeek = Math.min(leagueMatchWeeks - 1, 31);
  const sfWeek = Math.max(26, finalWeek - 1);
  const qfWeek = Math.max(24, sfWeek - 1);
  return [qfWeek, sfWeek, finalWeek];
}

function packIntoWeeks(
  rounds: CalendarFixture['internationalRound'][],
  weekCount: number,
  startWeek: number,
): { week: number; round: CalendarFixture['internationalRound'] }[] {
  if (rounds.length === 0 || weekCount <= 0) return [];
  const extras = Math.max(0, rounds.length - weekCount);
  const packed: { week: number; round: CalendarFixture['internationalRound'] }[] = [];
  let week = startWeek;
  let i = 0;
  for (let e = 0; e < extras && i < rounds.length; e++) {
    packed.push({ week, round: rounds[i] });
    i += 1;
    if (i < rounds.length) {
      packed.push({ week, round: rounds[i] });
      i += 1;
    }
    week += 1;
  }
  while (i < rounds.length) {
    packed.push({ week, round: rounds[i] });
    i += 1;
    week += 1;
  }
  return packed;
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
  if (fixture.kind === 'continental-final') return true;
  if (fixture.kind === 'super-cup' && (fixture.superCupStage === 'final' || !fixture.superCupStage)) return true;
  if (fixture.kind === 'domestic-cup' && fixture.domesticCupStage === 'final') return true;
  if (fixture.kind === 'leagues-cup' && fixture.leaguesCupStage === 'final') return true;
  if (fixture.kind === 'playoff' && fixture.playoffRound === 'mls-cup') return true;
  return fixture.kind === 'international' && fixture.internationalRound === 'final';
}

export function currentCalendarWeek(calendar: SeasonCalendar, fixtureIndex: number): number {
  const next = calendar.fixtures[fixtureIndex];
  if (next) return next.week;
  return calendar.totalWeeks;
}
