import type { CalendarFixture, DomesticCupStage, SeasonCalendar } from './calendar';
import { buildSeasonCalendar } from './calendar';
import { leaguePhaseOpponents } from './continentalDraw';
import {
  chancesForDecisiveMatch,
  chancesForKnockoutTie,
  chancesForLeagueMatch,
} from './chanceEngine';
import { clubsForSeason, clubsInCountry, getClub, leagueMatchWeeks, type Club } from './data/clubs';
import {
  confederationForCountry,
  continentalCupForClub,
  CONTINENTAL_CUPS,
  DOMESTIC_CUPS,
  INTERNATIONAL_TOURNAMENTS,
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
  tournamentGroupGames,
  tournamentKnockoutRounds,
  tournamentOpponents,
  type InternationalKnockoutRound,
} from './data/fifaRankings';
import { clubEligibleForNationalTeam, getNation, isSelectedForNationalTeam } from './international';
import {
  applyMatchToTable,
  clubsForContinentalCup,
  decisiveScoreline,
  emptyStanding,
  simulateClubMatch,
  simulateRestOfLeagueRound,
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

const INTERNATIONAL_GROUP_ADVANCE_POINTS = 4;

export function hydrateSeason(params: HydrateSeasonParams): { calendar: SeasonCalendar; sim: SeasonSimState } {
  const { seasonNumber, club, careerGoalRatio, nationId, qualifierCarry, includeSuperCup, superCupOpponentId } = params;
  const league = params.league ?? club.league;
  const clubConfederation = confederationForCountry(club.country);
  const nation = nationId ? getNation(nationId) : undefined;
  const cup = continentalCupForClub(club.tier, clubConfederation);
  const campaign = internationalCampaignForSeason(seasonNumber, nation?.confederation ?? clubConfederation);
  const tournament = campaign.tournament ?? null;
  const clubOk = clubEligibleForNationalTeam(club.tier);
  const campaignActive = Boolean(nationId && campaign.tournament && campaign.phase !== 'none' && clubOk);
  const internationalSelected = Boolean(
    campaignActive &&
      isSelectedForNationalTeam({
        clubTier: club.tier,
        careerGoalRatio,
        nationId,
      }),
  );
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
    includeSuperCup: Boolean(includeSuperCup && cup),
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
      internationalStage: internationalSelected ? 'qualifying' : 'not-selected',
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
      nationQualified: false,
      domesticCup,
      domesticCupStage: domesticCup ? 'round-of-16' : 'not-entered',
      honours: emptyHonours(),
      titleRivalId: titleRival?.id ?? null,
      rivalHomeOutcome: null,
      rivalAwayOutcome: null,
    },
  };
}

/** The club the player must beat (or at least not lose to twice) to stay in the title race. */
export function pickTitleRival(club: Club, league?: string): Club | undefined {
  const others = clubsForSeason(club, league ?? club.league).filter((c) => c.id !== club.id);
  others.sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  return others[0];
}

export function lostTitleToRival(sim: SeasonSimState): boolean {
  return sim.rivalHomeOutcome === 'loss' && sim.rivalAwayOutcome === 'loss';
}

