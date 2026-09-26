import type { CalendarFixture, DomesticCupStage, LeaguesCupStage, PlayoffRound, SeasonCalendar, SuperCupStage } from './calendar';
import type { SquadStatus } from './types';
import { buildSeasonCalendar, fixtureIsHome, internationalVenueFlags, isFinalFixture, scoreboardPlayerOnLeft } from './calendar';
import {
  championsLeagueBand,
  clubsThatWouldAdvanceFromLeague,
  isUclFinalistClub,
  pickUclFinalOpponent,
  pickWeightedOpponent,
  simulateKnockoutSurvivors,
  tablePosition,
  uclPlayOffOpponentId,
  uclRoundOf16Field,
  uclRoundOf16OpponentId,
} from './championsLeagueKnockout';
import { CHAMPIONS_LEAGUE_FIELD_SIZE, leaguePhaseOpponents } from './continentalDraw';
import {
  chancesForKnockoutTie,
  chancesForLeagueMatch,
} from './chanceEngine';
import {
  clubsForSeason,
  clubsInCountry,
  clubsInLeague,
  getClub,
  ligaMxClubs,
  promotionTarget,
  leagueMatchWeeks,
  qualifiesForSaudiSuperCup,
  SECOND_DIVISIONS,
  type Club,
} from './data/clubs';
import {
  MLS_REGULAR_SEASON_WEEKS,
  mlsConferenceOf,
  playoffOpeningForPosition,
} from './data/leagueFormat';
import {
  campaignSchedulesInternational,
  clubContinentalCup,
  confederationForCountry,
  CONTINENTAL_CUPS,
  DOMESTIC_CUPS,
  INTERNATIONAL_TOURNAMENTS,
  internationalCalendarSeason,
  internationalCampaignForSeason,
  type ContinentalCupId,
  type DomesticCupId,
  type InternationalCampaignPhase,
  type InternationalTournamentId,
} from './data/competitions';
import {
  doesNationQualify,
  nationStrength,
  nationsInConfederation,
  pickMixedRankOpponents,
  qualifierOpponents,
  tournamentGroupAdvancePoints,
  tournamentGroupGames,
  tournamentKnockoutRounds,
  tournamentOpponents,
  type InternationalKnockoutRound,
} from './data/fifaRankings';
import {
  euroGroupForNation,
  isEuroDefaultQualifier,
  nationLabel,
  nationsLeagueCanReachKnockout,
  nationsLeagueGroupLetter,
  nationsLeagueGroupTeams,
} from './data/nationsLeague';
import {
  applyNpcNationMatch,
  applyPlayerGroupResult,
  createGroupState,
  doesNationQualifyFromTable,
  groupPosition,
  nationsLeagueQuarterFinalOpponent,
  nationCanProgressKnockout,
  nationCanWinMajor,
  simulateNpcRoundAfterPlayerMatch,
  type IntlGroupState,
} from './internationalTable';
import { clubEligibleForNationalTeam, getNation, isSelectedForNationalTeam, NATIONS } from './international';
import {
  applyMatchToTable,
  championsLeagueTableNeedsRepair,
  clubsForContinentalCup,
  emptyEuropeanTable,
  emptyStanding,
  expandChampionsLeagueTable,
  fillMissingEuropeanRounds,
  formatHomeAwayScore,
  liveScoreFromTimeline,
  simulateClubMatch,
  simulateMatchTimeline,
  simulateRestOfEuropeanRound,
  simulateRestOfLeagueRound,
  applyPlayerGoalsFloor,
  expectedScore,
  type ClubMatchResult,
  type EuropeanStanding,
  type LeagueStanding,
} from './matchEngine';
import { shuffle } from './util';
import { describeDrawSettledOnPenalties, settleDrawOnPenalties } from './penalties';
import { chanceMinute, type ChanceStake } from '../shooting/chanceAtmosphere';

export type InternationalStage =
  | 'not-selected'
  | 'qualifying'
  | 'qualified'
  | 'failed-qualifying'
  | 'friendly'
  | 'group'
  | 'round-of-32'
  | 'round-of-16'
  | 'quarter-final'
  | 'semi-final'
  | 'final'
  | 'eliminated'
  | 'champion';

export type DomesticCupProgress = DomesticCupStage | 'eliminated' | 'champion' | 'not-entered';

export interface SeasonHonours {
  leagueChampion: boolean;
  continentalChampion: ContinentalCupId | null;
  superCup: boolean;
  domesticSuperCup: string | null;
  internationalChampion: InternationalTournamentId | null;
  domesticCup: DomesticCupId | null;
}

export interface SeasonSimState {
  fixtureIndex: number;
  leagueTable: LeagueStanding[];
  europeanStanding: EuropeanStanding | null;
  /** League-phase table for the player's continental cup. */
  europeanTable: LeagueStanding[];
  europeanGroupPoints: number;
  europeanGroupPlayed: number;
  /** Clubs still alive in the continental knockout, including the player. */
  europeanKnockoutField: string[] | null;
  knockoutAggFor: number;
  knockoutAggAgainst: number;
  internationalStage: InternationalStage;
  internationalSelected: boolean;
  internationalTournament: InternationalTournamentId | null;
  internationalPhase: InternationalCampaignPhase;
  nationId: string | null;
  qualifierPoints: number;
  qualifierPlayed: number;
  qualifierTarget: number;
  /** Points/games carried from the previous half of a split qualifying campaign. */
  qualifierCarryPoints: number;
  qualifierCarryPlayed: number;
  groupPoints: number;
  groupPlayed: number;
  nationQualified: boolean;
  domesticCup: DomesticCupId | null;
  domesticCupStage: DomesticCupProgress;
  honours: SeasonHonours;
  /** Strongest other club in the league — lose home and away and the title is gone. */
  titleRivalId: string | null;
  rivalHomeOutcome: ClubMatchResult['outcome'] | null;
  rivalAwayOutcome: ClubMatchResult['outcome'] | null;
  playoffStage: PlayoffRound | 'pending' | 'eliminated' | 'champion' | 'not-qualified' | null;
  leaguesCupStage: LeaguesCupStage | 'eliminated' | 'champion' | 'not-entered';
  leaguesCupGroupPlayed: number;
  leaguesCupGroupPoints: number;
  superCupStage: SuperCupStage | 'eliminated' | 'champion' | 'not-entered';
  domesticSuperCupStage: SuperCupStage | 'eliminated' | 'champion' | 'not-entered';
  /** Furthest international round played this season (set when going out or winning). */
  internationalReached: InternationalStage | null;
  /** Live group table for the player's World Cup / Euros / Nations League group. */
  internationalGroup: IntlGroupState | null;
  friendlyPlayed: number;
  knockoutGamesScored: number;
}

export interface LiveMatch {
  fixtureIndex: number;
  chancesTotal: number;
  chancesTaken: number;
  goals: number;
  /** Open-play goals only — penalties do not reset the drop window. */
  openPlayGoals?: number;
  /** Extra kick after a knockout finished level. */
  penaltyKick?: boolean;
  goalsAtNinety?: number;
  ninetyScoreFor?: number;
  ninetyScoreAgainst?: number;
}

