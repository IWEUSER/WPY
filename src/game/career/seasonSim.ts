import type { CalendarFixture, DomesticCupStage, LeaguesCupStage, PlayoffRound, SeasonCalendar, SuperCupStage } from './calendar';
import { buildSeasonCalendar, fixtureIsHome } from './calendar';
import { leaguePhaseOpponents } from './continentalDraw';
import {
  chancesForKnockoutTie,
  chancesForLeagueMatch,
} from './chanceEngine';
import {
  clubsForSeason,
  clubsInCountry,
  getClub,
  ligaMxClubs,
  leagueMatchWeeks,
  qualifiesForSaudiSuperCup,
  type Club,
} from './data/clubs';
import { mlsConferenceOf } from './data/leagueFormat';
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
  qualifierOpponents,
  tournamentGroupAdvancePoints,
  tournamentGroupGames,
  tournamentKnockoutRounds,
  tournamentOpponents,
  type InternationalKnockoutRound,
} from './data/fifaRankings';
import { clubEligibleForNationalTeam, getNation, isSelectedForNationalTeam } from './international';
import {
  applyMatchToTable,
  clubsForContinentalCup,
  emptyStanding,
  simulateClubMatch,
  simulateRestOfLeagueRound,
  applyPlayerGoalsFloor,
  type ClubMatchResult,
  type EuropeanStanding,
  type LeagueStanding,
} from './matchEngine';
import { shuffle } from './util';

export type InternationalStage =
  | 'not-selected'
  | 'qualifying'
  | 'qualified'
  | 'failed-qualifying'
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
  internationalChampion: InternationalTournamentId | null;
  domesticCup: DomesticCupId | null;
}

export interface SeasonSimState {
  fixtureIndex: number;
  leagueTable: LeagueStanding[];
  europeanStanding: EuropeanStanding | null;
  europeanGroupPoints: number;
  europeanGroupPlayed: number;
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
  playoffStage: PlayoffRound | 'eliminated' | 'champion' | 'not-qualified' | null;
  leaguesCupStage: LeaguesCupStage | 'eliminated' | 'champion' | 'not-entered';
  leaguesCupGroupPlayed: number;
  leaguesCupGroupPoints: number;
  superCupStage: SuperCupStage | 'eliminated' | 'champion' | 'not-entered';
  /** Furthest international round played this season (set when going out or winning). */
  internationalReached: InternationalStage | null;
}

export interface LiveMatch {
  fixtureIndex: number;
  chancesTotal: number;
  chancesTaken: number;
  goals: number;
}

export interface HydrateSeasonParams {
  seasonNumber: number;
  club: Club;
  /** First-team career ratio. Trial and the reserve year are excluded. */
  careerGoalRatio: number;
  nationId: string | null;
  qualifierCarry?: { tournament: InternationalTournamentId; points: number; played: number } | null;
  includeSuperCup?: boolean;
  superCupOpponentId?: string;
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
}

const GROUP_GAMES = 8;
const GROUP_ADVANCE_POINTS = 10;

const CUP_STAGE_ORDER: DomesticCupStage[] = ['round-of-16', 'quarter-final', 'semi-final', 'final'];

