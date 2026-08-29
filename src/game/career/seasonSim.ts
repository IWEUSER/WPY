import type { CalendarFixture, DomesticCupStage, SeasonCalendar } from './calendar';
import { buildSeasonCalendar } from './calendar';
import {
  chancesForDecisiveMatch,
  chancesForKnockoutTie,
  chancesForLeagueMatch,
} from './chanceEngine';
import { clubsInCountry, clubsInLeague, getClub, type Club } from './data/clubs';
import {
  confederationForCountry,
  continentalCupForClub,
  DOMESTIC_CUPS,
  internationalCampaignForSeason,
  type ContinentalCupId,
  type DomesticCupId,
  type InternationalCampaignPhase,
  type InternationalTournamentId,
} from './data/competitions';
import {
  doesNationQualify,
  nationStrength,
  qualifierCountFor,
  qualifierOpponents,
  tournamentOpponents,
} from './data/fifaRankings';
import { getNation, isSelectedForNationalTeam } from './international';
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
import { SEASON_LENGTH } from './constants';

export type InternationalStage =
  | 'not-selected'
  | 'qualifying'
  | 'qualified'
  | 'failed-qualifying'
  | 'group'
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
  nationQualified: boolean;
  domesticCup: DomesticCupId | null;
  domesticCupStage: DomesticCupProgress;
  honours: SeasonHonours;
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
  previousSeasonRatio: number;
  nationId: string | null;
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
  const { seasonNumber, club, previousSeasonRatio, nationId } = params;
  const clubConfederation = confederationForCountry(club.country);
  const nation = nationId ? getNation(nationId) : undefined;
  const cup = continentalCupForClub(club.tier, clubConfederation);
  const campaign = internationalCampaignForSeason(seasonNumber, nation?.confederation ?? clubConfederation);
  const tournament = campaign?.tournament ?? null;
  const internationalSelected = Boolean(
    nationId &&
      campaign.tournament &&
      campaign.phase !== 'none' &&
      isSelectedForNationalTeam(club.tier, previousSeasonRatio),
  );
  const qualifierTarget = tournament ? qualifierCountFor(tournament) : 0;

  let calendar = buildSeasonCalendar({
    seasonNumber,
    leagueMatchWeeks: SEASON_LENGTH,
    clubTier: club.tier,
    confederation: clubConfederation,
    country: club.country,
    nationConfederation: nation?.confederation ?? null,
    includeInternational: internationalSelected,
  });
  calendar = assignOpponentsAndChances(calendar, club, cup, nationId, tournament);

  const leagueClubs = clubsInLeague(club.league);
  const leagueTable = leagueClubs.map((c) => emptyStanding(c.id));
  const europeanStanding: EuropeanStanding | null = cup ? { cup, stage: 'group' } : null;
  const domesticCup = calendar.domesticCup ?? null;

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
      internationalTournament: internationalSelected ? tournament : null,
      internationalPhase: internationalSelected ? campaign.phase : 'none',
      nationId: nationId ?? null,
      qualifierPoints: 0,
      qualifierPlayed: 0,
      qualifierTarget,
      nationQualified: false,
      domesticCup,
      domesticCupStage: domesticCup ? 'round-of-16' : 'not-entered',
      honours: emptyHonours(),
    },
  };
}