/** Stable per-match seed so the board shown between chances matches full time. */
export function liveMatchScoreSeed(seasonNumber: number, fixtureIndex: number, clubId: string): number {
  let h = 2166136261 ^ (seasonNumber >>> 0) ^ Math.imul(fixtureIndex + 1, 2654435761);
  for (let i = 0; i < clubId.length; i++) {
    h ^= clubId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fixtureChanceStake(fixture: CalendarFixture): ChanceStake {
  if (isFinalFixture(fixture)) return 'final';
  if (fixture.kind !== 'league' && fixture.kind !== 'rest') return 'cup';
  return 'league';
}

export function liveMatchBoardLine(args: {
  sim: SeasonSimState;
  fixture: CalendarFixture;
  club: Club;
  live: LiveMatch;
  seasonNumber: number;
}): string {
  const { sim, fixture, club, live, seasonNumber } = args;
  if (live.penaltyKick && live.ninetyScoreFor != null && live.ninetyScoreAgainst != null) {
    return formatHomeAwayScore(live.ninetyScoreFor, live.ninetyScoreAgainst, scoreboardPlayerOnLeft(fixture));
  }
  const rng = mulberry32(liveMatchScoreSeed(seasonNumber, live.fixtureIndex, club.id));
  const isHome = fixtureIsHome(fixture);
  const isInternational = fixture.kind === 'international';
  const clubOpp = !isInternational && fixture.opponentId ? getClub(fixture.opponentId) : undefined;
  const us = isInternational
    ? (sim.nationId ? nationStrength(sim.nationId) : 70)
    : club.strength;
  const them = isInternational
    ? (fixture.opponentId ? nationStrength(fixture.opponentId) : 70)
    : (clubOpp?.strength ?? 70);
  const context = isInternational
    ? { clubStrength: us, opponentStrength: them, isHome, knockout: isOneOffKnockout(fixture) }
    : {
      clubTier: club.tier,
      opponentTier: clubOpp?.tier ?? 3,
      clubStrength: club.strength,
      opponentStrength: clubOpp?.strength,
      isHome,
    };
  const timeline = simulateMatchTimeline(context, rng, fixture.playerChances);
  const minute = chanceMinute(
    live.chancesTaken,
    Math.max(1, live.chancesTotal || fixture.playerChances || 1),
    fixtureChanceStake(fixture),
  );
  const sliced = liveScoreFromTimeline(timeline, minute, live.goals);
  const result = applyPlayerGoalsFloor(
    { scoreFor: sliced.scoreFor, scoreAgainst: sliced.scoreAgainst, outcome: 'draw' },
    live.goals,
  );
  return formatHomeAwayScore(result.scoreFor, result.scoreAgainst, scoreboardPlayerOnLeft(fixture));
}

export function liveMatchBoardScores(args: {
  sim: SeasonSimState;
  fixture: CalendarFixture;
  club: Club;
  live: LiveMatch;
  seasonNumber: number;
}): { scoreFor: number; scoreAgainst: number; line: string } {
  const line = liveMatchBoardLine(args);
  const [left, right] = line.split('\u2013').map((part) => Number(part));
  const playerOnLeft = scoreboardPlayerOnLeft(args.fixture);
  const scoreFor = playerOnLeft ? left : right;
  const scoreAgainst = playerOnLeft ? right : left;
  return {
    scoreFor: Number.isFinite(scoreFor) ? scoreFor : 0,
    scoreAgainst: Number.isFinite(scoreAgainst) ? scoreAgainst : 0,
    line,
  };
}

export interface HydrateSeasonParams {
  seasonNumber: number;
  club: Club;
  /** First-team career ratio. Trial and the reserve year are excluded. */
  careerGoalRatio: number;
  nationId: string | null;
  qualifierCarry?: {
    tournament: InternationalTournamentId;
    points: number;
    played: number;
    opponentIds?: string[];
    group?: IntlGroupState;
  } | null;
  includeSuperCup?: boolean;
  superCupOpponentId?: string;
  includeDomesticSuperCup?: boolean;
  domesticSuperCupOpponentId?: string;
  domesticSuperCupName?: string;
  /** League the club is actually playing in (top flight after promotion). */
  league?: string;
  /** Last season's table / defending title. Undefined falls back to club tier. */
  continentalCup?: ContinentalCupId | null;
  /** Qualifier nations already faced — skip them while the pool still has unused sides. */
  excludeQualifierIds?: string[];
  rng?: () => number;
  /** Reserve year: league fixtures only, no cups or continentals. */
  leagueOnly?: boolean;
  /** Which start path this season belongs to — drives the international year. */
  careerStart?: string | null;
  /** Starters only are called up. Omitted treats the player as a starter. */
  squadStatus?: SquadStatus | null;
}

const GROUP_GAMES = 8;
const GROUP_ADVANCE_POINTS = 10;

const CUP_STAGE_ORDER: DomesticCupStage[] = ['round-of-16', 'quarter-final', 'semi-final', 'final'];

export function emptyHonours(): SeasonHonours {
  return {
    leagueChampion: false,
    continentalChampion: null,
    superCup: false,
    domesticSuperCup: null,
    internationalChampion: null,
    domesticCup: null,
  };
}

export function hydrateSeason(params: HydrateSeasonParams): { calendar: SeasonCalendar; sim: SeasonSimState } {
  const { seasonNumber, club, careerGoalRatio, nationId, qualifierCarry, includeSuperCup, superCupOpponentId } = params;
  const league = params.league ?? club.league;
  const clubConfederation = confederationForCountry(club.country);
  const nation = nationId ? getNation(nationId) : undefined;
  const leagueOnly = Boolean(params.leagueOnly);
  const cup = leagueOnly
    ? null
    : params.continentalCup !== undefined
      ? params.continentalCup
      : clubContinentalCup(club);
  const isMls = league === 'MLS';
  const saudiSuper = !leagueOnly && league === 'Saudi Pro League' && qualifiesForSaudiSuperCup(club);
  const domesticSuper = Boolean(!leagueOnly && params.includeDomesticSuperCup && params.domesticSuperCupName);
  const intlSeason = internationalCalendarSeason(seasonNumber, {
    leagueOnly,
    careerStart: params.careerStart,
  });
  const campaign = internationalCampaignForSeason(intlSeason, nation?.confederation ?? clubConfederation);
  const tournament = campaign.tournament ?? null;
  const clubOk = clubEligibleForNationalTeam(club.tier, nationId, league);
  const campaignActive = Boolean(
    !leagueOnly &&
      intlSeason >= 1 &&
      nationId &&
      campaign.tournament &&
      campaignSchedulesInternational(campaign.phase),
  );
  const inEuro = tournament !== 'euro' || Boolean(nationId && isEuroDefaultQualifier(nationId));
  const inNationsLeague =
    tournament !== 'nations-league' || Boolean(nationId && nationsLeagueGroupLetter(nationId));
  const publicSeason = intlSeason >= 1 ? intlSeason : null;
  const startsAtTournament =
    campaign.phase === 'nations-league' || campaign.phase === 'tournament-only';
  const carryMatches = Boolean(
    qualifierCarry && tournament && qualifierCarry.tournament === tournament,
  );
  const internationalSelected = Boolean(
    campaignActive &&
      inEuro &&
      inNationsLeague &&
      clubOk &&
      isSelectedForNationalTeam({
        clubTier: club.tier,
        careerGoalRatio,
        nationId,
        publicSeason,
        calendarWeek: 1,
        squadStatus: params.squadStatus ?? 'starter',
        league,
      }),
  );

  let calendar = buildSeasonCalendar({
    seasonNumber,
    leagueMatchWeeks: leagueMatchWeeks(league, club),
    clubTier: club.tier,
    confederation: clubConfederation,
    country: club.country,
    nationConfederation: nation?.confederation ?? null,
    includeInternational: campaignActive && inEuro && inNationsLeague,
    includeDomesticCup: !leagueOnly,
    includeSuperCup: Boolean(!leagueOnly && includeSuperCup && cup && clubConfederation === 'UEFA'),
    includePlayoffs: !leagueOnly && isMls,
    // Every MLS first-team season, including the first after a transfer in.
    // Liga MX sides fill the group; reserve years stay league-only.
    includeLeaguesCup: !leagueOnly && isMls,
    includeSaudiSuperCup: saudiSuper,
    includeDomesticSuperCup: domesticSuper,
    domesticSuperCupName: domesticSuper ? params.domesticSuperCupName : undefined,
    league,
    continentalCup: cup,
    internationalSeasonNumber: intlSeason,
  });
  calendar = assignOpponentsAndChances(
    calendar,
    club,
    cup,
    nationId,
    tournament,
    campaign.qualifierGames,
    superCupOpponentId,
    params.domesticSuperCupOpponentId,
    league,
    params.excludeQualifierIds,
    params.rng,
    seasonNumber,
    carryMatches ? qualifierCarry?.opponentIds : undefined,
    Boolean(carryMatches && (qualifierCarry?.played ?? 0) > 0),
  );

  const leagueClubs = clubsForSeason(club, league);
  const leagueTable = leagueClubs.map((c) => emptyStanding(c.id));
  const europeanStanding: EuropeanStanding | null = cup ? { cup, stage: 'group' } : null;
  const europeanTable = cup ? emptyEuropeanTable(clubsForContinentalCup(cup, club.id)) : [];
  const domesticCup = calendar.domesticCup ?? null;
  const hasFriendlies = calendar.fixtures.some((f) => f.internationalRound === 'friendly');
  const titleRival = pickTitleRival(club, league);
  const carryGroup = carryMatches ? qualifierCarry?.group ?? null : null;
  const nationCampaign = Boolean(campaignActive && inEuro && inNationsLeague);
  const internationalGroup = nationId && tournament && (nationCampaign || carryGroup)
    ? (carryGroup ?? buildInternationalGroup(nationId, tournament, calendar, seasonNumber, startsAtTournament ? 'finals' : 'qualifying'))
    : null;

  const qualifyingStage = Boolean(
    nationCampaign && (campaign.phase === 'qualifiers' || campaign.phase === 'qualifiers-and-tournament'),
  );

  let sim: SeasonSimState = {
      fixtureIndex: 0,
      leagueTable,
      europeanStanding,
      europeanTable,
      europeanGroupPoints: 0,
      europeanGroupPlayed: 0,
      europeanKnockoutField: null,
      knockoutAggFor: 0,
      knockoutAggAgainst: 0,
      internationalStage: qualifyingStage
        ? 'qualifying'
        : internationalSelected
          ? (startsAtTournament ? (hasFriendlies ? 'friendly' : 'group') : 'qualifying')
          : 'not-selected',
      internationalSelected,
      internationalTournament: nationCampaign ? tournament : null,
      internationalPhase: nationCampaign ? campaign.phase : 'none',
      nationId: nationId ?? null,
      qualifierPoints: 0,
      qualifierPlayed: 0,
      qualifierTarget: campaignActive ? campaign.qualifierGames : 0,
      qualifierCarryPoints: carryMatches && qualifierCarry ? qualifierCarry.points : 0,
      qualifierCarryPlayed: carryMatches && qualifierCarry ? qualifierCarry.played : 0,
      groupPoints: 0,
      groupPlayed: 0,
      nationQualified: Boolean(startsAtTournament && nationCampaign),
      domesticCup,
      domesticCupStage: domesticCup ? 'round-of-16' : 'not-entered',
      honours: emptyHonours(),
      titleRivalId: titleRival?.id ?? null,
      rivalHomeOutcome: null,
      rivalAwayOutcome: null,
      playoffStage: !leagueOnly && isMls ? 'pending' : null,
      leaguesCupStage: !leagueOnly && isMls ? 'group' : 'not-entered',
      leaguesCupGroupPlayed: 0,
      leaguesCupGroupPoints: 0,
      superCupStage: saudiSuper ? 'semi-final' : (includeSuperCup && cup && clubConfederation === 'UEFA' ? 'final' : 'not-entered'),
      domesticSuperCupStage: domesticSuper ? 'final' : 'not-entered',
      internationalReached: null,
      internationalGroup,
      friendlyPlayed: 0,
      knockoutGamesScored: 0,
  };
  if (qualifyingStage && nationId) {
    sim = seedMissingFirstHalfQualifying(sim, calendar, nationId, seasonNumber);
  }

  return {
    calendar,
    sim,
  };
}

/** When Season 2 starts without a carried table, NPC the missing first five qualifying matches. */
function seedMissingFirstHalfQualifying(
  sim: SeasonSimState,
  calendar: SeasonCalendar,
  nationId: string,
  seasonNumber: number,
): SeasonSimState {
  if (sim.internationalPhase !== 'qualifiers-and-tournament') return sim;
  const firstHalfTarget = (sim.internationalGroup?.teamIds.length ?? 0) >= 10
    || getNation(nationId)?.confederation === 'CONMEBOL'
    ? 9
    : 5;
  if ((sim.qualifierCarryPlayed ?? 0) >= firstHalfTarget) return sim;
  const quals = calendar.fixtures.filter(
    (f) => f.kind === 'international' && f.internationalRound === 'qualifier' && f.opponentId,
  );
  if (quals.length === 0) return sim;
  let group = sim.internationalGroup?.kind === 'qualifying'
    ? sim.internationalGroup
    : buildInternationalGroup(nationId, sim.internationalTournament ?? 'world-cup', calendar, seasonNumber, 'qualifying');
  if (!group) return sim;
  let points = sim.qualifierCarryPoints ?? 0;
  let played = sim.qualifierCarryPlayed ?? 0;
  for (const fixture of quals) {
    if (played >= firstHalfTarget) break;
    const opponentId = fixture.opponentId!;
    const isHome = fixture.isHome === false;
    group = applyNpcNationMatch(
      group,
      nationId,
      opponentId,
      isHome,
      `${nationId}-wc-s1-${opponentId}-${played}`,
    );
    const row = group.rows.find((item) => item.nationId === nationId);
    played += 1;
    points = row?.points ?? points;
  }
  return {
    ...sim,
    internationalGroup: group,
    qualifierCarryPoints: points,
    qualifierCarryPlayed: played,
  };
}

/** The club the player must beat (or at least not lose to twice) to stay in the title race. */
export function pickTitleRival(club: Club, league?: string): Club | undefined {
  const others = clubsForSeason(club, league ?? club.league).filter((c) => c.id !== club.id);
  const conf = mlsConferenceOf(club.id);
  const pool = conf ? others.filter((c) => mlsConferenceOf(c.id) === conf) : others;
  const ranked = (pool.length > 0 ? pool : others).sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  return ranked[0];
}

export function lostTitleToRival(sim: SeasonSimState): boolean {
  return sim.rivalHomeOutcome === 'loss' && sim.rivalAwayOutcome === 'loss';
}

export function conferenceTable(table: SeasonSimState['leagueTable'], clubId: string): SeasonSimState['leagueTable'] {
  const conf = mlsConferenceOf(clubId);
  if (!conf) return table;
  const rows = table.filter((r) => mlsConferenceOf(r.clubId) === conf);
  return rows
    .slice()
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return a.clubId.localeCompare(b.clubId);
    })
    .map((row, i) => ({ ...row, position: i + 1 }));
}