export function emptyHonours(): SeasonHonours {
  return {
    leagueChampion: false,
    continentalChampion: null,
    superCup: false,
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
  const intlSeason = internationalCalendarSeason(seasonNumber, {
    leagueOnly,
    careerStart: params.careerStart,
  });
  const campaign = internationalCampaignForSeason(intlSeason, nation?.confederation ?? clubConfederation);
  const tournament = campaign.tournament ?? null;
  const clubOk = clubEligibleForNationalTeam(club.tier);
  const campaignActive = Boolean(
    !leagueOnly &&
      intlSeason >= 1 &&
      nationId &&
      campaign.tournament &&
      campaignSchedulesInternational(campaign.phase) &&
      clubOk,
  );
  const internationalSelected = Boolean(
    campaignActive &&
      isSelectedForNationalTeam({
        clubTier: club.tier,
        careerGoalRatio,
        nationId,
      }),
  );
  const startsAtTournament =
    campaign.phase === 'nations-league' || campaign.phase === 'tournament-only';
  const carryMatches = Boolean(
    qualifierCarry && tournament && qualifierCarry.tournament === tournament,
  );

  let calendar = buildSeasonCalendar({
    seasonNumber,
    leagueMatchWeeks: leagueMatchWeeks(league, club),
    clubTier: club.tier,
    confederation: clubConfederation,
    country: club.country,
    nationConfederation: nation?.confederation ?? null,
    includeInternational: campaignActive,
    includeDomesticCup: !leagueOnly,
    includeSuperCup: Boolean(!leagueOnly && includeSuperCup && cup && clubConfederation === 'UEFA'),
    includePlayoffs: !leagueOnly && isMls,
    includeLeaguesCup: !leagueOnly && isMls,
    includeSaudiSuperCup: saudiSuper,
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
    league,
    params.excludeQualifierIds,
    params.rng,
  );

  const leagueClubs = clubsForSeason(club, league);
  const leagueTable = leagueClubs.map((c) => emptyStanding(c.id));
  const europeanStanding: EuropeanStanding | null = cup ? { cup, stage: 'group' } : null;
  const domesticCup = calendar.domesticCup ?? null;
  const titleRival = pickTitleRival(club, league);

  return {
    calendar,
    sim: {
      fixtureIndex: 0,
      leagueTable,
      europeanStanding,
      europeanGroupPoints: 0,
      europeanGroupPlayed: 0,
      knockoutAggFor: 0,
      knockoutAggAgainst: 0,
      internationalStage: internationalSelected
        ? (startsAtTournament ? 'group' : 'qualifying')
        : 'not-selected',
      internationalSelected,
      internationalTournament: campaignActive ? tournament : null,
      internationalPhase: campaignActive ? campaign.phase : 'none',
      nationId: nationId ?? null,
      qualifierPoints: 0,
      qualifierPlayed: 0,
      qualifierTarget: campaignActive ? campaign.qualifierGames : 0,
      qualifierCarryPoints: carryMatches && qualifierCarry ? qualifierCarry.points : 0,
      qualifierCarryPlayed: carryMatches && qualifierCarry ? qualifierCarry.played : 0,
      groupPoints: 0,
      groupPlayed: 0,
      nationQualified: Boolean(internationalSelected && startsAtTournament),
      domesticCup,
      domesticCupStage: domesticCup ? 'round-of-16' : 'not-entered',
      honours: emptyHonours(),
      titleRivalId: titleRival?.id ?? null,
      rivalHomeOutcome: null,
      rivalAwayOutcome: null,
      playoffStage: !leagueOnly && isMls ? 'first-round' : null,
      leaguesCupStage: !leagueOnly && isMls ? 'group' : 'not-entered',
      leaguesCupGroupPlayed: 0,
      leaguesCupGroupPoints: 0,
      superCupStage: saudiSuper ? 'semi-final' : 'not-entered',
      internationalReached: null,
    },
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

function assignOpponentsAndChances(
  calendar: SeasonCalendar,
  club: Club,
  cup: ContinentalCupId | null,
  nationId: string | null,
  tournament: InternationalTournamentId | null,
  qualifierGames: number,
  superCupOpponentId?: string,
  league?: string,
  excludeQualifierIds?: string[],
  rng: () => number = Math.random,
): SeasonCalendar {
  const leagueRivals = leagueOpponentQueue(club, league);
  const leaguePhase = cup ? leaguePhaseOpponents(club, cup, 8) : [];
  const euroRivals = cup
    ? shuffle(clubsForContinentalCup(cup).filter((id) => id !== club.id))
    : [];
  const cupRivals = shuffle(clubsInCountry(club.country).filter((c) => c.id !== club.id));
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
  const qualifierRivals =
    nationId && tournament
      ? qualifierOpponents(nationId, tournament, qualifierGames, {
          extraExcludeIds: excludeQualifierIds,
          rng,
        })
      : [];
  const tournamentRivals = nationId && tournament ? tournamentOpponents(nationId, tournament, rng) : [];

  let leagueI = 0;
  let groupI = 0;
  let euroI = 0;
  let cupI = 0;
  let leaguesI = 0;
  let playoffI = 0;
  let superI = 0;
  let qualifierI = 0;
  let tournamentI = 0;

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
      const opp = cupRivals[cupI % Math.max(1, cupRivals.length)];
      cupI += 1;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'super-cup') {
      const saudiOpp = saudiSuperRivals[superI % Math.max(1, saudiSuperRivals.length)];
      if (f.superCupStage) superI += 1;
      const opp = (superCupOpponentId ? getClub(superCupOpponentId) : undefined)
        ?? (saudiSuperRivals.length > 0 && f.superCupStage ? saudiOpp : undefined)
        ?? (euroRivals[0] ? getClub(euroRivals[0]) : undefined);
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
      const oppId = euroRivals[euroI % Math.max(1, euroRivals.length)];
      euroI += 1;
      const opp = oppId ? getClub(oppId) : undefined;
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
      const oppId = euroRivals[euroI % Math.max(1, euroRivals.length)];
      euroI += 1;
      const opp = oppId ? getClub(oppId) : undefined;
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
      const oppId = euroRivals[euroI % Math.max(1, euroRivals.length)];
      euroI += 1;
      const opp = oppId ? getClub(oppId) : undefined;
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForLeagueMatch({ strength: club.strength }).count;
    } else if (f.kind === 'international') {
      const pool = f.internationalRound === 'qualifier' ? qualifierRivals : tournamentRivals;
      const idx = f.internationalRound === 'qualifier' ? qualifierI : tournamentI;
      if (f.internationalRound === 'qualifier') qualifierI += 1;
      else tournamentI += 1;
      const opp = pool[idx % Math.max(1, pool.length)];
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      const nationStr = nationId ? nationStrength(nationId) : club.strength;
      f.playerChances = chancesForLeagueMatch({ strength: nationStr }).count;
      f.isHome = idx % 2 === 0;
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
    if (second.kind === first.kind && second.leg === 2 && !second.opponentId) {
      return second;
    }
  }
  return undefined;
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
    if (sim.superCupStage === 'not-entered' || sim.superCupStage === 'eliminated' || sim.superCupStage === 'champion') {
      return fixture.superCupStage !== undefined;
    }
    if (fixture.superCupStage) {
      return fixture.superCupStage !== sim.superCupStage;
    }
    return false;
  }

  if (fixture.kind === 'leagues-cup') {
    const stage = sim.leaguesCupStage;
    if (stage === 'not-entered' || stage === 'eliminated' || stage === 'champion') return true;
    return fixture.leaguesCupStage !== stage;
  }

  if (fixture.kind === 'playoff') {
    if (sim.playoffStage == null || sim.playoffStage === 'eliminated' || sim.playoffStage === 'champion' || sim.playoffStage === 'not-qualified') {
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
      return stage !== 'round-of-16' && stage !== 'quarter-final';
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
    if (stage === 'qualifying' || stage === 'qualified') {
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
  if (sim.playoffStage !== 'first-round') return sim;
  const table = conferenceTable(sim.leagueTable, clubId);
  const us = table.find((r) => r.clubId === clubId);
  if (!us || us.played < 26) return sim;
  if (us.position > 6) return { ...sim, playoffStage: 'not-qualified' };
  if (us.position <= 2) return { ...sim, playoffStage: 'conference-semi' };
  return sim;
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
export function applyEuropeanResult(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  result: { outcome: 'win' | 'draw' | 'loss'; scoreFor: number; scoreAgainst: number },
): SeasonSimState {
  if (!sim.europeanStanding || !fixture.continentalCup) return sim;
  const next = { ...sim, europeanStanding: { ...sim.europeanStanding } };

  if (fixture.kind === 'super-cup') {
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
    if (next.europeanGroupPlayed >= GROUP_GAMES) {
      if (next.europeanGroupPoints >= GROUP_ADVANCE_POINTS) {
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
      const progressed =
        next.knockoutAggFor > next.knockoutAggAgainst
        || (next.knockoutAggFor === next.knockoutAggAgainst && Math.random() < 0.5);
      next.knockoutAggFor = 0;
      next.knockoutAggAgainst = 0;
      if (!progressed) {
        next.europeanStanding.stage = 'eliminated';
      } else if (next.europeanStanding.stage === 'round-of-16') {
        next.europeanStanding.stage = 'quarter-final';
      } else {
        next.europeanStanding.stage = 'semi-final';
      }
    }
    return next;
  }

  if (fixture.kind === 'continental-semi-final') {
    next.knockoutAggFor += result.scoreFor;
    next.knockoutAggAgainst += result.scoreAgainst;
    if (fixture.leg === 2 || fixture.leg == null) {
      const progressed =
        next.knockoutAggFor > next.knockoutAggAgainst
        || (next.knockoutAggFor === next.knockoutAggAgainst && Math.random() < 0.5);
      next.knockoutAggFor = 0;
      next.knockoutAggAgainst = 0;
      next.europeanStanding.stage = progressed ? 'final' : 'eliminated';
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
  _scored: boolean,
  outcome: 'win' | 'draw' | 'loss',
): SeasonSimState {
  if (!sim.internationalSelected) return sim;
  const next = { ...sim };
  if (fixture.internationalRound === 'qualifier') {
    next.qualifierPlayed += 1;
    if (outcome === 'win') next.qualifierPoints += 3;
    else if (outcome === 'draw') next.qualifierPoints += 1;
    if (next.qualifierPlayed >= next.qualifierTarget && next.nationId && next.internationalTournament) {
      // Season 3 is only the first half of qualifying — do not decide yet.
      if (next.internationalPhase === 'qualifiers') {
        return next;
      }
      const qualified = doesNationQualify(
        next.nationId,
        next.internationalTournament,
        next.qualifierPoints + next.qualifierCarryPoints,
        next.qualifierPlayed + next.qualifierCarryPlayed,
      );
      next.nationQualified = qualified;
      next.internationalStage = qualified ? 'group' : 'failed-qualifying';
    }
    return next;
  }
  if (fixture.internationalRound === 'group') {
    next.groupPlayed += 1;
    if (outcome === 'win') next.groupPoints += 3;
    else if (outcome === 'draw') next.groupPoints += 1;
    if (next.groupPlayed >= tournamentGroupGames(next.internationalTournament)) {
      const advanced = next.groupPoints >= tournamentGroupAdvancePoints(next.internationalTournament);
      next.internationalReached = 'group';
      next.internationalStage = advanced
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
    const progressed = outcome === 'win';
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

export const GROUP_STAGE_MATCHDAYS = GROUP_GAMES;
export const GROUP_POINTS_TO_ADVANCE = GROUP_ADVANCE_POINTS;

export function internationalRoundLabel(
  round: CalendarFixture['internationalRound'],
): string {
  if (round === 'qualifier') return 'Qualifier';
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
  opts?: { playerNationName?: string },
): string {
  const vs = fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : '';
  if (fixture.kind === 'rest') return 'International break';
  if (fixture.kind === 'league') return `League${vs}`;
  if (fixture.kind === 'leagues-cup') {
    const stage = fixture.leaguesCupStage === 'group' ? 'Group' : cupRoundLabel(fixture.leaguesCupStage === 'quarter-final' ? 'quarter-final' : fixture.leaguesCupStage === 'semi-final' ? 'semi-final' : 'final');
    return `Leagues Cup ${stage}${vs}`;
  }
  if (fixture.kind === 'playoff') {
    if (fixture.playoffRound === 'first-round') return `Playoffs${vs}`;
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
    if (fixture.superCupStage === 'semi-final') return `Super Cup semi-final${vs}`;
    return `Super Cup${vs}`;
  }
  if (fixture.kind === 'continental-group') return `League phase${vs}`;
  if (fixture.kind === 'continental-knockout') {
    const leg = fixture.leg === 2 ? ' 2nd leg' : ' 1st leg';
    return `Knockout${leg}${vs}`;
  }
  if (fixture.kind === 'continental-semi-final') {
    const leg = fixture.leg === 2 ? ' 2nd leg' : fixture.leg === 1 ? ' 1st leg' : '';
    return `Semi-final${leg}${vs}`;
  }
  if (fixture.kind === 'continental-final') return `Final${vs}`;
  if (fixture.kind === 'international') {
    const round = internationalRoundLabel(fixture.internationalRound);
    if (opts?.playerNationName && fixture.opponentLabel) {
      return `${round}: ${opts.playerNationName} vs ${fixture.opponentLabel}`;
    }
    return `${round}${vs}`;
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
  if (fixture.kind === 'super-cup' && (fixture.superCupStage === 'final' || !fixture.superCupStage)) return 'Super Cup';
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

function settleOnPens(
  result: ClubMatchResult,
  us: number,
  them: number,
  rng: () => number,
): ClubMatchResult {
  if (result.outcome !== 'draw') return result;
  const pWinPens = 1 / (1 + 10 ** ((them - us) / 18));
  const won = rng() < pWinPens;
  return won
    ? { scoreFor: result.scoreFor + 1, scoreAgainst: result.scoreAgainst, outcome: 'win' }
    : { scoreFor: result.scoreFor, scoreAgainst: result.scoreAgainst + 1, outcome: 'loss' };
}

function settleCupIfDrawn(
  result: ClubMatchResult,
  playerClub: Club,
  opponent: Club | undefined,
  rng: () => number,
): ClubMatchResult {
  return settleOnPens(result, playerClub.strength, opponent?.strength ?? 70, rng);
}

function settleNationIfDrawn(
  result: ClubMatchResult,
  us: number,
  them: number,
  rng: () => number,
): ClubMatchResult {
  return settleOnPens(result, us, them, rng);
}

export function resolveFixture(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  playerClub: Club,
  playerGoals: number,
  rng: () => number = Math.random,
): { sim: SeasonSimState; result: ClubMatchResult; summary: string } {
  const isHome = fixtureIsHome(fixture);
  const scored = playerGoals > 0;
  const isInternational = fixture.kind === 'international';
  const clubOpp = !isInternational && fixture.opponentId ? getClub(fixture.opponentId) : undefined;

  let result: ClubMatchResult;
  const chances = fixture.playerChances;
  if (isInternational) {
    const us = sim.nationId ? nationStrength(sim.nationId) : 70;
    const them = fixture.opponentId ? nationStrength(fixture.opponentId) : 70;
    result = simulateClubMatch({ clubStrength: us, opponentStrength: them, isHome }, rng, playerGoals, chances);
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

  if (
    fixture.kind === 'domestic-cup' ||
    fixture.kind === 'leagues-cup' ||
    fixture.kind === 'playoff' ||
    fixture.kind === 'continental-final' ||
    fixture.kind === 'super-cup'
  ) {
    result = settleCupIfDrawn(result, playerClub, clubOpp, rng);
  }
  if (
    isInternational &&
    fixture.internationalRound &&
    fixture.internationalRound !== 'qualifier' &&
    fixture.internationalRound !== 'group'
  ) {
    const us = sim.nationId ? nationStrength(sim.nationId) : 70;
    const them = fixture.opponentId ? nationStrength(fixture.opponentId) : 70;
    result = settleNationIfDrawn(result, us, them, rng);
  }

  result = applyPlayerGoalsFloor(result, playerGoals);

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
    next = applyEuropeanResult(next, fixture, result);
  } else if (isInternational) {
    next = applyInternationalResult(next, fixture, scored, result.outcome);
  }

  const playerNationName = sim.nationId ? getNation(sim.nationId)?.name : undefined;
  const verb = result.outcome === 'win' ? 'Won' : result.outcome === 'draw' ? 'Drew' : 'Lost';
  const score = `${result.scoreFor}\u2013${result.scoreAgainst}`;
  const summary = isInternational && playerNationName && fixture.opponentLabel
    ? `${playerNationName} ${verb.toLowerCase()} ${score} vs ${fixture.opponentLabel}`
    : `${verb} ${score}${fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : ''}`;
  return { sim: next, result, summary };
}