function assignOpponentsAndChances(
  calendar: SeasonCalendar,
  club: Club,
  cup: ContinentalCupId | null,
  nationId: string | null,
  tournament: InternationalTournamentId | null,
): SeasonCalendar {
  const leagueRivals = shuffle(clubsInLeague(club.league).filter((c) => c.id !== club.id));
  const euroRivals = cup ? shuffle(clubsForContinentalCup(cup).filter((id) => id !== club.id)) : [];
  const cupRivals = shuffle(clubsInCountry(club.country).filter((c) => c.id !== club.id));
  const qualifierRivals = nationId && tournament ? qualifierOpponents(nationId, tournament) : [];
  const tournamentRivals = nationId && tournament ? tournamentOpponents(nationId, tournament) : [];

  let leagueI = 0;
  let euroI = 0;
  let cupI = 0;
  let qualifierI = 0;
  let tournamentI = 0;

  const fixtures = calendar.fixtures.map((f) => ({ ...f }));

  for (let i = 0; i < fixtures.length; i++) {
    const f = fixtures[i];
    if (f.kind === 'league') {
      const opp = leagueRivals[leagueI % Math.max(1, leagueRivals.length)];
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
    } else if (f.kind === 'continental-group' || f.kind === 'super-cup') {
      const oppId = euroRivals[euroI % Math.max(1, euroRivals.length)];
      euroI += 1;
      const opp = oppId ? getClub(oppId) : undefined;
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
    } else if (f.kind === 'continental-semi-final' || f.kind === 'continental-final') {
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

export function shouldSkipFixture(fixture: CalendarFixture, sim: SeasonSimState): boolean {
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
    next.europeanStanding.stage = result.outcome === 'win' ? 'final' : 'eliminated';
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
      const qualified = doesNationQualify(
        next.nationId,
        next.internationalTournament,
        next.qualifierPoints,
        next.qualifierPlayed,
      );
      next.nationQualified = qualified;
      if (!qualified) {
        next.internationalStage = 'failed-qualifying';
      } else if (next.internationalPhase === 'qualifiers-and-tournament') {
        next.internationalStage = 'group';
      } else {
        next.internationalStage = 'qualified';
      }
    }
    return next;
  }
  if (fixture.internationalRound === 'group') {
    next.internationalStage = outcome === 'win' || outcome === 'draw' || scored ? 'semi-final' : 'eliminated';
    return next;
  }
  if (fixture.internationalRound === 'semi-final') {
    next.internationalStage = scored ? 'final' : 'eliminated';
    return next;
  }
  if (fixture.internationalRound === 'final') {
    if (scored) {
      next.internationalStage = 'champion';
      next.honours = { ...next.honours, internationalChampion: sim.internationalTournament };
    } else {
      next.internationalStage = 'eliminated';
    }
    return next;
  }
  return next;
}

export const GROUP_STAGE_MATCHDAYS = GROUP_GAMES;
export const GROUP_POINTS_TO_ADVANCE = GROUP_ADVANCE_POINTS;

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
  if (fixture.kind === 'league') return `League${vs}`;
  if (fixture.kind === 'domestic-cup') {
    const cupName = fixture.domesticCup ? DOMESTIC_CUPS[fixture.domesticCup].name : 'Cup';
    return `${cupName} ${cupRoundLabel(fixture.domesticCupStage)}${vs}`;
  }
  if (fixture.kind === 'super-cup') return `Super Cup${vs}`;
  if (fixture.kind === 'continental-group') return `Group stage${vs}`;
  if (fixture.kind === 'continental-knockout') {
    const leg = fixture.leg === 2 ? ' 2nd leg' : ' 1st leg';
    return `Knockout${leg}${vs}`;
  }
  if (fixture.kind === 'continental-semi-final') return `Semi-final${vs}`;
  if (fixture.kind === 'continental-final') return `Final${vs}`;
  if (fixture.kind === 'international') {
    const round =
      fixture.internationalRound === 'qualifier'
        ? 'Qualifier'
        : fixture.internationalRound === 'group'
          ? 'Group'
          : fixture.internationalRound === 'semi-final'
            ? 'Semi-final'
            : 'Final';
    if (opts?.playerNationName && fixture.opponentLabel) {
      return `${round}: ${opts.playerNationName} vs ${fixture.opponentLabel}`;
    }
    return `${round}${vs}`;
  }
  return vs.trim();
}

function settleCupIfDrawn(
  result: ClubMatchResult,
  playerClub: Club,
  opponent: Club | undefined,
  rng: () => number,
): ClubMatchResult {
  if (result.outcome !== 'draw') return result;
  const us = playerClub.strength;
  const them = opponent?.strength ?? 70;
  const pWinPens = 1 / (1 + 10 ** ((them - us) / 18));
  const won = rng() < pWinPens;
  return won
    ? { scoreFor: result.scoreFor + 1, scoreAgainst: result.scoreAgainst, outcome: 'win' }
    : { scoreFor: result.scoreFor, scoreAgainst: result.scoreAgainst + 1, outcome: 'loss' };
}

export function resolveFixture(
  sim: SeasonSimState,
  fixture: CalendarFixture,
  playerClub: Club,
  playerGoals: number,
  rng: () => number = Math.random,
): { sim: SeasonSimState; result: ClubMatchResult; summary: string } {
  const isHome = fixture.week % 2 === 1;
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

  if (fixture.kind === 'domestic-cup') {
    result = settleCupIfDrawn(result, playerClub, clubOpp, rng);
  }

  let next = { ...sim };
  if (fixture.kind === 'league' && fixture.opponentId) {
    let table = applyMatchToTable(next.leagueTable, playerClub.id, fixture.opponentId, result);
    table = simulateRestOfLeagueRound(table, playerClub.id, fixture.opponentId, rng);
    next.leagueTable = table;
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