export function canWinLeague(sim: SeasonSimState, clubId: string): boolean {
  if (sim.playoffStage != null) return sim.playoffStage === 'champion' || sim.honours.leagueChampion;
  if (lostTitleToRival(sim)) return false;
  return (sim.leagueTable.find((r) => r.clubId === clubId)?.position ?? 0) === 1;
}

function nationAsOpponent(id: string) {
  const n = getNation(id);
  if (!n) return { id, name: nationLabel(id), confederation: 'UEFA' as const };
  return { id: n.id, name: n.name, confederation: n.confederation };
}

function internationalGroupOpponentIds(
  nationId: string | null,
  tournament: InternationalTournamentId | null,
  seasonNumber: number,
  fallback: string[],
): string[] {
  if (!nationId || !tournament) return fallback;
  if (tournament === 'nations-league') {
    return nationsLeagueGroupTeams(nationId).filter((id) => id !== nationId);
  }
  if (tournament === 'euro') {
    const g = euroGroupForNation(nationId, seasonNumber);
    return g ? g.teams.filter((id) => id !== nationId) : fallback;
  }
  return fallback;
}

export function buildInternationalGroup(
  nationId: string,
  tournament: InternationalTournamentId,
  calendar: SeasonCalendar,
  seasonNumber: number,
  prefer: 'qualifying' | 'finals' | 'auto' = 'auto',
): IntlGroupState | null {
  const uniqueIds = (round: NonNullable<CalendarFixture['internationalRound']>) =>
    calendar.fixtures
      .filter((f) => f.kind === 'international' && f.internationalRound === round && f.opponentId)
      .map((f) => f.opponentId!)
      .filter((id, i, arr) => arr.indexOf(id) === i);
  const groupOpp = uniqueIds('group');
  const qualOpp = uniqueIds('qualifier');
  const useQualifying =
    prefer === 'qualifying' || (prefer === 'auto' && groupOpp.length === 0 && qualOpp.length > 0);
  if (useQualifying && qualOpp.length > 0) {
    const nation = getNation(nationId);
    if (tournament === 'world-cup' && nation?.confederation === 'CONMEBOL') {
      const teams = nationsInConfederation('CONMEBOL').map((n) => n.id);
      if (!teams.includes(nationId)) teams.unshift(nationId);
      return createGroupState('Q', teams, 'qualifying');
    }
    const teams = [nationId, ...qualOpp];
    return createGroupState('Q', teams, 'qualifying');
  }
  if (groupOpp.length === 0) return null;
  let letter = 'A';
  if (tournament === 'nations-league') letter = nationsLeagueGroupLetter(nationId) ?? 'A';
  else if (tournament === 'euro') letter = euroGroupForNation(nationId, seasonNumber)?.letter ?? 'A';
  const teams = [nationId, ...groupOpp];
  return createGroupState(letter, teams, 'finals');
}

export function internationalGroupPrefer(
  stage: InternationalStage | null | undefined,
): 'qualifying' | 'finals' | 'auto' {
  if (stage === 'qualifying' || stage === 'failed-qualifying') return 'qualifying';
  if (!stage || stage === 'not-selected' || stage === 'qualified') return 'auto';
  return 'finals';
}

function groupMatchesPrefer(
  group: IntlGroupState | null | undefined,
  prefer: 'qualifying' | 'finals' | 'auto',
): boolean {
  if (!group) return false;
  if (prefer === 'auto') return true;
  if (prefer === 'qualifying') return group.kind === 'qualifying';
  return group.kind !== 'qualifying';
}

function groupsEquivalent(
  a: IntlGroupState | null | undefined,
  b: IntlGroupState | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  if (a.kind !== b.kind || a.letter !== b.letter) return false;
  if (a.teamIds.length !== b.teamIds.length) return false;
  const other = new Set(b.teamIds);
  return a.teamIds.every((id) => other.has(id));
}

/** Qualifying leftovers on a finals-only calendar (Euro / continental) crash the hub. */
function leftoverQualifyingInFinalsYear(
  sim: Pick<SeasonSimState, 'internationalStage' | 'internationalPhase'>,
  calendar: SeasonCalendar,
): boolean {
  if (sim.internationalStage !== 'qualifying' && sim.internationalStage !== 'failed-qualifying') {
    return false;
  }
  if (sim.internationalPhase === 'qualifiers') return false;
  const hasQualifier = calendar.fixtures.some(
    (f) => f.kind === 'international' && f.internationalRound === 'qualifier',
  );
  if (hasQualifier) return false;
  return (
    sim.internationalPhase === 'tournament-only'
    || sim.internationalPhase === 'nations-league'
    || calendar.fixtures.some((f) => f.kind === 'international' && f.internationalRound === 'group')
  );
}

/** Stage to use when a player is first called up mid-season. */
export function internationalStageWhenSelected(
  sim: Pick<SeasonSimState, 'internationalStage' | 'internationalPhase'>,
): InternationalStage {
  if (sim.internationalStage === 'qualified') return 'friendly';
  if (sim.internationalStage && sim.internationalStage !== 'not-selected') {
    return sim.internationalStage;
  }
  if (sim.internationalPhase === 'tournament-only' || sim.internationalPhase === 'nations-league') {
    return 'group';
  }
  return 'qualifying';
}

/**
 * Existing saves often have no table, or a finals group left over while still
 * qualifying. Rebuild from the calendar so a restart still shows the right one.
 * Always return the same `sim` reference when the table does not change so the
 * hub cannot loop on a new object every render.
 */
export function ensureInternationalGroup(
  sim: SeasonSimState,
  calendar: SeasonCalendar | null | undefined,
  seasonNumber: number,
): SeasonSimState {
  if (!calendar || !sim.nationId || !sim.internationalTournament) return sim;
  const internationalStage = leftoverQualifyingInFinalsYear(sim, calendar)
    ? 'group'
    : sim.internationalStage;
  const stageChanged = internationalStage !== sim.internationalStage;
  const prefer = internationalGroupPrefer(internationalStage);
  const keepCarriedQualifying =
    sim.internationalGroup?.kind === 'qualifying' &&
    sim.internationalGroup.rows.some((row) => row.played > 0);
  if (!stageChanged && (keepCarriedQualifying || groupMatchesPrefer(sim.internationalGroup, prefer))) {
    return sim;
  }
  const internationalGroup = buildInternationalGroup(
    sim.nationId,
    sim.internationalTournament,
    calendar,
    seasonNumber,
    prefer,
  );
  if (!internationalGroup) {
    return stageChanged ? { ...sim, internationalStage } : sim;
  }
  if (!stageChanged && groupsEquivalent(sim.internationalGroup, internationalGroup)) return sim;
  return { ...sim, internationalStage, internationalGroup };
}

function setKnockoutOpponent(
  calendar: SeasonCalendar,
  kind: CalendarFixture['kind'],
  europeanRound: CalendarFixture['europeanRound'] | undefined,
  opponentId: string | null,
): SeasonCalendar {
  if (!opponentId) return calendar;
  const opp = getClub(opponentId);
  if (!opp) return calendar;
  return {
    ...calendar,
    fixtures: calendar.fixtures.map((f) => {
      const sameRound = kind === 'continental-knockout'
        ? f.kind === kind && f.europeanRound === europeanRound
        : f.kind === kind;
      if (!sameRound) return f;
      return { ...f, opponentId: opp.id, opponentLabel: opp.name };
    }),
  };
}

export function syncContinentalKnockoutCalendar(
  calendar: SeasonCalendar,
  sim: SeasonSimState,
  playerClubId?: string | null,
): SeasonCalendar {
  const standing = sim.europeanStanding;
  if (!standing || !playerClubId) return calendar;
  const stage = standing.stage;
  if (stage === 'group' || stage === 'eliminated' || stage === 'champion') return calendar;
  const field = sim.europeanKnockoutField ?? [];
  const used = calendar.fixtures
    .filter((f) => f.kind.startsWith('continental') && f.kind !== 'continental-group' && f.opponentId)
    .map((f) => f.opponentId!)
    .filter((id, i, arr) => arr.indexOf(id) === i);
  const seed = `${calendar.seasonNumber}-${standing.cup}-${playerClubId}-${stage}`;
  let opponentId: string | null = null;
  if (stage === 'play-off') {
    opponentId = uclPlayOffOpponentId(sim.europeanTable, playerClubId);
  } else if (stage === 'round-of-16' && standing.cup === 'ucl') {
    opponentId = uclRoundOf16OpponentId(sim.europeanTable, playerClubId, field, seed);
  } else if (stage === 'final' && standing.cup === 'ucl') {
    opponentId = pickUclFinalOpponent(playerClubId, field, seed, used);
  } else {
    opponentId = pickWeightedOpponent(playerClubId, field, seed, used);
  }
  if (stage === 'play-off' || stage === 'round-of-16' || stage === 'quarter-final') {
    return setKnockoutOpponent(calendar, 'continental-knockout', stage, opponentId);
  }
  if (stage === 'semi-final') {
    return setKnockoutOpponent(calendar, 'continental-semi-final', undefined, opponentId);
  }
  if (stage === 'final') {
    return setKnockoutOpponent(calendar, 'continental-final', undefined, opponentId);
  }
  return calendar;
}

export function syncInternationalCalendar(calendar: SeasonCalendar, sim: SeasonSimState): SeasonCalendar {
  if (
    sim.internationalTournament !== 'nations-league'
    || sim.internationalStage !== 'quarter-final'
    || !sim.nationId
    || !sim.internationalGroup
  ) {
    return calendar;
  }
  const oppId = nationsLeagueQuarterFinalOpponent(sim.nationId, sim.internationalGroup, `${calendar.seasonNumber}-nl`);
  if (!oppId) return calendar;
  const label = nationLabel(oppId);
  return {
    ...calendar,
    fixtures: calendar.fixtures.map((f) => {
      if (f.kind === 'international' && f.internationalRound === 'quarter-final') {
        return { ...f, opponentId: oppId, opponentLabel: label };
      }
      return f;
    }),
  };
}