export function canWinLeague(sim: SeasonSimState, clubId: string): boolean {
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
): SeasonCalendar {
  const leagueRivals = leagueOpponentQueue(club, league);
  const leaguePhase = cup ? leaguePhaseOpponents(club, cup, 8) : [];
  const euroRivals = cup
    ? shuffle(clubsForContinentalCup(cup).filter((id) => id !== club.id))
    : [];
  const cupRivals = shuffle(clubsInCountry(club.country).filter((c) => c.id !== club.id));
  const qualifierRivals = nationId && tournament ? qualifierOpponents(nationId, tournament, qualifierGames) : [];
  const tournamentRivals = nationId && tournament ? tournamentOpponents(nationId, tournament) : [];

  let leagueI = 0;
  let groupI = 0;
  let euroI = 0;
  let cupI = 0;
  let qualifierI = 0;
  let tournamentI = 0;

  const fixtures = calendar.fixtures.map((f) => ({ ...f }));

  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    if (f.kind === 'league') {
      const opp = leagueRivals[leagueI];
      const uniqueRivals = Math.max(1, leagueRivals.length / 2);
      f.isHome = leagueI < uniqueRivals;
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
      const opp = (superCupOpponentId ? getClub(superCupOpponentId) : undefined)
        ?? (euroRivals[0] ? getClub(euroRivals[0]) : undefined);
      if (opp) {
        f.opponentId = opp.id;
        f.opponentLabel = opp.name;
      }
      f.playerChances = chancesForDecisiveMatch().count;
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
      const next = fixtures[i + 1];
      if (next && next.kind === 'continental-knockout' && next.leg === 2) {
        next.playerChances = leg2.count;
        if (opp) {
          next.opponentId = opp.id;
          next.opponentLabel = opp.name;
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
      const next = fixtures[i + 1];
      if (next && next.kind === 'continental-semi-final' && next.leg === 2) {
        next.playerChances = leg2.count;
        if (opp) {
          next.opponentId = opp.id;
          next.opponentLabel = opp.name;
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
      f.playerChances = chancesForDecisiveMatch().count;
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
      f.playerChances = f.isDecisive
        ? chancesForDecisiveMatch().count
        : chancesForLeagueMatch({ strength: nationStr }).count;
    }
  }

  return { ...calendar, fixtures };
}

/** Each league rival once, then once more — never a third meeting. */
export function leagueOpponentQueue(club: Club, league?: string): Club[] {
  const rivals = shuffle(clubsForSeason(club, league ?? club.league).filter((c) => c.id !== club.id));
  return [...rivals, ...shuffle(rivals)];
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
  if (fixture.kind === 'super-cup') return false;

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
    if (result.outcome === 'win') next.honours = { ...next.honours, superCup: true };
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
  scored: boolean,
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
    if (next.groupPlayed >= tournamentGroupGames()) {
      next.internationalStage =
        next.groupPoints >= INTERNATIONAL_GROUP_ADVANCE_POINTS
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
    const progressed = outcome === 'win' || (fixture.isDecisive && scored);
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
  if (fixture.kind === 'domestic-cup') {
    const cupName = fixture.domesticCup ? DOMESTIC_CUPS[fixture.domesticCup].name : 'Cup';
    return `${cupName} ${cupRoundLabel(fixture.domesticCupStage)}${vs}`;
  }
  if (fixture.kind === 'super-cup') return `Super Cup${vs}`;
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
  if (fixture.kind === 'super-cup') return 'Super Cup';
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
  const isHome = fixture.isHome ?? fixture.week % 2 === 1;
  const scored = playerGoals > 0;
  const isInternational = fixture.kind === 'international';
  const clubOpp = !isInternational && fixture.opponentId ? getClub(fixture.opponentId) : undefined;

  let result: ClubMatchResult;
  if (isInternational) {
    const us = sim.nationId ? nationStrength(sim.nationId) : 70;
    const them = fixture.opponentId ? nationStrength(fixture.opponentId) : 70;
    result = fixture.isDecisive
      ? decisiveScoreline(scored)
      : simulateClubMatch({ clubStrength: us, opponentStrength: them, isHome }, rng, playerGoals);
  } else if (fixture.isDecisive) {
    result = decisiveScoreline(scored);
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
    );
  }

  const isTitleRival = fixture.kind === 'league' && fixture.opponentId === sim.titleRivalId;
  if (isTitleRival && playerGoals > 0 && result.outcome === 'loss') {
    result = { scoreFor: result.scoreAgainst, scoreAgainst: result.scoreAgainst, outcome: 'draw' };
  }

  if (fixture.kind === 'domestic-cup') {
    result = settleCupIfDrawn(result, playerClub, clubOpp, rng);
  }
  if (
    isInternational &&
    !fixture.isDecisive &&
    fixture.internationalRound &&
    fixture.internationalRound !== 'qualifier' &&
    fixture.internationalRound !== 'group'
  ) {
    const us = sim.nationId ? nationStrength(sim.nationId) : 70;
    const them = fixture.opponentId ? nationStrength(fixture.opponentId) : 70;
    result = settleNationIfDrawn(result, us, them, rng);
  }

  let next = { ...sim };
  if (fixture.kind === 'league' && fixture.opponentId) {
    let table = applyMatchToTable(next.leagueTable, playerClub.id, fixture.opponentId, result);
    table = simulateRestOfLeagueRound(table, playerClub.id, fixture.opponentId, rng);
    next.leagueTable = table;
    if (isTitleRival) {
      if (isHome) next.rivalHomeOutcome = result.outcome;
      else next.rivalAwayOutcome = result.outcome;
    }
  } else if (fixture.kind === 'domestic-cup') {
    next = applyDomesticCupResult(next, fixture, result);
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