function assignOpponentsAndChances(
  calendar: SeasonCalendar,
  club: Club,
  cup: ContinentalCupId | null,
  nationId: string | null,
  tournament: InternationalTournamentId | null,
  qualifierGames: number,
  superCupOpponentId?: string,
  domesticSuperCupOpponentId?: string,
  league?: string,
  excludeQualifierIds?: string[],
  rng: () => number = Math.random,
  seasonNumber = 1,
  reuseQualifierIds?: string[],
  flipQualifierVenues = false,
): SeasonCalendar {
  const leagueRivals = leagueOpponentQueue(club, league);
  const leaguePhase = cup ? leaguePhaseOpponents(club, cup, 8) : [];
  const euroRivals = cup
    ? shuffle(clubsForContinentalCup(cup, club.id).filter((id) => id !== club.id))
    : [];
  const usedCupIds = new Set<string>();
  const leaguesCupRivals = [
    ...shuffle(ligaMxClubs()),
    ...shuffle(clubsForSeason(club, league ?? club.league).filter((c) => c.id !== club.id)),
  ];
  const playoffRivals = shuffle(
    clubsForSeason(club, league ?? club.league).filter(
      (c) => c.id !== club.id && mlsConferenceOf(c.id) === mlsConferenceOf(club.id),
    ),
  );
  const otherConference = clubsForSeason(club, league ?? club.league).filter(
    (c) => c.id !== club.id && mlsConferenceOf(c.id) && mlsConferenceOf(c.id) !== mlsConferenceOf(club.id),
  );
  const mlsCupOpp = [...otherConference].sort((a, b) => b.strength - a.strength)[0];
  const saudiSuperRivals = shuffle(
    clubsInCountry('Saudi Arabia').filter((c) => c.id !== club.id && qualifiesForSaudiSuperCup(c)),
  );
  const reusedQualifierIds = (reuseQualifierIds ?? []).filter(Boolean).slice(0, qualifierGames);
  const qualifierRivals =
    reusedQualifierIds.length === qualifierGames && qualifierGames > 0
      ? reusedQualifierIds.map(nationAsOpponent).filter((n): n is NonNullable<typeof n> => Boolean(n))
      : nationId && tournament
        ? qualifierOpponents(nationId, tournament, qualifierGames, {
            extraExcludeIds: excludeQualifierIds,
            rng,
          })
        : [];
  const tournamentRivals = nationId && tournament ? tournamentOpponents(nationId, tournament, rng) : [];
  const groupCount = tournamentGroupGames(tournament);
  const groupSideIds = internationalGroupOpponentIds(nationId, tournament, seasonNumber, tournamentRivals.slice(0, groupCount).map((n) => n.id));
  const groupRivals = groupSideIds.map(nationAsOpponent).filter((n): n is NonNullable<typeof n> => Boolean(n));
  const friendlyPool = NATIONS.filter((n) => {
    if (n.id === nationId) return false;
    if (tournament === 'world-cup') return true;
    const confed = nationId ? getNation(nationId)?.confederation : null;
    if (confed) return n.confederation === confed;
    return true;
  });
  const friendlyRivals = nationId
    ? pickMixedRankOpponents(nationId, 2, friendlyPool, { extraExcludeIds: groupSideIds, rng })
    : [];
  const knockoutRivals = tournamentRivals.slice(groupCount);
  const usedEuro = new Set(leaguePhase.map((c) => c.id));
  const nextEuroOpponent = (label: string): ReturnType<typeof getClub> => {
    const field = euroRivals.filter((id) => id !== club.id && !usedEuro.has(id));
    const id = pickWeightedOpponent(club.id, field.length > 0 ? field : euroRivals.filter((x) => x !== club.id), `${seasonNumber}-${club.id}-${label}`);
    if (!id) return undefined;
    usedEuro.add(id);
    return getClub(id);
  };

  let leagueI = 0;
  let groupI = 0;
  let leaguesI = 0;
  let playoffI = 0;
  let superI = 0;
  let qualifierI = 0;
  let groupOppI = 0;
  let knockoutI = 0;
  let friendlyI = 0;

  const fixtures = calendar.fixtures.map((f) => ({ ...f }));
  const leagueCount = fixtures.filter((fx) => fx.kind === 'league').length;

  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    if (f.kind === 'league') {
      const opp = leagueRivals[leagueI];
      f.isHome = leagueFixtureIsHome(leagueI, leagueCount);
      leagueI += 1;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'domestic-cup') {
      const opp = pickDomesticCupOpponent(club, f.domesticCupStage, usedCupIds, league);
      if (opp) usedCupIds.add(opp.id);
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'super-cup') {
      const saudiOpp = saudiSuperRivals[superI % Math.max(1, saudiSuperRivals.length)];
      if (f.superCupStage) superI += 1;
      const assignedId = f.domesticSuperCup ? domesticSuperCupOpponentId : superCupOpponentId;
      const opp = (assignedId ? getClub(assignedId) : undefined)
        ?? (saudiSuperRivals.length > 0 && f.superCupStage ? saudiOpp : undefined)
        ?? nextEuroOpponent('super-cup');
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'leagues-cup') {
      const opp = leaguesCupRivals[leaguesI % Math.max(1, leaguesCupRivals.length)];
      leaguesI += 1;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'playoff') {
      const opp = f.playoffRound === 'mls-cup'
        ? mlsCupOpp
        : playoffRivals[playoffI % Math.max(1, playoffRivals.length)];
      if (f.playoffRound !== 'mls-cup') playoffI += 1;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'continental-group') {
      const opp = leaguePhase[groupI] ?? (euroRivals[groupI % Math.max(1, euroRivals.length)]
        ? getClub(euroRivals[groupI % Math.max(1, euroRivals.length)])
        : undefined);
      groupI += 1;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
      f.isHome = (groupI - 1) % 2 === 0;
    } else if (f.kind === 'continental-knockout' && f.leg === 1) {
      const opp = nextEuroOpponent(f.europeanRound ?? 'knockout');
      const [leg1, leg2] = chancesForKnockoutTie({ strength: club.strength });
      f.playerChances = leg1.count;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      const ret = findReturnLeg(fixtures, i);
      if (ret) {
        ret.playerChances = leg2.count;
        if (opp) {
          ret.opponentId = opp.id;
          ret.opponentLabel = opp.name;
        }
      }
    } else if (f.kind === 'continental-knockout' && f.leg === 2 && f.playerChances === undefined) {
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'continental-semi-final' && f.leg === 1) {
      const opp = nextEuroOpponent('semi-final');
      const [leg1, leg2] = chancesForKnockoutTie({ strength: club.strength });
      f.playerChances = leg1.count;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      const ret = findReturnLeg(fixtures, i);
      if (ret) {
        ret.playerChances = leg2.count;
        if (opp) {
          ret.opponentId = opp.id;
          ret.opponentLabel = opp.name;
        }
      }
    } else if (f.kind === 'continental-semi-final' && f.leg === 2 && f.playerChances === undefined) {
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'continental-final') {
      const opp = cup === 'ucl'
        ? (() => {
            const field = euroRivals.filter((id) => id !== club.id && !usedEuro.has(id));
            const id = pickUclFinalOpponent(
              club.id,
              field.length > 0 ? field : euroRivals.filter((x) => x !== club.id),
              `${seasonNumber}-${club.id}-final`,
            );
            if (id) usedEuro.add(id);
            return id ? getClub(id) : undefined;
          })()
        : nextEuroOpponent('final');
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'international') {
      let opp: { id: string; name: string } | undefined;
      let venueIndex = 0;
      if (f.internationalRound === 'qualifier') {
        venueIndex = qualifierI;
        opp = qualifierRivals[qualifierI];
        qualifierI += 1;
      } else if (f.internationalRound === 'friendly') {
        venueIndex = friendlyI;
        opp = friendlyRivals[friendlyI % Math.max(1, friendlyRivals.length)];
        friendlyI += 1;
      } else if (f.internationalRound === 'group') {
        venueIndex = groupOppI;
        opp = groupRivals[groupOppI];
        groupOppI += 1;
      } else {
        venueIndex = knockoutI;
        opp = knockoutRivals[knockoutI];
        knockoutI += 1;
      }
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      const nationStr = nationId ? nationStrength(nationId) : club.strength;
      f.playerChances = chancesForLeagueMatch({ strength: nationStr }).count;
      const venue = internationalVenueFlags(f.internationalRound, tournament, venueIndex);
      f.isHome = venue.isHome;
      f.neutral = venue.neutral;
      if (f.internationalRound === 'qualifier' && flipQualifierVenues) f.isHome = !f.isHome;
    }
  }

  for (const f of fixtures) {
    if (f.kind === 'rest') continue;
    if (f.kind === 'continental-knockout' || f.kind === 'continental-semi-final') {
      f.isHome = f.leg !== 2;
    } else if (typeof f.isHome !== 'boolean') {
      f.isHome = fixtureIsHome(f);
    }
  }

  return { ...calendar, fixtures };
}

/** League fixtures often sit between two-legged ties after week sort. */
function findReturnLeg(fixtures: CalendarFixture[], firstIndex: number): CalendarFixture | undefined {
  const first = fixtures[firstIndex];
  for (let j = firstIndex + 1; j < fixtures.length; j++) {
    const second = fixtures[j];
    if (second.kind !== first.kind || second.leg !== 2 || second.opponentId) continue;
    if (first.europeanRound && second.europeanRound && first.europeanRound !== second.europeanRound) continue;
    return second;
  }
  return undefined;
}

function topFlightLeagueName(club: Club, seasonLeague?: string | null): string {
  const league = seasonLeague ?? club.league;
  if (SECOND_DIVISIONS.has(league)) return promotionTarget(league) ?? league;
  return league;
}

export function domesticCupOpponentAllowed(
  opponent: Club,
  stage: DomesticCupStage | undefined,
  club: Club,
  seasonLeague?: string | null,
): boolean {
  if (opponent.id === club.id) return false;
  const topLeague = topFlightLeagueName(club, seasonLeague);
  const secondDiv = SECOND_DIVISIONS.has(opponent.league);
  if (stage === 'quarter-final') {
    return !secondDiv && opponent.league === topLeague && (opponent.tier <= 3 || opponent.strength >= 72);
  }
  if (stage === 'semi-final' || stage === 'final') {
    return !secondDiv && opponent.league === topLeague && (opponent.tier <= 2 || opponent.strength >= 80);
  }
  return true;
}

/**
 * First cup round can draw second-division sides. Quarter-finals are top-flight
 * only. Semi-finals and the final use the strongest clubs in the country.
 */
export function pickDomesticCupOpponent(
  club: Club,
  stage: DomesticCupStage | undefined,
  usedIds: Set<string>,
  seasonLeague?: string | null,
): Club | undefined {
  const country = clubsInCountry(club.country).filter((c) => c.id !== club.id && !usedIds.has(c.id));
  const topLeague = topFlightLeagueName(club, seasonLeague);
  const topFlight = clubsInLeague(topLeague).filter((c) => c.id !== club.id && !usedIds.has(c.id));
  const secondDiv = country.filter((c) => SECOND_DIVISIONS.has(c.league));
  const strongest = [...topFlight]
    .filter((c) => c.tier <= 2 || c.strength >= 80)
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  let pool: Club[];
  if (stage === 'semi-final' || stage === 'final') {
    pool = strongest.length > 0 ? strongest : [...topFlight].sort((a, b) => b.strength - a.strength).slice(0, 8);
  } else if (stage === 'quarter-final') {
    const qfPool = topFlight.filter((c) => c.tier <= 3 || c.strength >= 72);
    pool = qfPool.length > 0
      ? qfPool
      : [...topFlight].sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))
        .slice(0, Math.max(8, Math.ceil(topFlight.length * 0.65)));
  } else if (stage === 'round-of-16') {
    const weakerTop = [...topFlight].sort((a, b) => a.strength - b.strength).slice(0, Math.max(2, Math.ceil(topFlight.length / 3)));
    pool = secondDiv.length > 0 ? [...secondDiv, ...weakerTop.slice(0, 2)] : country.length > 0 ? country : topFlight;
  } else {
    pool = secondDiv.length > 0 ? secondDiv : country;
  }
  if (pool.length === 0) pool = topFlight.length > 0 ? topFlight : country;
  if (pool.length === 0) return undefined;
  return shuffle(pool)[0];
}

/** Rewrite unplayed cup ties whose opponent does not belong in that round. */
export function repairDomesticCupDraw(
  calendar: SeasonCalendar,
  club: Club,
  sim: SeasonSimState,
  seasonLeague?: string | null,
): SeasonCalendar {
  const used = new Set<string>();
  calendar.fixtures.forEach((f, i) => {
    if (f.kind === 'domestic-cup' && i < sim.fixtureIndex && f.opponentId) used.add(f.opponentId);
  });
  let changed = false;
  const fixtures = calendar.fixtures.map((f, i) => {
    if (f.kind !== 'domestic-cup' || i < sim.fixtureIndex) return f;
    const current = f.opponentId ? getClub(f.opponentId) : undefined;
    if (current && domesticCupOpponentAllowed(current, f.domesticCupStage, club, seasonLeague)) {
      used.add(current.id);
      return f;
    }
    const next = pickDomesticCupOpponent(club, f.domesticCupStage, used, seasonLeague);
    if (!next) return f;
    used.add(next.id);
    changed = true;
    return { ...f, opponentId: next.id, opponentLabel: next.name };
  });
  return changed ? { ...calendar, fixtures } : calendar;
}

/** Replace an unplayed UCL final if the opponent is not an elite/strong finalist. */
export function repairUclFinalOpponent(
  calendar: SeasonCalendar,
  club: Club,
  sim: SeasonSimState,
): SeasonCalendar {
  if (sim.europeanStanding?.cup !== 'ucl') return calendar;
  let changed = false;
  const fixtures = calendar.fixtures.map((f, i) => {
    if (f.kind !== 'continental-final' || i < sim.fixtureIndex) return f;
    const current = f.opponentId ? getClub(f.opponentId) : undefined;
    if (current && current.id !== club.id && isUclFinalistClub(current)) return f;
    const id = pickUclFinalOpponent(
      club.id,
      sim.europeanKnockoutField ?? [],
      `${calendar.seasonNumber}-${club.id}-ucl-final-repair`,
    );
    const opp = id ? getClub(id) : undefined;
    if (!opp || opp.id === current?.id) return f;
    changed = true;
    return { ...f, opponentId: opp.id, opponentLabel: opp.name };
  });
  return changed ? { ...calendar, fixtures } : calendar;
}

export function syncSeasonCalendars(
  calendar: SeasonCalendar,
  sim: SeasonSimState,
  playerClubId?: string | null,
  seasonLeague?: string | null,
): SeasonCalendar {
  let next = syncInternationalCalendar(calendar, sim);
  next = syncContinentalKnockoutCalendar(next, sim, playerClubId);
  const club = playerClubId ? getClub(playerClubId) : undefined;
  if (club) {
    next = repairDomesticCupDraw(next, club, sim, seasonLeague ?? club.league);
    next = repairUclFinalOpponent(next, club, sim);
  }
  return next;
}

/** Each league rival once, then the return fixture — never a third meeting. */
export function leagueOpponentQueue(club: Club, league?: string): Club[] {
  const seasonClubs = clubsForSeason(club, league ?? club.league);
  const conf = mlsConferenceOf(club.id);
  if ((league ?? club.league) === 'MLS' && conf) {
    const conference = shuffle(seasonClubs.filter((c) => c.id !== club.id && mlsConferenceOf(c.id) === conf));
    const inter = shuffle(seasonClubs.filter((c) => mlsConferenceOf(c.id) && mlsConferenceOf(c.id) !== conf));
    return [...conference, ...conference, ...inter.slice(0, 8)];
  }
  const rivals = shuffle(seasonClubs.filter((c) => c.id !== club.id));
  return [...rivals, ...rivals];
}

/** Home and away are interleaved so the second half of the season is not an away-only run. */
export function leagueFixtureIsHome(index: number, leagueGameCount: number): boolean {
  const unique = Math.max(1, Math.floor(leagueGameCount / 2));
  const firstHalf = index < unique;
  const rival = index % unique;
  return firstHalf ? rival % 2 === 0 : rival % 2 === 1;
}

export function reassignLeagueHomeAway<T extends { kind: string; isHome?: boolean }>(fixtures: T[]): T[] {
  const copy = fixtures.map((f) => ({ ...f }));
  const leagueIdx = copy.map((f, i) => (f.kind === 'league' ? i : -1)).filter((i) => i >= 0);
  const n = leagueIdx.length;
  leagueIdx.forEach((fi, i) => {
    copy[fi].isHome = leagueFixtureIsHome(i, n);
  });
  return copy;
}

/** Skip cups/internationals the player is already out of, and 0-chance weeks. */
export function isPlayableFixture(fixture: CalendarFixture, sim: SeasonSimState): boolean {
  if (shouldSkipFixture(fixture, sim)) return false;
  return (fixture.playerChances ?? 1) > 0;
}

export function nextPlayableFixture(
  calendar: SeasonCalendar,
  sim: SeasonSimState,
): CalendarFixture | undefined {
  for (let i = sim.fixtureIndex; i < calendar.fixtures.length; i++) {
    const fixture = calendar.fixtures[i];
    if (isPlayableFixture(fixture, sim)) return fixture;
  }
  return undefined;
}

/** Next calendar fixture Continue will actually resolve (includes 0-chance sit-outs). */
export function nextActionableFixture(
  calendar: SeasonCalendar,
  sim: SeasonSimState,
): CalendarFixture | undefined {
  for (let i = sim.fixtureIndex; i < calendar.fixtures.length; i++) {
    const fixture = calendar.fixtures[i];
    if (shouldSkipFixture(fixture, sim)) continue;
    return fixture;
  }
  return undefined;
}

export function remainingPlayableCount(calendar: SeasonCalendar, sim: SeasonSimState): number {
  let n = 0;
  for (let i = sim.fixtureIndex; i < calendar.fixtures.length; i++) {
    if (isPlayableFixture(calendar.fixtures[i], sim)) n += 1;
  }
  return n;
}

export function shouldSkipFixture(fixture: CalendarFixture, sim: SeasonSimState): boolean {
  if (fixture.kind === 'rest') return true;
  if (fixture.kind === 'super-cup') {
    if (fixture.domesticSuperCup) {
      return (sim.domesticSuperCupStage ?? 'not-entered') !== 'final';
    }
    const stage = sim.superCupStage;
    if (stage === 'not-entered' || stage === 'eliminated' || stage === 'champion') return true;
    if (fixture.superCupStage) return fixture.superCupStage !== stage;
    return false;
  }

  if (fixture.kind === 'leagues-cup') {
    const stage = sim.leaguesCupStage;
    if (stage === 'not-entered' || stage === 'eliminated' || stage === 'champion') return true;
    return fixture.leaguesCupStage !== stage;
  }

  if (fixture.kind === 'playoff') {
    if (
      sim.playoffStage == null
      || sim.playoffStage === 'pending'
      || sim.playoffStage === 'eliminated'
      || sim.playoffStage === 'champion'
      || sim.playoffStage === 'not-qualified'
    ) {
      return true;
    }
    return fixture.playoffRound !== sim.playoffStage;
  }

  if (fixture.kind === 'domestic-cup') {
    const stage = sim.domesticCupStage;
    if (stage === 'eliminated' || stage === 'champion' || stage === 'not-entered') return true;
    return fixture.domesticCupStage !== stage;
  }

  if (fixture.kind.startsWith('continental')) {
    const stage = sim.europeanStanding?.stage;
    if (!stage || stage === 'eliminated') return true;
    if (fixture.kind === 'continental-group') return stage !== 'group';
    if (fixture.kind === 'continental-knockout') {
      if (stage !== 'play-off' && stage !== 'round-of-16' && stage !== 'quarter-final') return true;
      if (fixture.europeanRound) return fixture.europeanRound !== stage;
      return false;
    }
    if (fixture.kind === 'continental-semi-final') return stage !== 'semi-final';
    if (fixture.kind === 'continental-final') return stage !== 'final';
  }

  if (fixture.kind === 'international') {
    if (!sim.internationalSelected) return true;
    const stage = sim.internationalStage;
    if (stage === 'eliminated' || stage === 'not-selected' || stage === 'champion' || stage === 'failed-qualifying') {
      return true;
    }
    if (fixture.internationalRound === 'qualifier') {
      return stage !== 'qualifying';
    }
    if (fixture.internationalRound === 'friendly') {
      return stage !== 'friendly';
    }
    if (stage === 'qualifying' || stage === 'qualified' || stage === 'friendly') {
      return true;
    }
    if (fixture.internationalRound === 'group') return stage !== 'group';
    if (fixture.internationalRound === 'round-of-32') return stage !== 'round-of-32';
    if (fixture.internationalRound === 'round-of-16') return stage !== 'round-of-16';
    if (fixture.internationalRound === 'quarter-final') return stage !== 'quarter-final';
    if (fixture.internationalRound === 'semi-final') return stage !== 'semi-final';
    if (fixture.internationalRound === 'final') return stage !== 'final';
  }
  return false;
}

/** Unselected players still have their country play World Cup qualifying in the background. */
export function shouldSimulateNationQualifier(fixture: CalendarFixture, sim: SeasonSimState): boolean {
  if (fixture.kind !== 'international' || fixture.internationalRound !== 'qualifier') return false;
  if (sim.internationalSelected) return false;
  if (!sim.nationId || !sim.internationalTournament) return false;
  if (sim.internationalStage === 'failed-qualifying' || sim.internationalStage === 'champion' || sim.internationalStage === 'eliminated') {
    return false;
  }
  return (
    sim.internationalStage === 'qualifying'
    || sim.internationalPhase === 'qualifiers'
    || sim.internationalPhase === 'qualifiers-and-tournament'
  );
}

function nextCupStage(stage: DomesticCupStage): DomesticCupProgress {
  const i = CUP_STAGE_ORDER.indexOf(stage);
  if (i < 0 || i >= CUP_STAGE_ORDER.length - 1) return 'champion';
  return CUP_STAGE_ORDER[i + 1];
}

const LEAGUES_CUP_GROUP_GAMES = 2;
const LEAGUES_CUP_ADVANCE_POINTS = 3;

export function applyLeaguesCupResult(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  result: { outcome: 'win' | 'draw' | 'loss' },
): SeasonSimState {
  if (fixture.kind !== 'leagues-cup' || !fixture.leaguesCupStage) return sim;
  if (fixture.leaguesCupStage === 'group') {
    const next = { ...sim };
    next.leaguesCupGroupPlayed += 1;
    if (result.outcome === 'win') next.leaguesCupGroupPoints += 3;
    else if (result.outcome === 'draw') next.leaguesCupGroupPoints += 1;
    if (next.leaguesCupGroupPlayed >= LEAGUES_CUP_GROUP_GAMES) {
      next.leaguesCupStage = next.leaguesCupGroupPoints >= LEAGUES_CUP_ADVANCE_POINTS ? 'quarter-final' : 'eliminated';
    }
    return next;
  }
  if (result.outcome !== 'win') return { ...sim, leaguesCupStage: 'eliminated' };
  if (fixture.leaguesCupStage === 'final') {
    return { ...sim, leaguesCupStage: 'champion' };
  }
  if (fixture.leaguesCupStage === 'quarter-final') return { ...sim, leaguesCupStage: 'semi-final' };
  return { ...sim, leaguesCupStage: 'final' };
}

export function applyPlayoffResult(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  result: { outcome: 'win' | 'draw' | 'loss' },
  _clubId: string,
): SeasonSimState {
  if (fixture.kind !== 'playoff' || !fixture.playoffRound) return sim;
  if (result.outcome !== 'win') return { ...sim, playoffStage: 'eliminated' };
  if (fixture.playoffRound === 'wild-card') return { ...sim, playoffStage: 'first-round' };
  if (fixture.playoffRound === 'first-round') return { ...sim, playoffStage: 'conference-semi' };
  if (fixture.playoffRound === 'conference-semi') return { ...sim, playoffStage: 'conference-final' };
  if (fixture.playoffRound === 'conference-final') return { ...sim, playoffStage: 'mls-cup' };
  return {
    ...sim,
    playoffStage: 'champion',
    honours: { ...sim.honours, leagueChampion: true },
  };
}

function maybeOpenPlayoffs(sim: SeasonSimState, clubId: string): SeasonSimState {
  if (sim.playoffStage !== 'pending' && sim.playoffStage !== 'first-round') return sim;
  const table = conferenceTable(sim.leagueTable, clubId);
  const us = table.find((r) => r.clubId === clubId);
  if (!us || us.played < MLS_REGULAR_SEASON_WEEKS) return sim;
  const opening = playoffOpeningForPosition(us.position);
  if (opening === 'not-qualified') return { ...sim, playoffStage: 'not-qualified' };
  return { ...sim, playoffStage: opening };
}

export function applyDomesticCupResult(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  result: { outcome: 'win' | 'draw' | 'loss' },
): SeasonSimState {
  if (fixture.kind !== 'domestic-cup' || !fixture.domesticCup || !fixture.domesticCupStage) return sim;
  const progressed = result.outcome === 'win';
  if (!progressed) {
    return { ...sim, domesticCupStage: 'eliminated' };
  }
  if (fixture.domesticCupStage === 'final') {
    return {
      ...sim,
      domesticCupStage: 'champion',
      honours: { ...sim.honours, domesticCup: fixture.domesticCup },
    };
  }
  return { ...sim, domesticCupStage: nextCupStage(fixture.domesticCupStage) };
}

/** After a continental match, advance/eliminate the European stage. */
function twoLeggedTieProgressed(
  aggFor: number,
  aggAgainst: number,
  result: { penalties?: { won: boolean } },
): boolean {
  if (aggFor > aggAgainst) return true;
  if (aggFor < aggAgainst) return false;
  return Boolean(result.penalties?.won);
}

export function applyEuropeanResult(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  result: { outcome: 'win' | 'draw' | 'loss'; scoreFor: number; scoreAgainst: number; penalties?: { won: boolean } },
  playerClubId?: string,
  rng: () => number = Math.random,
): SeasonSimState {
  if (!sim.europeanStanding || !fixture.continentalCup) return sim;
  const next = { ...sim, europeanStanding: { ...sim.europeanStanding }, europeanTable: (sim.europeanTable ?? []).map((row) => ({ ...row })) };

  if (fixture.kind === 'super-cup') {
    if (fixture.domesticSuperCup) {
      if (result.outcome === 'win') {
        next.domesticSuperCupStage = 'champion';
        next.honours = { ...next.honours, domesticSuperCup: fixture.domesticSuperCupName ?? 'Super Cup' };
      } else {
        next.domesticSuperCupStage = 'eliminated';
      }
      return next;
    }
    if (fixture.superCupStage === 'semi-final') {
      next.superCupStage = result.outcome === 'win' ? 'final' : 'eliminated';
      return next;
    }
    if (result.outcome === 'win') {
      next.superCupStage = 'champion';
      next.honours = { ...next.honours, superCup: true };
    } else {
      next.superCupStage = 'eliminated';
    }
    return next;
  }

  if (fixture.kind === 'continental-group') {
    next.europeanGroupPlayed += 1;
    if (result.outcome === 'win') next.europeanGroupPoints += 3;
    else if (result.outcome === 'draw') next.europeanGroupPoints += 1;
    if (playerClubId && fixture.opponentId) {
      let table = next.europeanTable.length ? next.europeanTable : emptyEuropeanTable(clubsForContinentalCup(fixture.continentalCup, playerClubId));
      if (!table.some((row) => row.clubId === playerClubId)) table = [...table, emptyStanding(playerClubId)];
      if (!table.some((row) => row.clubId === fixture.opponentId)) table = [...table, emptyStanding(fixture.opponentId)];
      table = applyMatchToTable(table, playerClubId, fixture.opponentId, {
        outcome: result.outcome,
        scoreFor: result.scoreFor,
        scoreAgainst: result.scoreAgainst,
      });
      table = simulateRestOfEuropeanRound(table, playerClubId, fixture.opponentId, rng, `eu${fixture.week}`);
      next.europeanTable = table;
    }
    if (next.europeanGroupPlayed >= GROUP_GAMES) {
      const table = next.europeanTable;
      const cup = next.europeanStanding.cup;
      if (cup === 'ucl' && playerClubId && table.length > 0) {
        const pos = tablePosition(table, playerClubId);
        const band = championsLeagueBand(pos);
        if (band === 'eliminated') {
          next.europeanStanding.stage = 'eliminated';
          next.europeanKnockoutField = [];
        } else if (band === 'play-off') {
          next.europeanStanding.stage = 'play-off';
          next.europeanKnockoutField = table.map((row) => row.clubId);
        } else {
          next.europeanStanding.stage = 'round-of-16';
          next.europeanKnockoutField = uclRoundOf16Field(table, playerClubId, false, `ucl-r16-${playerClubId}`);
        }
      } else if (playerClubId && table.length > 0) {
        const advancers = clubsThatWouldAdvanceFromLeague(table, GROUP_ADVANCE_POINTS, 16);
        if (advancers.includes(playerClubId)) {
          next.europeanStanding.stage = 'round-of-16';
          next.europeanKnockoutField = advancers;
        } else {
          next.europeanStanding.stage = 'eliminated';
          next.europeanKnockoutField = [];
        }
      } else if (next.europeanGroupPoints >= GROUP_ADVANCE_POINTS) {
        next.europeanStanding.stage = 'round-of-16';
      } else {
        next.europeanStanding.stage = 'eliminated';
      }
    }
    return next;
  }

  if (fixture.kind === 'continental-knockout') {
    next.knockoutAggFor += result.scoreFor;
    next.knockoutAggAgainst += result.scoreAgainst;
    if (fixture.leg === 2) {
      const progressed = twoLeggedTieProgressed(next.knockoutAggFor, next.knockoutAggAgainst, result);
      next.knockoutAggFor = 0;
      next.knockoutAggAgainst = 0;
      if (!progressed) {
        next.europeanStanding.stage = 'eliminated';
      } else if (next.europeanStanding.stage === 'play-off') {
        next.europeanStanding.stage = 'round-of-16';
        if (playerClubId && next.europeanTable.length > 0) {
          next.europeanKnockoutField = uclRoundOf16Field(
            next.europeanTable,
            playerClubId,
            true,
            `ucl-r16-${playerClubId}`,
          );
        }
      } else if (next.europeanStanding.stage === 'round-of-16') {
        next.europeanStanding.stage = 'quarter-final';
        if (playerClubId) {
          next.europeanKnockoutField = simulateKnockoutSurvivors(
            next.europeanKnockoutField ?? [],
            playerClubId,
            fixture.opponentId ?? null,
            `ucl-qf-${playerClubId}`,
          );
        }
      } else {
        next.europeanStanding.stage = 'semi-final';
        if (playerClubId) {
          next.europeanKnockoutField = simulateKnockoutSurvivors(
            next.europeanKnockoutField ?? [],
            playerClubId,
            fixture.opponentId ?? null,
            `ucl-sf-${playerClubId}`,
          );
        }
      }
    }
    return next;
  }

  if (fixture.kind === 'continental-semi-final') {
    next.knockoutAggFor += result.scoreFor;
    next.knockoutAggAgainst += result.scoreAgainst;
    if (fixture.leg === 2 || fixture.leg == null) {
      const progressed = twoLeggedTieProgressed(next.knockoutAggFor, next.knockoutAggAgainst, result);
      next.knockoutAggFor = 0;
      next.knockoutAggAgainst = 0;
      next.europeanStanding.stage = progressed ? 'final' : 'eliminated';
      if (progressed && playerClubId) {
        next.europeanKnockoutField = simulateKnockoutSurvivors(
          next.europeanKnockoutField ?? [],
          playerClubId,
          fixture.opponentId ?? null,
          `ucl-final-${playerClubId}`,
        );
      }
    }
    return next;
  }

  if (fixture.kind === 'continental-final') {
    if (result.outcome === 'win') {
      next.europeanStanding.stage = 'champion';
      next.honours = { ...next.honours, continentalChampion: fixture.continentalCup };
    } else {
      next.europeanStanding.stage = 'eliminated';
    }
    return next;
  }

  return next;
}

function firstKnockoutStage(tournament: InternationalTournamentId | null): InternationalStage {
  if (!tournament) return 'round-of-16';
  return tournamentKnockoutRounds(tournament)[0] ?? 'round-of-16';
}

function nextKnockoutStage(
  current: InternationalKnockoutRound,
  tournament: InternationalTournamentId | null,
): InternationalStage {
  if (!tournament) return 'eliminated';
  const rounds = tournamentKnockoutRounds(tournament);
  const i = rounds.indexOf(current);
  if (i < 0) return 'eliminated';
  if (i >= rounds.length - 1) return 'champion';
  return rounds[i + 1];
}

export function applyInternationalResult(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  scored: boolean,
  outcome: 'win' | 'draw' | 'loss',
  scoreFor = 0,
  scoreAgainst = 0,
): SeasonSimState {
  if (!sim.internationalSelected && fixture.internationalRound !== 'qualifier') return sim;
  const next = {
    ...sim,
    friendlyPlayed: sim.friendlyPlayed ?? 0,
    knockoutGamesScored: sim.knockoutGamesScored ?? 0,
    internationalGroup: sim.internationalGroup ?? null,
  };
  if (fixture.internationalRound === 'friendly') {
    next.friendlyPlayed += 1;
    if (next.friendlyPlayed >= 2) next.internationalStage = 'group';
    return next;
  }
  if (fixture.internationalRound === 'qualifier') {
    next.qualifierPlayed += 1;
    if (outcome === 'win') next.qualifierPoints += 3;
    else if (outcome === 'draw') next.qualifierPoints += 1;
    if (next.internationalGroup?.kind === 'qualifying' && next.nationId && fixture.opponentId) {
      next.internationalGroup = simulateNpcRoundAfterPlayerMatch(
        applyPlayerGroupResult(
          next.internationalGroup,
          next.nationId,
          fixture.opponentId,
          scoreFor,
          scoreAgainst,
          fixture.isHome !== false,
        ),
        next.nationId,
        fixture.opponentId,
        `${next.nationId}-${next.internationalTournament}-q${next.qualifierPlayed}-${fixture.opponentId}`,
      );
    }
    const totalPlayed = next.qualifierPlayed + next.qualifierCarryPlayed;
    if (next.internationalPhase === 'qualifiers') {
      return next;
    }
    const needed = next.internationalGroup?.kind === 'qualifying' && next.internationalGroup.teamIds.length >= 10
      ? 18
      : 10;
    if (totalPlayed >= needed && next.nationId && next.internationalTournament) {
      const qualified = next.internationalGroup?.kind === 'qualifying'
        ? doesNationQualifyFromTable(
            next.internationalGroup,
            next.nationId,
            10,
            next.internationalTournament,
          )
        : doesNationQualify(
            next.nationId,
            next.internationalTournament,
            next.qualifierPoints + next.qualifierCarryPoints,
            totalPlayed,
          );
      next.nationQualified = qualified;
      next.internationalStage = qualified
        ? (sim.internationalSelected ? 'friendly' : 'qualified')
        : 'failed-qualifying';
      if (qualified && next.internationalGroup?.kind === 'qualifying') {
        next.internationalGroup = null;
      }
    }
    return next;
  }
  if (fixture.internationalRound === 'group') {
    next.groupPlayed += 1;
    if (outcome === 'win') next.groupPoints += 3;
    else if (outcome === 'draw') next.groupPoints += 1;
    if (next.internationalGroup && next.nationId && fixture.opponentId) {
      next.internationalGroup = simulateNpcRoundAfterPlayerMatch(
        applyPlayerGroupResult(
          next.internationalGroup,
          next.nationId,
          fixture.opponentId,
          scoreFor,
          scoreAgainst,
          true,
        ),
        next.nationId,
        fixture.opponentId,
        `${next.nationId}-${next.internationalTournament}-g${next.groupPlayed}-${fixture.opponentId}`,
      );
    }
    if (next.groupPlayed >= tournamentGroupGames(next.internationalTournament)) {
      next.internationalReached = 'group';
      const pos = next.internationalGroup && next.nationId
        ? groupPosition(next.internationalGroup, next.nationId)
        : 0;
      const tableAdvance = pos > 0 ? pos <= 2 : next.groupPoints >= tournamentGroupAdvancePoints(next.internationalTournament);
      const nlOk = next.internationalTournament !== 'nations-league'
        || (next.nationId != null && nationsLeagueCanReachKnockout(next.nationId));
      next.internationalStage = tableAdvance && nlOk
        ? firstKnockoutStage(next.internationalTournament)
        : 'eliminated';
    }
    return next;
  }
  const knockout = fixture.internationalRound;
  if (
    knockout === 'round-of-32' ||
    knockout === 'round-of-16' ||
    knockout === 'quarter-final' ||
    knockout === 'semi-final' ||
    knockout === 'final'
  ) {
    if (scored) next.knockoutGamesScored += 1;
    let progressed = outcome === 'win';
    if (progressed && next.nationId && !nationCanProgressKnockout(next.nationId, scored, knockout)) {
      progressed = false;
    }
    if (
      progressed
      && knockout === 'final'
      && next.nationId
      && !nationCanWinMajor(next.nationId, next.knockoutGamesScored)
    ) {
      progressed = false;
    }
    next.internationalReached = knockout;
    if (!progressed) {
      next.internationalStage = 'eliminated';
      return next;
    }
    const following = nextKnockoutStage(knockout, next.internationalTournament);
    if (following === 'champion') {
      next.internationalStage = 'champion';
      next.honours = { ...next.honours, internationalChampion: sim.internationalTournament };
    } else {
      next.internationalStage = following;
    }
    return next;
  }
  return next;
}

/**
 * Existing careers still hold the old 8-club Champions League group.
 * Expand the table to the 36-club Swiss field and redraw unplayed
 * league-phase ties from that field. Eight matches stay — that is the
 * Swiss format — but the opponents come from all 36 clubs.
 */
export function repairChampionsLeagueSeason(params: {
  clubId?: string | null;
  calendar?: SeasonCalendar | null;
  sim?: SeasonSimState | null;
}): { calendar?: SeasonCalendar | null; sim?: SeasonSimState | null } {
  const { clubId, calendar, sim } = params;
  if (!sim?.europeanStanding || sim.europeanStanding.cup !== 'ucl') {
    return { calendar, sim };
  }
  const wasShort = championsLeagueTableNeedsRepair(sim.europeanTable, 'ucl');
  let table = expandChampionsLeagueTable(sim.europeanTable, clubId);
  if (clubId) {
    table = fillMissingEuropeanRounds(table, clubId, sim.europeanGroupPlayed ?? 0);
  }
  const nextSim: SeasonSimState = { ...sim, europeanTable: table };

  if (!wasShort || !calendar || !clubId) {
    return { calendar, sim: nextSim };
  }
  const club = getClub(clubId);
  if (!club) return { calendar, sim: nextSim };

  const fixtures = calendar.fixtures.map((f) => ({ ...f }));
  const slots = fixtures
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.kind === 'continental-group');
  const playedIds = new Set(
    slots
      .filter(({ i }) => i < sim.fixtureIndex)
      .map(({ f }) => f.opponentId)
      .filter((id): id is string => Boolean(id)),
  );
  const remaining = slots.filter(({ i }) => i >= sim.fixtureIndex);
  if (remaining.length === 0) {
    return { calendar: { ...calendar, fixtures }, sim: nextSim };
  }
  const drawn = leaguePhaseOpponents(club, 'ucl', 8);
  const unused = drawn.filter((c) => !playedIds.has(c.id));
  const extra = leaguePhaseOpponents(club, 'ucl', 8).filter(
    (c) => !playedIds.has(c.id) && !unused.some((u) => u.id === c.id),
  );
  const pool = [...unused, ...extra];
  remaining.forEach(({ f }, n) => {
    const opp = pool[n];
    if (!opp) return;
    f.opponentId = opp.id;
    f.opponentLabel = opp.name;
  });
  return { calendar: { ...calendar, fixtures }, sim: nextSim };
}

export const GROUP_STAGE_MATCHDAYS = GROUP_GAMES;
export const GROUP_POINTS_TO_ADVANCE = GROUP_ADVANCE_POINTS;
export const CHAMPIONS_LEAGUE_LEAGUE_PHASE_MATCHES = GROUP_GAMES;
export const CHAMPIONS_LEAGUE_TABLE_SIZE = CHAMPIONS_LEAGUE_FIELD_SIZE;

export function internationalRoundLabel(
  round: CalendarFixture['internationalRound'],
): string {
  if (round === 'qualifier') return 'Qualifier';
  if (round === 'friendly') return 'Friendly';
  if (round === 'group') return 'Group';
  if (round === 'round-of-32') return 'Last 32';
  if (round === 'round-of-16') return 'Last 16';
  if (round === 'quarter-final') return 'Quarter-final';
  if (round === 'semi-final') return 'Semi-final';
  if (round === 'third-place') return 'Third-place play-off';
  if (round === 'final') return 'Final';
  return 'International';
}

function cupRoundLabel(stage: DomesticCupStage | undefined): string {
  if (stage === 'round-of-16') return 'Round of 16';
  if (stage === 'quarter-final') return 'Quarter-final';
  if (stage === 'semi-final') return 'Semi-final';
  if (stage === 'final') return 'Final';
  return 'Cup';
}

export function fixtureTitle(
  fixture: CalendarFixture,
  opts?: { playerNationName?: string; tournament?: InternationalTournamentId | null; tournamentName?: string },
): string {
  const vs = fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : '';
  if (fixture.kind === 'rest') return 'International break';
  if (fixture.kind === 'league') return `League${vs}`;
  if (fixture.kind === 'leagues-cup') {
    const stage = fixture.leaguesCupStage === 'group' ? 'Group' : cupRoundLabel(fixture.leaguesCupStage === 'quarter-final' ? 'quarter-final' : fixture.leaguesCupStage === 'semi-final' ? 'semi-final' : 'final');
    return `Leagues Cup ${stage}${vs}`;
  }
  if (fixture.kind === 'playoff') {
    if (fixture.playoffRound === 'wild-card') return `Playoff wild card${vs}`;
    if (fixture.playoffRound === 'first-round') return `Playoff first round${vs}`;
    if (fixture.playoffRound === 'conference-semi') return `Conference semi-final${vs}`;
    if (fixture.playoffRound === 'conference-final') return `Conference final${vs}`;
    if (fixture.playoffRound === 'mls-cup') return `MLS Cup${vs}`;
    return `Playoffs${vs}`;
  }
  if (fixture.kind === 'domestic-cup') {
    const cupName = fixture.domesticCup ? DOMESTIC_CUPS[fixture.domesticCup].name : 'Cup';
    return `${cupName} ${cupRoundLabel(fixture.domesticCupStage)}${vs}`;
  }
  if (fixture.kind === 'super-cup') {
    const name = fixture.domesticSuperCupName
      ?? (fixture.domesticSuperCup ? 'Club Super Cup' : 'European Super Cup');
    if (fixture.superCupStage === 'semi-final') return `${name} semi-final${vs}`;
    return `${name}${vs}`;
  }
  if (fixture.kind === 'continental-group') {
    const cup = fixture.continentalCup ? CONTINENTAL_CUPS[fixture.continentalCup].name : 'Europe';
    return `${cup} league phase${vs}`;
  }
  if (fixture.kind === 'continental-knockout') {
    const cup = fixture.continentalCup ? CONTINENTAL_CUPS[fixture.continentalCup].name : 'Europe';
    const round = fixture.europeanRound === 'play-off'
      ? 'play-off'
      : fixture.europeanRound === 'quarter-final'
        ? 'quarter-final'
        : 'round of 16';
    const leg = fixture.leg === 2 ? ' 2nd leg' : ' 1st leg';
    return `${cup} ${round}${leg}${vs}`;
  }
  if (fixture.kind === 'continental-semi-final') {
    const cup = fixture.continentalCup ? CONTINENTAL_CUPS[fixture.continentalCup].name : 'Europe';
    const leg = fixture.leg === 2 ? ' 2nd leg' : fixture.leg === 1 ? ' 1st leg' : '';
    return `${cup} semi-final${leg}${vs}`;
  }
  if (fixture.kind === 'continental-final') {
    const cup = fixture.continentalCup ? CONTINENTAL_CUPS[fixture.continentalCup].name : 'Europe';
    return `${cup} final${vs}`;
  }
  if (fixture.kind === 'international') {
    const tournamentName =
      opts?.tournamentName
      ?? (opts?.tournament ? INTERNATIONAL_TOURNAMENTS[opts.tournament].name : undefined);
    const round = internationalRoundLabel(fixture.internationalRound);
    const namedRound = tournamentName
      ? fixture.internationalRound === 'qualifier'
        ? `${tournamentName} qualifying`
        : `${tournamentName} ${round}`
      : round;
    if (opts?.playerNationName && fixture.opponentLabel) {
      return `${namedRound}: ${opts.playerNationName} vs ${fixture.opponentLabel}`;
    }
    return `${namedRound}${vs}`;
  }
  return vs.trim();
}

export function trophyNameForFixture(
  fixture: CalendarFixture,
  tournament: InternationalTournamentId | null,
): string | null {
  if (fixture.kind === 'continental-final' && fixture.continentalCup) {
    return CONTINENTAL_CUPS[fixture.continentalCup].name;
  }
  if (fixture.kind === 'super-cup' && (fixture.superCupStage === 'final' || !fixture.superCupStage)) {
    return fixture.domesticSuperCupName ?? 'Super Cup';
  }
  if (fixture.kind === 'leagues-cup' && fixture.leaguesCupStage === 'final') return 'Leagues Cup';
  if (fixture.kind === 'playoff' && fixture.playoffRound === 'mls-cup') return 'MLS Cup';
  if (fixture.kind === 'domestic-cup' && fixture.domesticCupStage === 'final' && fixture.domesticCup) {
    return DOMESTIC_CUPS[fixture.domesticCup].name;
  }
  if (fixture.kind === 'international' && fixture.internationalRound === 'final' && tournament) {
    return INTERNATIONAL_TOURNAMENTS[tournament].name;
  }
  return null;
}

export function isTwoLeggedDecider(fixture: CalendarFixture): boolean {
  return (fixture.kind === 'continental-knockout' || fixture.kind === 'continental-semi-final') && fixture.leg === 2;
}

export function isOneOffKnockout(fixture: CalendarFixture): boolean {
  if (fixture.kind === 'domestic-cup') return true;
  if (fixture.kind === 'playoff') return true;
  if (fixture.kind === 'continental-final') return true;
  if (fixture.kind === 'super-cup') return true;
  if (fixture.kind === 'leagues-cup' && fixture.leaguesCupStage && fixture.leaguesCupStage !== 'group') return true;
  if (fixture.kind === 'international') {
    const round = fixture.internationalRound;
    return (
      round === 'round-of-32' ||
      round === 'round-of-16' ||
      round === 'quarter-final' ||
      round === 'semi-final' ||
      round === 'third-place' ||
      round === 'final'
    );
  }
  return false;
}

function continentalThroughNote(fixture: CalendarFixture, through: boolean): string {
  if (!through) return 'out on aggregate';
  if (fixture.kind === 'continental-semi-final') return 'through to the final';
  if (fixture.europeanRound === 'quarter-final') return 'through to the semi-final';
  if (fixture.europeanRound === 'play-off') return 'through to the round of 16';
  return 'through to the quarter-final';
}

/** Running score of a two-legged club tie, including this match, with progress on the decider. */
export function continentalAggregateLine(
  fixture: CalendarFixture,
  sim: SeasonSimState,
  result: { scoreFor: number; scoreAgainst: number; penalties?: { won: boolean } },
): string | null {
  if (fixture.kind !== 'continental-knockout' && fixture.kind !== 'continental-semi-final') return null;
  const aggFor = sim.knockoutAggFor + result.scoreFor;
  const aggAgainst = sim.knockoutAggAgainst + result.scoreAgainst;
  const score = `Aggregate ${aggFor}\u2013${aggAgainst}`;
  const deciding = fixture.leg === 2 || (fixture.kind === 'continental-semi-final' && fixture.leg == null);
  if (deciding) {
    return `${score} \u00b7 ${continentalThroughNote(fixture, twoLeggedTieProgressed(aggFor, aggAgainst, result))}`;
  }
  return `${score} \u00b7 second leg to come`;
}

function knockoutProgressNote(
  fixture: CalendarFixture,
  won: boolean,
  tournament: InternationalTournamentId | null,
): string | null {
  if (fixture.kind === 'international' && fixture.internationalRound === 'final') {
    return won ? 'won the tournament' : 'finished as runners-up';
  }
  if (fixture.kind === 'international' && fixture.internationalRound === 'third-place') {
    return won ? 'won the third-place match' : 'finished fourth';
  }
  if (fixture.kind === 'international') {
    const round = fixture.internationalRound;
    if (
      round === 'round-of-32' ||
      round === 'round-of-16' ||
      round === 'quarter-final' ||
      round === 'semi-final'
    ) {
      if (!won) return 'out of the tournament';
      const next = nextKnockoutStage(round, tournament);
      if (next === 'champion') return 'through to the final';
      return `through to the ${internationalRoundLabel(next as CalendarFixture['internationalRound']).toLowerCase()}`;
    }
  }
  if (fixture.kind === 'domestic-cup' && fixture.domesticCupStage && fixture.domesticCupStage !== 'final') {
    const following = nextCupStage(fixture.domesticCupStage);
    const label = following === 'quarter-final' || following === 'semi-final' || following === 'final'
      ? cupRoundLabel(following)
      : 'next round';
    return won ? `through to the ${label.toLowerCase()}` : 'out of the cup';
  }
  if (fixture.kind === 'domestic-cup' && fixture.domesticCupStage === 'final') {
    return won ? null : 'lost the final';
  }
  return won ? null : fixture.kind === 'playoff' || fixture.kind === 'leagues-cup' || fixture.kind === 'super-cup'
    ? 'out'
    : null;
}

export function resolveFixture(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  playerClub: Club,
  playerGoals: number,
  rng: () => number = Math.random,
  opts?: {
    settlePenalties?: boolean;
    penaltyScored?: boolean;
    ninetyScore?: { for: number; against: number };
    /** Sit-outs must not count as missed chances. */
    playerParticipated?: boolean;
  },
): {
  sim: SeasonSimState;
  result: ClubMatchResult;
  summary: string;
  aggregateLine: string | null;
  needsPenalty?: boolean;
} {
  const isHome = fixtureIsHome(fixture);
  const scored = playerGoals > 0;
  const isInternational = fixture.kind === 'international';
  const clubOpp = !isInternational && fixture.opponentId ? getClub(fixture.opponentId) : undefined;
  const us = isInternational
    ? (sim.nationId ? nationStrength(sim.nationId) : 70)
    : playerClub.strength;
  const them = isInternational
    ? (fixture.opponentId ? nationStrength(fixture.opponentId) : 70)
    : (clubOpp?.strength ?? 70);
  const teamWinP = expectedScore(us + (isHome ? 3.5 : 0), them) * 0.92;

  let result: ClubMatchResult;
  const chances = opts?.playerParticipated === false ? undefined : fixture.playerChances;
  if (opts?.ninetyScore) {
    result = {
      scoreFor: opts.ninetyScore.for,
      scoreAgainst: opts.ninetyScore.against,
      outcome: 'draw',
    };
  } else if (isInternational) {
    result = simulateClubMatch(
      { clubStrength: us, opponentStrength: them, isHome, knockout: isOneOffKnockout(fixture) },
      rng,
      playerGoals,
      chances,
    );
  } else {
    result = simulateClubMatch(
      {
        clubTier: playerClub.tier,
        opponentTier: clubOpp?.tier ?? 3,
        clubStrength: playerClub.strength,
        opponentStrength: clubOpp?.strength,
        isHome,
      },
      rng,
      playerGoals,
      chances,
    );
  }

  const isTitleRival = fixture.kind === 'league' && fixture.opponentId === sim.titleRivalId;
  if (isTitleRival && playerGoals > 0 && result.outcome === 'loss') {
    result = { scoreFor: result.scoreAgainst, scoreAgainst: result.scoreAgainst, outcome: 'draw' };
  }

  if (!opts?.ninetyScore) {
    result = applyPlayerGoalsFloor(result, playerGoals);
  }
  const settlePens = opts?.settlePenalties !== false;
  const penaltyScored = opts?.penaltyScored ?? scored;
  const goToPens = (draw: ClubMatchResult) => {
    if (!settlePens) return { result: draw, needsPenalty: true as const };
    return { result: settleDrawOnPenalties(draw, penaltyScored, rng, teamWinP), needsPenalty: false as const };
  };
  let needsPenalty = false;
  if (isOneOffKnockout(fixture) && result.outcome === 'draw') {
    const settled = goToPens(result);
    result = settled.result;
    needsPenalty = settled.needsPenalty;
  } else if (isTwoLeggedDecider(fixture)) {
    const aggFor = sim.knockoutAggFor + result.scoreFor;
    const aggAgainst = sim.knockoutAggAgainst + result.scoreAgainst;
    if (aggFor === aggAgainst) {
      const settled = goToPens({ ...result, outcome: 'draw' });
      result = settled.result;
      needsPenalty = settled.needsPenalty;
    }
  }
  if (needsPenalty) {
    const playerNationName = sim.nationId ? getNation(sim.nationId)?.name : undefined;
    const score = `${result.scoreFor}\u2013${result.scoreAgainst}`;
    const summary = isInternational && playerNationName && fixture.opponentLabel
      ? `${playerNationName} drew ${score} vs ${fixture.opponentLabel}`
      : `Drew ${score}${fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : ''}`;
    return { sim, result, summary, aggregateLine: continentalAggregateLine(fixture, sim, result), needsPenalty: true };
  }

  let next = { ...sim };
  if (fixture.kind === 'league' && fixture.opponentId) {
    let table = applyMatchToTable(next.leagueTable, playerClub.id, fixture.opponentId, result);
    table = simulateRestOfLeagueRound(table, playerClub.id, fixture.opponentId, rng, `w${fixture.week}`);
    next.leagueTable = table;
    if (isTitleRival) {
      if (isHome) next.rivalHomeOutcome = result.outcome;
      else next.rivalAwayOutcome = result.outcome;
    }
    next = maybeOpenPlayoffs(next, playerClub.id);
  } else if (fixture.kind === 'domestic-cup') {
    next = applyDomesticCupResult(next, fixture, result);
  } else if (fixture.kind === 'leagues-cup') {
    next = applyLeaguesCupResult(next, fixture, result);
  } else if (fixture.kind === 'playoff') {
    next = applyPlayoffResult(next, fixture, result, playerClub.id);
  } else if (fixture.kind.startsWith('continental') || fixture.kind === 'super-cup') {
    next = applyEuropeanResult(next, fixture, result, playerClub.id, rng);
  } else if (isInternational) {
    next = applyInternationalResult(next, fixture, scored, result.outcome, result.scoreFor, result.scoreAgainst);
  }

  const playerNationName = sim.nationId ? getNation(sim.nationId)?.name : undefined;
  const pens = describeDrawSettledOnPenalties(result, result.scoreFor, result.scoreAgainst);
  const verb = result.penalties ? null : result.outcome === 'win' ? 'Won' : result.outcome === 'draw' ? 'Drew' : 'Lost';
  const score = `${result.scoreFor}\u2013${result.scoreAgainst}`;
  let summary = pens
    ? isInternational && playerNationName && fixture.opponentLabel
      ? `${playerNationName} ${pens} vs ${fixture.opponentLabel}`
      : `You ${pens}${fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : ''}`
    : isInternational && playerNationName && fixture.opponentLabel
      ? `${playerNationName} ${verb!.toLowerCase()} ${score} vs ${fixture.opponentLabel}`
      : `${verb} ${score}${fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : ''}`;
  const progress = knockoutProgressNote(fixture, result.outcome === 'win', sim.internationalTournament);
  if (progress) summary = `${summary} · ${progress}`;
  const aggregateLine = continentalAggregateLine(fixture, sim, result);
  return { sim: next, result, summary, aggregateLine };
}
