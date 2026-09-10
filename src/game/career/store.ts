import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyMatchResult, createAvailability, isAvailable, serveBannedGame } from './availabilityEngine';
import { rollInjuryAbsence, sitOutGamesAfterPlayedMatch } from './injury';
import { recordClubAppearanceStats } from './seasonStats';
import { FORM_WINDOW_GAMES, RETIREMENT_AGE, SEASON_LENGTH, STARTING_AGE } from './constants';
import { planSuperCup } from './continentalDraw';
import { planDomesticSuperCup } from './domesticSuperCup';
import { getClub, leagueMatchWeeks } from './data/clubs';
import { clubContinentalCup, internationalCalendarSeason, isInternationalFinalsSeason, type ContinentalCupId } from './data/competitions';
import { continentalQualificationForNextSeason } from './europeanQualification';
import {
  DEFAULT_CONTRACT_YEARS,
  FIRST_CONTRACT_YEARS,
  loanContractYearsRemaining,
  newContractYears,
  playerMarketValue,
  playerMarketValueFromSeasons,
  RESERVE_CONTRACT_YEARS,
  RESERVE_WEEKLY_WAGE,
  seasonalSponsorship,
  weeklyWageForClub,
  YOUTH_LOAN_YEARS,
} from './playerValue';
import { evaluatePlayerOfTheYear, evaluateTopGoalscorer } from './domesticAwards';
import { evaluateClubPlayerOfTheTournament } from './clubInternationalAwards';
import { evaluateInternationalTournamentAwards } from './internationalAwards';
import { countsTowardCareerRecord } from './seasonDisplay';
import { trophyLabels } from './honoursDisplay';
import {
  bumpInternationalSeason,
  isInternationalFinalsRound,
  callUpRatio,
  createNationalTeamState,
  emptyInternationalSeason,
  isSelectedForNationalTeam,
  markInjuryMissedFinals,
  qualifierExcludeIds,
  recordInternationalAppearance,
  rememberQualifierOpponents,
  snapshotInternationalOutcomes,
  patchPriorQualifyingOutcomes,
} from './international';
import { buildSeasonStandings, type ClubMatchResult } from './matchEngine';
import { isFinalFixture, isInternationalTournamentFixture, type CalendarFixture, type SeasonCalendar } from './calendar';
import {
  canWinLeague,
  ensureInternationalGroup,
  hydrateSeason,
  remainingPlayableCount,
  reassignLeagueHomeAway,
  resolveFixture,
  shouldSkipFixture,
  syncInternationalCalendar,
  trophyNameForFixture,
  internationalRoundLabel,
  type LiveMatch,
  type SeasonSimState,
} from './seasonSim';
import { offerClubsForTrial, trialContractWon, TRIAL_SHOTS, type TrialRatioBar } from './trial';
import {
  applyTrialMatch,
  applyYouthMatch,
  assignOpeningTrialClub,
  beginClubTrial,
  beginFavouriteClubTrial,
  clubTrialComplete,
  createYouthCampaign,
  failClubTrial,
  openingMatchSummary,
  resolveOpeningMatch,
  youthTournamentComplete,
  youthTrophyName,
} from './openingFlow';
import { getNation } from './international';
import {
  countLoanSpells,
  requiredGoalRatio,
  resolveSeasonTransition,
  sellingClubAcceptsOffer,
  trialFailTransferPending,
} from './transfers';
import {
  completedLeagueFixtureCount,
  defaultSquadStatus,
  isSquadRotationSitOut,
  nextSquadStatusAfterSeason,
  squadStatusOnArrival,
} from './squadStatus';
import { evaluateWpy } from './wpy';
import { composeMatchSummary, nextFixtureLine, playerGoalsLine } from './matchBriefing';
import type { ShotResult } from '../shooting/types';
import type { CareerStart, CareerState, LastMatchResult, MatchRecord, PlayerRole, SeasonRecord, SquadStatus } from './types';

export { SEASON_LENGTH } from './constants';

function freshSeason(
  seasonNumber: number,
  clubId: string,
  role: CareerState['role'],
  age: number,
  squadStatus?: SquadStatus,
): SeasonRecord {
  return {
    seasonNumber,
    clubId,
    role,
    squadStatus: squadStatus ?? defaultSquadStatus(role),
    matches: [],
    goals: 0,
    gamesPlayed: 0,
    ratioMet: null,
    age,
    leagueGoals: 0,
    leagueGames: 0,
    cupGames: 0,
    cupGoals: 0,
    domesticGames: 0,
    domesticGoals: 0,
    continentalStats: [],
    trophies: [],
    topGoalscorer: false,
    playerOfTheYear: false,
    wonWpy: false,
    earnings: 0,
    sponsorship: 0,
    international: emptyInternationalSeason(null),
  };
}

function withInternationalForm(
  sim: SeasonSimState,
  season: SeasonRecord | null,
  clubId: string | null,
  nationId: string | null,
  careerGoals: number,
  careerGames: number,
): SeasonSimState {
  if (!clubId) return sim;
  const club = getClub(clubId);
  if (!club) return sim;
  const selected = isSelectedForNationalTeam({
    clubTier: club.tier,
    careerGoalRatio: callUpRatio({ season, careerGoals, careerGames }),
    nationId,
  });
  if (selected === sim.internationalSelected) return sim;
  if (!selected) {
    return {
      ...sim,
      internationalSelected: false,
      internationalStage: sim.internationalStage === 'qualifying' ? 'not-selected' : sim.internationalStage,
    };
  }
  return {
    ...sim,
    internationalSelected: true,
    internationalStage: sim.internationalStage === 'not-selected' ? 'qualifying' : sim.internationalStage,
  };
}

function withWeeklyPay(
  season: SeasonRecord,
  careerEarnings: number,
  weeklyWage: number,
): { season: SeasonRecord; careerEarnings: number } {
  const pay = weeklyWage || 0;
  return {
    season: { ...season, earnings: (season.earnings ?? 0) + pay },
    careerEarnings: careerEarnings + pay,
  };
}

function pushForm(window: number[], goalsThisMatch: number): number[] {
  const next = [...window, goalsThisMatch > 0 ? 1 : 0];
  return next.length > FORM_WINDOW_GAMES ? next.slice(-FORM_WINDOW_GAMES) : next;
}

function reserveSeasonLength(clubId: string | null): number {
  const club = clubId ? getClub(clubId) : undefined;
  return club ? leagueMatchWeeks(club.league, club) : SEASON_LENGTH;
}

function startSimulatedSeason(
  seasonNumber: number,
  clubId: string,
  role: PlayerRole,
  history: SeasonRecord[],
  nationId: string | null,
  age: number,
  careerGoals: number,
  careerGames: number,
  qualifierCarry: CareerState['intlQualifying'],
  superCup?: { include: boolean; opponentId?: string },
  extras?: {
    league?: string | null;
    careerEarnings?: number;
    contractYearsRemaining?: number;
    continentalCup?: ContinentalCupId | null;
    excludeQualifierIds?: string[];
    leagueOnly?: boolean;
    careerStart?: CareerStart | null;
    domesticSuperCup?: { include: boolean; opponentId?: string; name?: string };
    squadStatus?: SquadStatus;
  },
): Pick<
  CareerState,
  | 'currentSeason'
  | 'seasonCalendar'
  | 'seasonSim'
  | 'seasonStandings'
  | 'liveMatch'
  | 'wpyResult'
  | 'lastMatchSummary'
  | 'injuryGamesRemaining'
  | 'seasonSponsorship'
  | 'clubLeague'
  | 'careerEarnings'
> {
  const club = getClub(clubId);
  const league = extras?.league ?? club?.league ?? null;
  let season = freshSeason(seasonNumber, clubId, role, age, extras?.squadStatus);
  season = { ...season, league: league ?? undefined };
  const sponsorship =
    club && role !== 'reserve'
      ? seasonalSponsorship(
          playerMarketValueFromSeasons({
            age,
            careerGoals,
            careerGames,
            seasons: history,
            fallbackClub: club,
            contractYearsRemaining: extras?.contractYearsRemaining ?? DEFAULT_CONTRACT_YEARS,
            seasonNumber,
            calendarWeek: 0,
            careerStart: extras?.careerStart,
            role,
          }),
          league,
        )
      : 0;
  season = { ...season, sponsorship, earnings: (season.earnings ?? 0) + sponsorship };
  const careerEarnings = (extras?.careerEarnings ?? 0) + sponsorship;

  if (!club) {
    return {
      currentSeason: season,
      seasonCalendar: null,
      seasonSim: null,
      seasonStandings: null,
      liveMatch: null,
      wpyResult: null,
      lastMatchSummary: null,
      injuryGamesRemaining: 0,
      seasonSponsorship: sponsorship,
      clubLeague: league,
      careerEarnings,
    };
  }
  const leagueOnly = extras?.leagueOnly ?? role === 'reserve';
  const { calendar, sim } = hydrateSeason({
    seasonNumber,
    club,
    careerGoalRatio: callUpRatio({ season, careerGoals, careerGames }),
    nationId,
    qualifierCarry,
    includeSuperCup: leagueOnly ? false : superCup?.include,
    superCupOpponentId: leagueOnly ? undefined : superCup?.opponentId,
    includeDomesticSuperCup: leagueOnly ? false : extras?.domesticSuperCup?.include,
    domesticSuperCupOpponentId: leagueOnly ? undefined : extras?.domesticSuperCup?.opponentId,
    domesticSuperCupName: leagueOnly ? undefined : extras?.domesticSuperCup?.name,
    league: league ?? club.league,
    continentalCup: leagueOnly ? null : extras?.continentalCup,
    excludeQualifierIds: leagueOnly ? undefined : extras?.excludeQualifierIds,
    leagueOnly,
    careerStart: extras?.careerStart,
  });
  season = {
    ...season,
    international: emptyInternationalSeason(sim.internationalTournament),
  };
  return {
    currentSeason: season,
    seasonCalendar: calendar,
    seasonSim: sim,
    seasonStandings: buildSeasonStandings(sim.leagueTable, sim.europeanStanding),
    liveMatch: null,
    wpyResult: null,
    lastMatchSummary: null,
    injuryGamesRemaining: 0,
    seasonSponsorship: sponsorship,
    clubLeague: league,
    careerEarnings,
  };
}

function recapFromResolution(opts: {
  headline: string;
  result: ClubMatchResult;
  aggregateLine: string | null;
  calendar: SeasonCalendar;
  sim: SeasonSimState;
  playerGoals?: number;
  chances?: number;
  extra?: string | null;
  nationName?: string;
  isFinal: boolean;
  trophyName: string | null;
  afterPhase: LastMatchResult['afterPhase'];
}): { lastMatchSummary: string; lastMatchResult: LastMatchResult } {
  const playerLine =
    opts.chances != null && opts.playerGoals != null
      ? playerGoalsLine(opts.playerGoals, opts.chances)
      : null;
  const nextLine = nextFixtureLine(
    opts.calendar,
    opts.sim,
    { playerNationName: opts.nationName, tournament: opts.sim.internationalTournament },
    opts.afterPhase === 'season-summary',
  );
  const summary = composeMatchSummary({
    headline: opts.headline,
    playerLine,
    aggregateLine: opts.aggregateLine,
    nextLine,
    extra: opts.extra,
  });
  return {
    lastMatchSummary: summary,
    lastMatchResult: {
      summary,
      headline: opts.headline,
      isFinal: opts.isFinal,
      won: opts.result.outcome === 'win',
      trophyName: opts.trophyName,
      afterPhase: opts.afterPhase,
      playerGoals: opts.playerGoals ?? null,
      chances: opts.chances ?? null,
      aggregateLine: opts.aggregateLine,
      nextLine,
    },
  };
}

function finalizeSimHonours(state: CareerState): CareerState['seasonSim'] {
  const sim = state.seasonSim;
  if (!sim || !state.clubId) return sim;
  return { ...sim, honours: { ...sim.honours, leagueChampion: canWinLeague(sim, state.clubId) } };
}

function evaluateSeasonWpy(state: CareerState) {
  const club = state.clubId ? getClub(state.clubId) : undefined;
  const season = state.currentSeason;
  const sim = state.seasonSim;
  if (!club || !season || !sim || !countsTowardCareerRecord(state.seasonNumber, state.role)) return null;
  const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
  const formGoals = state.formWindow.reduce((a, b) => a + b, 0);
  return evaluateWpy({
    seasonGoalRatio: ratio,
    eliteRatioBar: club.firstTeamGoalRatio,
    wonChampionsLeague: sim.honours.continentalChampion === 'ucl',
    isInternationalTournamentYear: isInternationalFinalsSeason(
      internationalCalendarSeason(state.seasonNumber, {
        careerStart: state.careerStart,
        role: state.role,
      }),
    ),
    wonInternationalTournament: sim.honours.internationalChampion !== null,
    recentFormGoals: formGoals,
    recentFormGames: state.formWindow.length,
  });
}

function attachSeasonAwards(state: CareerState): { season: SeasonRecord; wpyResult: CareerState['wpyResult'] } {
  const season = state.currentSeason;
  if (!season || !state.clubId) {
    return { season: season as SeasonRecord, wpyResult: state.wpyResult };
  }
  if (!countsTowardCareerRecord(state.seasonNumber, state.role)) {
    return {
      season: {
        ...season,
        age: state.age,
        trophies: [],
        topGoalscorer: false,
        playerOfTheYear: false,
        wonWpy: false,
        topGoalscorerReason: 'Reserve seasons do not contest domestic awards.',
        playerOfTheYearReason: 'Reserve seasons do not contest domestic awards.',
        clubPlayerOfTheTournament: false,
        clubPlayerOfTheTournamentReason: 'Reserve seasons do not contest club continental awards.',
      },
      wpyResult: null,
    };
  }
  const club = getClub(state.clubId);
  const sim = state.seasonSim;
  const wpyResult = evaluateSeasonWpy(state);
  const league = state.clubLeague ?? club?.league ?? '';
  const boot = evaluateTopGoalscorer(season.leagueGoals, league);
  const poty = evaluatePlayerOfTheYear({
    leagueChampion: sim?.honours.leagueChampion ?? false,
    leagueGoals: season.leagueGoals,
    league,
    topGoalscorer: boot.won,
  });
  const international = snapshotInternationalOutcomes(
    season.international ?? emptyInternationalSeason(sim?.internationalTournament ?? null),
    sim,
  );
  const playedFinals = international.finalsGames > 0 && international.tournament;
  const intlAwards = playedFinals
    ? evaluateInternationalTournamentAwards({
        tournament: international.tournament!,
        finalsGoals: international.finalsGoals,
        tournamentOutcome: international.tournamentOutcome,
      })
    : { playerOfTheTournament: false, topGoalscorer: false, chance: 0 };
  const clubPot = evaluateClubPlayerOfTheTournament({
    continentalChampion: sim?.honours.continentalChampion ?? null,
    continentalStats: season.continentalStats,
  });
  return {
    wpyResult,
    season: {
      ...season,
      age: state.age,
      trophies: trophyLabels(sim?.honours, club, state.clubLeague),
      topGoalscorer: boot.won,
      playerOfTheYear: poty.won,
      wonWpy: wpyResult?.won ?? false,
      topGoalscorerReason: boot.reason,
      playerOfTheYearReason: poty.reason,
      clubPlayerOfTheTournament: clubPot.won,
      clubPlayerOfTheTournamentReason: clubPot.reason,
      wpyReason: wpyResult?.reason ?? null,
      international: {
        ...international,
        playerOfTheTournament: intlAwards.playerOfTheTournament,
        topGoalscorer: intlAwards.topGoalscorer,
      },
    },
  };
}

function liveFromOpening(campaign: CareerState['openingCampaign']): NonNullable<CareerState['liveMatch']> | null {
  if (!campaign) return null;
  const fixture = campaign.calendar.fixtures[campaign.fixtureIndex];
  if (!fixture) return null;
  return {
    fixtureIndex: campaign.fixtureIndex,
    chancesTotal: fixture.playerChances ?? 1,
    chancesTaken: 0,
    goals: 0,
    openPlayGoals: 0,
  };
}

function finishOpeningMatch(state: CareerState): Partial<CareerState> {
  const campaign = state.openingCampaign;
  const live = state.liveMatch;
  if (!campaign || !live) return {};
  const fixture = campaign.calendar.fixtures[live.fixtureIndex];
  if (!fixture) return {};
  const nationId = state.nationality;
  const result = resolveOpeningMatch(fixture, live.goals, campaign.trialClubId, nationId);
  const nationName = nationId ? getNation(nationId)?.name : undefined;
  const summary = `${openingMatchSummary(fixture, result, nationName)} · ${live.goals} goal${live.goals === 1 ? '' : 's'} from ${live.chancesTotal} chance${live.chancesTotal === 1 ? '' : 's'}`;

  if (campaign.kind === 'youth-tournament' && nationId) {
    const next = applyYouthMatch(campaign, fixture, result, live.goals, nationId);
    const done = youthTournamentComplete(next);
    const trophyName = youthTrophyName(next, fixture, result.outcome === 'win');
    const nextRound = next.calendar.fixtures[next.fixtureIndex];
    let youthSummary = summary;
    if (fixture.internationalRound === 'group' && next.qualified && nextRound) {
      youthSummary = `${summary} · through to the ${internationalRoundLabel(nextRound.internationalRound).toLowerCase()}`;
    } else if (fixture.internationalRound === 'group' && next.eliminated) {
      youthSummary = `${summary} · did not get out of the group`;
    } else if (fixture.internationalRound && fixture.internationalRound !== 'group') {
      if (next.eliminated || (done && result.outcome !== 'win' && fixture.internationalRound !== 'final')) {
        youthSummary = `${summary} · ${nationName ?? 'You'} are out`;
      } else if (nextRound && !done) {
        youthSummary = `${summary} · through to the ${internationalRoundLabel(nextRound.internationalRound).toLowerCase()}`;
      }
    }
    if (done) {
      const assigned = assignOpeningTrialClub(next, nationId);
      return {
        openingCampaign: assigned,
        seasonCalendar: assigned.calendar,
        liveMatch: null,
        lastMatchSummary: youthSummary,
        lastMatchResult: {
          summary: youthSummary,
          isFinal: fixture.internationalRound === 'final',
          won: result.outcome === 'win',
          trophyName,
          afterPhase: 'opening-brief',
        },
        phase: 'match-result',
      };
    }
    return {
      openingCampaign: next,
      seasonCalendar: next.calendar,
      liveMatch: null,
      lastMatchSummary: youthSummary,
      lastMatchResult: {
        summary: youthSummary,
        isFinal: fixture.internationalRound === 'final',
        won: result.outcome === 'win',
        trophyName,
        afterPhase: 'hub',
      },
      phase: 'match-result',
    };
  }

  const next = applyTrialMatch(campaign, live.goals);
  if (!clubTrialComplete(next)) {
    return {
      openingCampaign: next,
      seasonCalendar: next.calendar,
      liveMatch: null,
      lastMatchSummary: summary,
      lastMatchResult: {
        summary,
        isFinal: false,
        won: result.outcome === 'win',
        trophyName: null,
        afterPhase: 'hub',
      },
      phase: 'match-result',
    };
  }

  const club = next.trialClubId ? getClub(next.trialClubId) : undefined;
  const bar = trialBarForStart(state.careerStart);
  const signed = club ? trialContractWon(club, next.goals, next.gamesPlayed, bar) : false;
  if (signed && club) {
    return {
      openingCampaign: next,
      liveMatch: null,
      lastMatchSummary: summary,
      lastMatchResult: {
        summary,
        isFinal: false,
        won: result.outcome === 'win',
        trophyName: null,
        afterPhase: 'club-offer',
      },
      trial: { shots: [], goals: next.goals, offeredClubIds: [club.id] },
      phase: 'match-result',
    };
  }
  const failed = failClubTrial(next, state.nationality);
  if (!failed.exhausted) {
    return {
      openingCampaign: failed.opening,
      seasonCalendar: failed.opening.calendar,
      liveMatch: null,
      lastMatchSummary: summary,
      lastMatchResult: {
        summary,
        isFinal: false,
        won: result.outcome === 'win',
        trophyName: null,
        afterPhase: 'opening-brief',
      },
      phase: 'match-result',
    };
  }
  const pending = trialFailTransferPending({
    bestRatio: failed.opening.bestTrialRatio ?? 0,
    nationality: nationId,
    excludeIds: failed.opening.rejectedClubIds,
    homeCountry: failed.opening.originCountry,
    minFromCountry: 4,
  });
  return {
    openingCampaign: failed.opening,
    clubId: next.trialClubId ?? state.clubId,
    parentClubId: next.trialClubId ?? state.parentClubId ?? next.trialClubId,
    pendingTransfer: pending,
    trial: { shots: [], goals: next.goals, offeredClubIds: pending.clubIds },
    liveMatch: null,
    lastMatchSummary: summary,
    lastMatchResult: {
      summary,
      isFinal: false,
      won: result.outcome === 'win',
      trophyName: null,
      afterPhase: 'opening-brief',
    },
    phase: 'match-result',
  };
}

function initialState(): CareerState {
  return {
    phase: 'menu',
    careerStart: null,
    age: STARTING_AGE,
    seasonNumber: 1,
    clubId: null,
    parentClubId: null,
    role: 'reserve',
    squadStatus: 'rotation',
    lastTransferRejection: null,
    seasonsAtCurrentClub: 0,
    trial: null,
    openingCampaign: null,
    availability: createAvailability(),
    currentSeason: null,
    seasonHistory: [],
    careerGoals: 0,
    careerGames: 0,
    pendingTransfer: null,
    nationality: null,
    nationalTeam: null,
    seasonCalendar: null,
    seasonStandings: null,
    seasonSim: null,
    liveMatch: null,
    formWindow: [],
    wpyResult: null,
    lastMatchSummary: null,
    lastMatchResult: null,
    weeklyWage: 0,
    careerEarnings: 0,
    contractYears: DEFAULT_CONTRACT_YEARS,
    contractYearsRemaining: DEFAULT_CONTRACT_YEARS,
    clubLeague: null,
    homeContractYearsRemaining: null,
    seasonSponsorship: 0,
    injuryGamesRemaining: 0,
    previousContinentalChampion: null,
    previousChampionClubId: null,
    qualifiedContinentalCup: null,
    intlQualifying: null,
    lastSuperCupOpponentId: null,
  };
}

function qualifierOpponentIdsFromCalendar(calendar: CareerState['seasonCalendar']): string[] {
  if (!calendar) return [];
  return calendar.fixtures
    .filter((f) => f.kind === 'international' && f.internationalRound === 'qualifier' && f.opponentId)
    .map((f) => f.opponentId as string);
}

function nextQualifyingCarry(
  sim: CareerState['seasonSim'],
  opponentIds: string[] = [],
): CareerState['intlQualifying'] {
  if (!sim?.internationalSelected || !sim.internationalTournament) return null;
  if (sim.internationalPhase !== 'qualifiers') return null;
  return {
    tournament: sim.internationalTournament,
    points: sim.qualifierPoints + sim.qualifierCarryPoints,
    played: sim.qualifierPlayed + sim.qualifierCarryPlayed,
    opponentIds,
    group: sim.internationalGroup?.kind === 'qualifying' ? sim.internationalGroup : undefined,
  };
}

function nextDomesticSuperCup(
  nextClub: ReturnType<typeof getClub>,
  previousClubId: string | null,
  sim: CareerState['seasonSim'],
  league: string | null | undefined,
  role: PlayerRole,
): { include: boolean; opponentId?: string; name?: string } {
  if (!nextClub || role === 'reserve') return { include: false };
  return planDomesticSuperCup({
    nextClub,
    previousClubId,
    wonLeague: sim?.honours.leagueChampion ?? false,
    wonCup: Boolean(sim?.honours.domesticCup),
    previousLeague: league,
  });
}

function recountCareerTotals(history: SeasonRecord[], current: SeasonRecord | null | undefined) {
  let goals = 0;
  let games = 0;
  for (const season of [...history, ...(current ? [current] : [])]) {
    if (!countsTowardCareerRecord(season.seasonNumber, season.role)) continue;
    goals += season.goals;
    games += season.gamesPlayed;
  }
  return { careerGoals: goals, careerGames: games };
}

function isFavouriteStart(start: CareerStart | null | undefined): boolean {
  return start === 'favourite-trial' || start === 'favourite-reserve' || start === 'favourite-first-team';
}

function trialBarForStart(_start: CareerStart | null | undefined): TrialRatioBar {
  return 'reserve';
}

function beginSignedCareer(
  clubId: string,
  role: 'reserve' | 'first-team',
  nationId: string | null,
  careerStart: CareerStart | null,
): Partial<CareerState> {
  const club = getClub(clubId);
  const seasonNumber = 1;
  const age = role === 'first-team' ? STARTING_AGE + 1 : STARTING_AGE;
  const dealYears = role === 'reserve' ? RESERVE_CONTRACT_YEARS : FIRST_CONTRACT_YEARS;
  const weeklyWage =
    role === 'reserve'
      ? RESERVE_WEEKLY_WAGE
      : club
        ? weeklyWageForClub(club, playerMarketValue({ age, ratio: 0.3, careerGoals: 0, club }))
        : 3000;
  return {
    clubId,
    parentClubId: clubId,
    role,
    squadStatus: defaultSquadStatus(role),
    lastTransferRejection: null,
    seasonNumber,
    age,
    seasonsAtCurrentClub: 0,
    availability: createAvailability(),
    weeklyWage,
    contractYears: dealYears,
    contractYearsRemaining: dealYears,
    careerStart,
    ...startSimulatedSeason(seasonNumber, clubId, role, [], nationId, age, 0, 0, null, undefined, {
      league: club?.league,
      careerEarnings: 0,
      contractYearsRemaining: dealYears,
      careerStart,
      squadStatus: defaultSquadStatus(role),
    }),
    pendingTransfer: null,
    openingCampaign: null,
    trial: null,
    liveMatch: null,
    phase: 'hub',
  };
}

interface CareerActions {
  /** Opens nationality selection before the Youth Championships. */
  startCareer: () => void;
  startYouthChampionships: () => void;
  startFavouritePath: (kind: Exclude<CareerStart, 'youth'>) => void;
  chooseFavouriteClub: (clubId: string) => void;
  backFromSetup: () => void;
  startTrial: () => void;
  startOpeningTrial: () => void;
  recordTrialShot: (result: ShotResult) => void;
  finishTrial: () => void;
  chooseClub: (clubId: string) => void;
  chooseNationality: (nationId: string) => void;
  advance: () => void;
  recordMatchChance: (result: ShotResult) => void;
  finishLiveMatch: () => void;
  acknowledgeMatchResult: () => void;
  /** Season 1 one-shot matches still call this. */
  recordMatchShot: (result: ShotResult) => void;
  continueAfterSeason: () => void;
  resolveTransferChoice: (clubId: string | null) => void;
  openCareerRecord: () => void;
  returnToHub: () => void;
  resetCareer: () => void;
  returnToMenu: () => void;
}

export type CareerStore = CareerState & CareerActions;

function openNextSimFixture(state: CareerState): Partial<CareerState> {
  let sim = state.seasonSim;
  let calendar = state.seasonCalendar;
  let season = state.currentSeason;
  let availability = state.availability;
  let nationalTeam = state.nationalTeam;
  let careerGames = state.careerGames;
  let careerEarnings = state.careerEarnings;
  let formWindow = state.formWindow;
  let lastMatchSummary = state.lastMatchSummary;
  let lastMatchResult: LastMatchResult | null = state.lastMatchResult;
  let injuryGamesRemaining = state.injuryGamesRemaining ?? 0;
  if (!sim || !calendar || !season || !state.clubId) return {};
  const club = getClub(state.clubId);
  if (!club) return {};
  const nationName = state.nationality ? getNation(state.nationality)?.name : undefined;

  const applySitOutRecap = (
    resolution: ReturnType<typeof resolveFixture>,
    fixture: CalendarFixture,
    extra: string,
    afterPhase: LastMatchResult['afterPhase'],
    isFinal: boolean,
    recapSim: SeasonSimState,
    recapCalendar: SeasonCalendar,
  ) => {
    const recap = recapFromResolution({
      headline: resolution.summary,
      result: resolution.result,
      aggregateLine: resolution.aggregateLine,
      calendar: recapCalendar,
      sim: recapSim,
      extra,
      nationName,
      isFinal,
      trophyName: trophyNameForFixture(fixture, recapSim.internationalTournament),
      afterPhase,
    });
    lastMatchSummary = recap.lastMatchSummary;
    lastMatchResult = recap.lastMatchResult;
  };

  const sitOutHub = (): Partial<CareerState> => {
    calendar = syncInternationalCalendar(calendar!, sim!);
    const complete = sim!.fixtureIndex >= calendar.fixtures.length;
    if (complete) {
      const withHonours = {
        ...sim!,
        honours: { ...sim!.honours, leagueChampion: canWinLeague(sim!, state.clubId!) },
      };
      const nextState = { ...state, seasonSim: withHonours, seasonCalendar: calendar, currentSeason: season, availability, nationalTeam, formWindow, careerGames, careerEarnings, injuryGamesRemaining };
      const awarded = attachSeasonAwards(nextState);
      return {
        seasonSim: withHonours,
        seasonCalendar: calendar,
        currentSeason: awarded.season,
        availability,
        nationalTeam,
        careerGames,
        careerEarnings,
        formWindow,
        lastMatchSummary,
        lastMatchResult,
        injuryGamesRemaining,
        liveMatch: null,
        seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
        phase: 'season-summary',
        wpyResult: awarded.wpyResult,
      };
    }
    return {
      seasonSim: sim,
      seasonCalendar: calendar,
      currentSeason: season,
      availability,
      nationalTeam,
      careerGames,
      careerEarnings,
      formWindow,
      lastMatchSummary,
      lastMatchResult,
      injuryGamesRemaining,
      seasonStandings: buildSeasonStandings(sim!.leagueTable, sim!.europeanStanding),
      liveMatch: null,
      phase: 'hub',
    };
  };

  while (sim.fixtureIndex < calendar.fixtures.length) {
    const fixture = calendar.fixtures[sim.fixtureIndex];
    if (shouldSkipFixture(fixture, sim)) {
      sim = { ...sim, fixtureIndex: sim.fixtureIndex + 1 };
      continue;
    }

    const isInternational = fixture.kind === 'international';
    const squad = isInternational ? nationalTeam?.availability : availability;
    if (injuryGamesRemaining > 0) {
      const resolution = resolveFixture(sim, fixture, club, 0);
      sim = { ...resolution.sim, fixtureIndex: sim.fixtureIndex + 1 };
      const record: MatchRecord = { matchNumber: season.matches.length + 1, played: false, scored: null };
      const injuredPay = withWeeklyPay(season, careerEarnings, state.weeklyWage);
      season = { ...injuredPay.season, matches: [...injuredPay.season.matches, record] };
      if (isInternational && isInternationalTournamentFixture(fixture)) {
        season = {
          ...season,
          international: markInjuryMissedFinals(season.international, sim.internationalTournament),
        };
      }
      careerEarnings = injuredPay.careerEarnings;
      const complete = sim.fixtureIndex >= calendar.fixtures.length;
      applySitOutRecap(
        resolution,
        fixture,
        'you were injured',
        complete ? 'season-summary' : 'hub',
        isFinalFixture(fixture),
        sim,
        calendar,
      );
      injuryGamesRemaining -= 1;
      if (isFinalFixture(fixture)) {
        const withHonours = complete
          ? { ...sim, honours: { ...sim.honours, leagueChampion: canWinLeague(sim, state.clubId) } }
          : sim;
        const awarded = complete
          ? attachSeasonAwards({
              ...state,
              seasonSim: withHonours,
              currentSeason: season,
              availability,
              nationalTeam,
              formWindow,
              careerGames,
              careerEarnings,
              injuryGamesRemaining,
            })
          : { season, wpyResult: state.wpyResult };
        return {
          seasonSim: withHonours,
          seasonCalendar: syncInternationalCalendar(calendar, withHonours),
          currentSeason: awarded.season,
          availability,
          nationalTeam,
          careerGames,
          careerEarnings,
          formWindow,
          lastMatchSummary,
          lastMatchResult,
          injuryGamesRemaining,
          seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
          liveMatch: null,
          phase: 'match-result',
          wpyResult: awarded.wpyResult,
        };
      }
      return sitOutHub();
    }
    const rotatedOut = isSquadRotationSitOut(
      state.role,
      state.squadStatus ?? defaultSquadStatus(state.role),
      fixture.kind,
      completedLeagueFixtureCount(calendar, sim.fixtureIndex),
    );
    if (rotatedOut) {
      const resolution = resolveFixture(sim, fixture, club, 0);
      sim = { ...resolution.sim, fixtureIndex: sim.fixtureIndex + 1 };
      const record: MatchRecord = { matchNumber: season.matches.length + 1, played: false, scored: null };
      const rotatedPay = withWeeklyPay(season, careerEarnings, state.weeklyWage);
      season = { ...rotatedPay.season, matches: [...rotatedPay.season.matches, record] };
      careerEarnings = rotatedPay.careerEarnings;
      applySitOutRecap(
        resolution,
        fixture,
        'you were not selected',
        'hub',
        false,
        sim,
        calendar,
      );
      return sitOutHub();
    }
    if (squad && !isAvailable(squad)) {
      const resolution = resolveFixture(sim, fixture, club, 0);
      sim = { ...resolution.sim, fixtureIndex: sim.fixtureIndex + 1 };
      const record: MatchRecord = { matchNumber: season.matches.length + 1, played: false, scored: null };
      const droppedPay = withWeeklyPay(season, careerEarnings, state.weeklyWage);
      season = { ...droppedPay.season, matches: [...droppedPay.season.matches, record] };
      careerEarnings = droppedPay.careerEarnings;
      applySitOutRecap(resolution, fixture, 'you were dropped', 'hub', false, sim, calendar);
      if (isInternational && nationalTeam) {
        nationalTeam = { ...nationalTeam, availability: serveBannedGame(nationalTeam.availability) };
      } else {
        availability = serveBannedGame(availability);
      }
      return sitOutHub();
    }

    const chances = fixture.playerChances ?? 1;
    if (chances <= 0) {
      const resolution = resolveFixture(sim, fixture, club, 0);
      sim = { ...resolution.sim, fixtureIndex: sim.fixtureIndex + 1 };
      const record: MatchRecord = { matchNumber: season.matches.length + 1, played: true, scored: false };
      const noChancePay = withWeeklyPay(season, careerEarnings, state.weeklyWage);
      season = { ...noChancePay.season, matches: [...noChancePay.season.matches, record], gamesPlayed: noChancePay.season.gamesPlayed + 1 };
      careerEarnings = noChancePay.careerEarnings;
      if (countsTowardCareerRecord(state.seasonNumber, state.role)) {
        careerGames += 1;
        formWindow = pushForm(formWindow, 0);
      }
      applySitOutRecap(resolution, fixture, 'no chance this match', 'hub', false, sim, calendar);
      if (isInternational && nationalTeam) {
        nationalTeam = recordInternationalAppearance(
          nationalTeam,
          sim.internationalTournament,
          fixture.internationalRound === 'qualifier',
          0,
          isInternationalFinalsRound(fixture.internationalRound),
        );
        season = {
          ...season,
          international: bumpInternationalSeason(
            season.international,
            sim.internationalTournament,
            fixture.internationalRound === 'qualifier',
            0,
            isInternationalFinalsRound(fixture.internationalRound),
          ),
        };
      }
      return sitOutHub();
    }

    const liveMatch: LiveMatch = { fixtureIndex: sim.fixtureIndex, chancesTotal: chances, chancesTaken: 0, goals: 0, openPlayGoals: 0 };
    return {
      seasonSim: withInternationalForm(sim, season, state.clubId, state.nationality, state.careerGoals, state.careerGames),
      seasonCalendar: calendar,
      currentSeason: season,
      availability,
      nationalTeam,
      careerGames,
      careerEarnings,
      formWindow,
      lastMatchSummary,
      injuryGamesRemaining,
      seasonStandings: buildSeasonStandings(sim.leagueTable, sim.europeanStanding),
      liveMatch,
      phase: 'match',
    };
  }

  const withHonours = {
    ...sim,
    honours: {
      ...sim.honours,
      leagueChampion: canWinLeague(sim, state.clubId),
    },
  };
  const nextState = { ...state, seasonSim: withHonours, currentSeason: season, availability, nationalTeam, formWindow, careerGames, careerEarnings, injuryGamesRemaining };
  const awarded = attachSeasonAwards(nextState);
  return {
    seasonSim: withHonours,
    currentSeason: awarded.season,
    availability,
    nationalTeam,
    careerGames,
    careerEarnings,
    formWindow,
    lastMatchSummary,
    lastMatchResult,
    injuryGamesRemaining,
    liveMatch: null,
    seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
    phase: 'season-summary',
    wpyResult: awarded.wpyResult,
  };
}

export const useCareerStore = create<CareerStore>()(
  persist(
    (set) => ({
      ...initialState(),

      startCareer: () => set({ phase: 'nationality-choice', careerStart: 'youth' }),

      startYouthChampionships: () => set({ phase: 'nationality-choice', careerStart: 'youth' }),

      startFavouritePath: (kind) =>
        set({
          phase: 'club-choice',
          careerStart: kind,
          clubId: null,
          parentClubId: null,
          openingCampaign: null,
        }),

      chooseFavouriteClub: (clubId) =>
        set({
          clubId,
          parentClubId: clubId,
          phase: 'nationality-choice',
        }),

      backFromSetup: () =>
        set((state) => {
          if (state.phase === 'nationality-choice' && isFavouriteStart(state.careerStart)) {
            return { phase: 'club-choice', nationality: null, nationalTeam: null };
          }
          return {
            phase: 'menu',
            careerStart: null,
            clubId: null,
            parentClubId: null,
            nationality: null,
            nationalTeam: null,
            openingCampaign: null,
          };
        }),

      startTrial: () => set({ phase: 'trial', trial: { shots: [], goals: 0, offeredClubIds: [] } }),

      startOpeningTrial: () =>
        set((state) => {
          if (state.phase !== 'opening-brief' || !state.openingCampaign || !state.nationality) return {};
          if (state.pendingTransfer) {
            return {
              openingCampaign: null,
              trial: null,
              phase: 'transfer-choice',
            };
          }
          let opening = state.openingCampaign;
          if (opening.kind === 'youth-tournament') {
            opening = beginClubTrial(opening, state.nationality, opening.trialTier ?? undefined);
          }
          const live = liveFromOpening(opening);
          if (!live) return { openingCampaign: opening, phase: 'opening-brief' };
          return {
            openingCampaign: opening,
            clubId: opening.trialClubId,
            trial: null,
            liveMatch: live,
            seasonCalendar: opening.calendar,
            phase: 'match',
          };
        }),

      recordTrialShot: (result) =>
        set((state) => {
          if (!state.trial) return state;
          const goals = state.trial.goals + (result.outcome === 'goal' ? 1 : 0);
          return { trial: { ...state.trial, shots: [...state.trial.shots, result], goals } };
        }),

      finishTrial: () =>
        set((state) => {
          if (!state.trial) return state;
          const offered = offerClubsForTrial(state.trial.goals, 3, state.nationality);
          return {
            trial: { ...state.trial, offeredClubIds: offered.map((c) => c.id) },
            phase: 'club-offer',
          };
        }),

      chooseClub: (clubId) =>
        set((state) => beginSignedCareer(clubId, 'reserve', state.nationality, state.careerStart)),

      chooseNationality: (nationId) =>
        set((state) => {
          const nationalTeam = createNationalTeamState(nationId);
          if (state.careerStart === 'favourite-trial' && state.clubId) {
            const club = getClub(state.clubId);
            if (!club) return { nationality: nationId, nationalTeam };
            const opening = beginFavouriteClubTrial(club);
            return {
              nationality: nationId,
              nationalTeam,
              openingCampaign: opening,
              clubId: club.id,
              parentClubId: club.id,
              trial: null,
              liveMatch: liveFromOpening(opening),
              seasonCalendar: opening.calendar,
              phase: 'match',
            };
          }
          if (state.careerStart === 'favourite-reserve' && state.clubId) {
            return {
              nationality: nationId,
              nationalTeam,
              ...beginSignedCareer(state.clubId, 'reserve', nationId, state.careerStart),
            };
          }
          if (state.careerStart === 'favourite-first-team' && state.clubId) {
            return {
              nationality: nationId,
              nationalTeam,
              ...beginSignedCareer(state.clubId, 'first-team', nationId, state.careerStart),
            };
          }
          if (state.clubId && !isFavouriteStart(state.careerStart)) {
            return { nationality: nationId, nationalTeam, phase: 'hub' };
          }
          const opening = createYouthCampaign(nationId);
          return {
            nationality: nationId,
            nationalTeam,
            careerStart: state.careerStart ?? 'youth',
            openingCampaign: opening,
            trial: null,
            liveMatch: liveFromOpening(opening),
            seasonCalendar: opening.calendar,
            phase: 'match',
          };
        }),

      advance: () =>
        set((state) => {
          if (state.openingCampaign && !state.seasonSim) {
            if (state.lastMatchResult) return { phase: 'match-result' };
            if (state.liveMatch) return { phase: 'match' };
            if (state.trial?.offeredClubIds.length) return { phase: 'club-offer' };
            if (
              state.openingCampaign.kind === 'youth-tournament' &&
              youthTournamentComplete(state.openingCampaign)
            ) {
              return { phase: 'opening-brief' };
            }
            const live = liveFromOpening(state.openingCampaign);
            if (live) {
              return { phase: 'match', liveMatch: live, seasonCalendar: state.openingCampaign.calendar };
            }
            return { phase: 'opening-brief' };
          }
          if (state.seasonCalendar && state.seasonSim) {
            const updates = openNextSimFixture(state);
            if (updates.phase === 'season-summary' && updates.seasonSim) {
              return { ...updates, seasonSim: finalizeSimHonours({ ...state, ...updates } as CareerState) };
            }
            return updates;
          }

          let season = state.currentSeason;
          let availability = state.availability;
          if (!season) return state;

          const reserveLength = reserveSeasonLength(state.clubId);
          while (season.matches.length < reserveLength && !isAvailable(availability)) {
            const record: MatchRecord = { matchNumber: season.matches.length + 1, played: false, scored: null };
            season = { ...season, matches: [...season.matches, record] };
            availability = serveBannedGame(availability);
          }

          if (season.matches.length >= reserveLength) {
            const awarded = attachSeasonAwards({ ...state, currentSeason: season, availability });
            return {
              currentSeason: awarded.season,
              availability,
              phase: 'season-summary',
              wpyResult: awarded.wpyResult,
            };
          }
          return { currentSeason: season, availability, phase: 'match' };
        }),

      recordMatchChance: (result) =>
        set((state) => {
          const live = state.liveMatch;
          if (!live) return state;
          const scored = result.outcome === 'goal';
          const penaltyChance = Boolean(result.penalty || result.penaltyCommit != null);
          return {
            liveMatch: {
              ...live,
              chancesTaken: live.chancesTaken + 1,
              goals: live.goals + (scored ? 1 : 0),
              openPlayGoals: (live.openPlayGoals ?? 0) + (scored && !penaltyChance ? 1 : 0),
            },
          };
        }),

      finishLiveMatch: () =>
        set((state) => {
          const live = state.liveMatch;
          if (!live) return state;
          if (state.openingCampaign) return finishOpeningMatch(state);
          const sim = state.seasonSim;
          const calendar = state.seasonCalendar;
          const season = state.currentSeason;
          if (!sim || !calendar || !season || !state.clubId) return state;
          const club = getClub(state.clubId);
          const fixture = calendar.fixtures[live.fixtureIndex];
          if (!club || !fixture) return state;

          const resolution = resolveFixture(sim, fixture, club, live.goals);
          const nextSim = { ...resolution.sim, fixtureIndex: live.fixtureIndex + 1 };
          const nextCalendar = syncInternationalCalendar(calendar, nextSim);
          const scored = live.goals > 0;
          const openPlayScored = (live.openPlayGoals ?? 0) > 0;
          const record: MatchRecord = { matchNumber: season.matches.length + 1, played: true, scored };
          const paid = withWeeklyPay(season, state.careerEarnings, state.weeklyWage);
          const updatedSeason: SeasonRecord = recordClubAppearanceStats(
            {
              ...paid.season,
              matches: [...paid.season.matches, record],
              goals: paid.season.goals + live.goals,
              gamesPlayed: paid.season.gamesPlayed + 1,
              leagueGoals: paid.season.leagueGoals + (fixture.kind === 'league' ? live.goals : 0),
            },
            fixture,
            live.goals,
            true,
          );

          const isInternational = fixture.kind === 'international';
          let availability = state.availability;
          let nationalTeam = state.nationalTeam;
          if (isInternational && nationalTeam) {
            nationalTeam = {
              ...recordInternationalAppearance(
                nationalTeam,
                sim.internationalTournament,
                fixture.internationalRound === 'qualifier',
                live.goals,
                isInternationalFinalsRound(fixture.internationalRound),
              ),
              availability: applyMatchResult(nationalTeam.availability, openPlayScored),
            };
          } else {
            availability = applyMatchResult(availability, openPlayScored);
          }

          const withIntlSeason: SeasonRecord = isInternational
            ? {
                ...updatedSeason,
                international: bumpInternationalSeason(
                  updatedSeason.international,
                  sim.internationalTournament,
                  fixture.internationalRound === 'qualifier',
                  live.goals,
                  isInternationalFinalsRound(fixture.internationalRound),
                ),
              }
            : updatedSeason;

          const counts = countsTowardCareerRecord(state.seasonNumber, state.role);
          const nextCareerGoals = counts ? state.careerGoals + live.goals : state.careerGoals;
          const nextCareerGames = counts ? state.careerGames + 1 : state.careerGames;
          const selectedSim = withInternationalForm(
            nextSim,
            withIntlSeason,
            state.clubId,
            state.nationality,
            nextCareerGoals,
            nextCareerGames,
          );
          const complete = nextSim.fixtureIndex >= nextCalendar.fixtures.length;
          const withHonours = complete
            ? { ...selectedSim, honours: { ...selectedSim.honours, leagueChampion: canWinLeague(selectedSim, state.clubId) } }
            : selectedSim;
          const remainingAfter = remainingPlayableCount(nextCalendar, withHonours);
          const injuryGamesRemaining = complete
            ? 0
            : (state.injuryGamesRemaining ?? 0) > 0
              ? state.injuryGamesRemaining
              : sitOutGamesAfterPlayedMatch(rollInjuryAbsence(remainingAfter));
          const merged = {
            ...state,
            seasonSim: withHonours,
            currentSeason: withIntlSeason,
            formWindow: counts ? pushForm(state.formWindow, live.goals) : state.formWindow,
          };
          const awarded = complete ? attachSeasonAwards(merged) : { season: withIntlSeason, wpyResult: state.wpyResult };
          const afterPhase = complete ? 'season-summary' : 'hub';
          const recap = recapFromResolution({
            headline: resolution.summary,
            result: resolution.result,
            aggregateLine: resolution.aggregateLine,
            calendar: nextCalendar,
            sim: withHonours,
            playerGoals: live.goals,
            chances: live.chancesTotal,
            nationName: state.nationality ? getNation(state.nationality)?.name : undefined,
            isFinal: isFinalFixture(fixture),
            trophyName: trophyNameForFixture(fixture, sim.internationalTournament),
            afterPhase,
          });

          return {
            seasonSim: withHonours,
            seasonCalendar: nextCalendar,
            currentSeason: awarded.season,
            availability,
            nationalTeam,
            liveMatch: null,
            seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
            lastMatchSummary: recap.lastMatchSummary,
            lastMatchResult: recap.lastMatchResult,
            formWindow: merged.formWindow,
            careerGoals: counts ? state.careerGoals + live.goals : state.careerGoals,
            careerGames: counts ? state.careerGames + 1 : state.careerGames,
            careerEarnings: paid.careerEarnings,
            injuryGamesRemaining,
            phase: recap.lastMatchResult.isFinal ? 'match-result' : afterPhase,
            wpyResult: awarded.wpyResult,
          };
        }),

      acknowledgeMatchResult: () =>
        set((state) => {
          const after = state.lastMatchResult?.afterPhase;
          if (after === 'match' && state.openingCampaign) {
            const live = liveFromOpening(state.openingCampaign);
            return {
              phase: live ? 'match' : 'opening-brief',
              liveMatch: live,
              lastMatchResult: null,
              seasonCalendar: state.openingCampaign.calendar,
            };
          }
          if (after === 'opening-brief') {
            return { phase: 'opening-brief', lastMatchResult: null };
          }
          if (after === 'club-offer') {
            return { phase: 'club-offer', lastMatchResult: null };
          }
          if (after === 'hub') {
            return { phase: 'hub' };
          }
          return {
            phase: after ?? (state.clubId ? 'hub' : 'menu'),
            lastMatchResult: null,
          };
        }),

      recordMatchShot: (result) =>
        set((state) => {
          if (state.seasonCalendar && state.liveMatch) {
            return state;
          }
          const season = state.currentSeason;
          if (!season) return state;
          const scored = result.outcome === 'goal';
          const record: MatchRecord = { matchNumber: season.matches.length + 1, played: true, scored };
          const matches = [...season.matches, record];
          const goals = season.goals + (scored ? 1 : 0);
          const gamesPlayed = season.gamesPlayed + 1;
          const availability = applyMatchResult(state.availability, scored);
          const paid = withWeeklyPay(season, state.careerEarnings, state.weeklyWage);
          const updatedSeason: SeasonRecord = {
            ...paid.season,
            matches,
            goals,
            gamesPlayed,
            leagueGoals: paid.season.leagueGoals + (scored ? 1 : 0),
          };
          const counts = countsTowardCareerRecord(state.seasonNumber, state.role);
          const seasonComplete = matches.length >= reserveSeasonLength(state.clubId);
          const awarded = seasonComplete
            ? attachSeasonAwards({ ...state, currentSeason: updatedSeason, availability })
            : { season: updatedSeason, wpyResult: state.wpyResult };
          return {
            currentSeason: awarded.season,
            availability,
            careerGoals: counts ? state.careerGoals + (scored ? 1 : 0) : state.careerGoals,
            careerGames: counts ? state.careerGames + 1 : state.careerGames,
            careerEarnings: paid.careerEarnings,
            formWindow: counts ? pushForm(state.formWindow, scored ? 1 : 0) : state.formWindow,
            phase: seasonComplete ? 'season-summary' : 'hub',
            wpyResult: awarded.wpyResult,
          };
        }),

      continueAfterSeason: () =>
        set((state) => {
          const season = state.currentSeason;
          if (!season || !state.clubId || !state.parentClubId) return state;

          const nextSeasonNumber = state.seasonNumber + 1;
          const nextAge = state.age + 1;

          const leaguePosition = state.seasonSim?.leagueTable.find((r) => r.clubId === state.clubId)?.position ?? null;
          const transition = resolveSeasonTransition({
            season,
            role: state.role,
            clubId: state.clubId,
            parentClubId: state.parentClubId,
            seasonsAtCurrentClub: state.seasonsAtCurrentClub,
            age: state.age,
            careerGoals: state.careerGoals,
            careerGames: state.careerGames,
            nationality: state.nationality,
            loansUsed: countLoanSpells(state.seasonHistory, season),
            seasonHistory: state.seasonHistory,
            contractYearsRemaining: state.contractYearsRemaining,
            leaguePosition,
            clubLeague: state.clubLeague,
            homeContractYearsRemaining: state.homeContractYearsRemaining,
            careerStart: state.careerStart,
            squadStatus: state.squadStatus,
          });

          const club = getClub(state.clubId);
          const parent = state.parentClubId ? getClub(state.parentClubId) : undefined;
          const threshold = club ? requiredGoalRatio(state.role, club, parent) : 0;
          const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
          const nextStatus = transition.immediate?.squadStatus
            ?? transition.pendingTransfer?.stay?.squadStatus
            ?? nextSquadStatusAfterSeason({
              role: state.role === 'reserve' ? 'first-team' : state.role,
              current: state.squadStatus ?? defaultSquadStatus(state.role),
              ratio,
              gamesPlayed: season.gamesPlayed,
              bar: threshold,
            });
          const finishedSeason: SeasonRecord = {
            ...season,
            ratioMet: ratio >= threshold,
            earnings: season.earnings ?? 0,
            squadStatus: state.squadStatus,
            nextSquadStatus: nextStatus,
          };
          const seasonHistory = patchPriorQualifyingOutcomes(
            [...state.seasonHistory, finishedSeason],
            finishedSeason.international?.tournament,
            finishedSeason.international?.qualifyingOutcome ?? 'none',
          );
          if (state.age >= RETIREMENT_AGE) {
            return {
              seasonHistory,
              currentSeason: finishedSeason,
              pendingTransfer: null,
              phase: 'career-end' as const,
            };
          }
          const qualIds = qualifierOpponentIdsFromCalendar(state.seasonCalendar);
          const nationalTeam = rememberQualifierOpponents(state.nationalTeam, qualIds);
          const intlQualifying = nextQualifyingCarry(state.seasonSim, qualIds);
          const europeanTitle = state.seasonSim?.honours.continentalChampion ?? null;
          const previousContinentalChampion =
            europeanTitle === 'ucl' || europeanTitle === 'uel' ? europeanTitle : null;
          const qualifiedContinentalCup = club
            ? continentalQualificationForNextSeason({
                club,
                league: state.clubLeague ?? club.league,
                position: leaguePosition,
                defendingContinental: europeanTitle,
              })
            : null;

          if (transition.immediate && !transition.pendingTransfer) {
            const { clubId, parentClubId, role, seasonsAtCurrentClub } = transition.immediate;
            const nextClub = getClub(clubId);
            const superCup = nextClub
              ? planSuperCup({
                  nextClub,
                  previousClubId: previousContinentalChampion ? state.clubId : null,
                  previousCup: previousContinentalChampion,
                  excludeOpponentId: state.lastSuperCupOpponentId,
                })
              : { include: false };
            const domesticSuperCup = nextDomesticSuperCup(
              nextClub,
              state.clubId,
              state.seasonSim,
              state.clubLeague ?? club?.league,
              role,
            );
            const dealYears = transition.immediate.contractYearsRemaining;
            const nextCup =
              clubId === state.clubId
                ? qualifiedContinentalCup
                : nextClub
                  ? clubContinentalCup(nextClub)
                  : null;
            return {
              seasonHistory,
              clubId,
              parentClubId,
              role,
              squadStatus: transition.immediate.squadStatus ?? nextStatus,
              lastTransferRejection: null,
              seasonsAtCurrentClub,
              weeklyWage: transition.immediate.weeklyWage ?? state.weeklyWage,
              contractYearsRemaining: dealYears,
              contractYears: dealYears,
              homeContractYearsRemaining: transition.immediate.role === 'loan' ? state.homeContractYearsRemaining : null,
              seasonNumber: nextSeasonNumber,
              age: nextAge,
              availability: createAvailability(),
              pendingTransfer: null,
              intlQualifying,
              previousContinentalChampion,
              previousChampionClubId: previousContinentalChampion ? state.clubId : null,
              lastSuperCupOpponentId: superCup.opponentId ?? state.lastSuperCupOpponentId,
              qualifiedContinentalCup: nextCup,
              nationalTeam,
              phase: 'hub',
              ...startSimulatedSeason(
                nextSeasonNumber,
                clubId,
                role,
                seasonHistory,
                state.nationality,
                nextAge,
                state.careerGoals,
                state.careerGames,
                intlQualifying,
                superCup,
                {
                  league: transition.immediate.clubLeague ?? state.clubLeague ?? nextClub?.league,
                  careerEarnings: state.careerEarnings,
                  contractYearsRemaining: dealYears,
                  continentalCup: nextCup,
                  excludeQualifierIds: qualifierExcludeIds(nationalTeam, intlQualifying?.opponentIds),
                  careerStart: state.careerStart,
                  domesticSuperCup,
                  squadStatus: transition.immediate.squadStatus ?? nextStatus,
                },
              ),
            };
          }

          return {
            seasonHistory,
            seasonNumber: nextSeasonNumber,
            age: nextAge,
            pendingTransfer: transition.pendingTransfer ?? null,
            intlQualifying,
            previousContinentalChampion,
            previousChampionClubId: previousContinentalChampion ? state.clubId : null,
            qualifiedContinentalCup,
            nationalTeam,
            phase: 'transfer-choice',
          };
        }),

      resolveTransferChoice: (clubId) =>
        set((state) => {
          const pending = state.pendingTransfer;
          if (!pending) return state;
          if (pending.kind === 'trial-offers') {
            if (!clubId) return state;
            return beginSignedCareer(clubId, 'reserve', state.nationality, state.careerStart);
          }
          if (!state.clubId || !state.parentClubId) return state;

          if (clubId === null) {
            const stay = pending.stay ?? {
              clubId: state.clubId,
              parentClubId: state.parentClubId,
              role: state.role,
              seasonsAtCurrentClub: state.seasonsAtCurrentClub + 1,
              contractYearsRemaining: Math.max(0, state.contractYearsRemaining - 1),
              clubLeague: state.clubLeague ?? undefined,
            };
            const stayStatus = stay.squadStatus
              ?? nextSquadStatusAfterSeason({
                role: stay.role === 'reserve' ? 'first-team' : stay.role,
                current: state.squadStatus ?? defaultSquadStatus(state.role),
                ratio: state.currentSeason && state.currentSeason.gamesPlayed > 0
                  ? state.currentSeason.goals / state.currentSeason.gamesPlayed
                  : 0,
                gamesPlayed: state.currentSeason?.gamesPlayed ?? 0,
                bar: (() => {
                  const stayClub = getClub(stay.clubId);
                  const stayParent = stay.parentClubId ? getClub(stay.parentClubId) : undefined;
                  return stayClub ? requiredGoalRatio(stay.role, stayClub, stayParent) : 0;
                })(),
              });
            const nextClub = getClub(stay.clubId);
            const superCup = nextClub
              ? planSuperCup({
                  nextClub,
                  previousClubId: state.previousChampionClubId,
                  previousCup: state.previousContinentalChampion,
                  excludeOpponentId: state.lastSuperCupOpponentId,
                })
              : { include: false };
            const domesticSuperCup = nextDomesticSuperCup(
              nextClub,
              state.clubId,
              state.seasonSim,
              stay.clubLeague ?? state.clubLeague ?? nextClub?.league,
              stay.role,
            );
            const stayCup = state.qualifiedContinentalCup ?? (nextClub ? clubContinentalCup(nextClub) : null);
            return {
              pendingTransfer: null,
              clubId: stay.clubId,
              parentClubId: stay.parentClubId,
              role: stay.role,
              squadStatus: stayStatus,
              lastTransferRejection: null,
              seasonsAtCurrentClub: stay.seasonsAtCurrentClub,
              weeklyWage: stay.weeklyWage ?? state.weeklyWage,
              contractYearsRemaining: stay.contractYearsRemaining,
              contractYears: stay.contractYearsRemaining,
              homeContractYearsRemaining: stay.role === 'loan' ? state.homeContractYearsRemaining : null,
              availability: createAvailability(),
              lastSuperCupOpponentId: superCup.opponentId ?? state.lastSuperCupOpponentId,
              phase: 'hub',
              ...startSimulatedSeason(
                state.seasonNumber,
                stay.clubId,
                stay.role,
                state.seasonHistory,
                state.nationality,
                state.age,
                state.careerGoals,
                state.careerGames,
                state.intlQualifying,
                superCup,
                {
                  league: stay.clubLeague ?? state.clubLeague ?? nextClub?.league,
                  careerEarnings: state.careerEarnings,
                  contractYearsRemaining: stay.contractYearsRemaining,
                  continentalCup: stayCup,
                  excludeQualifierIds: qualifierExcludeIds(state.nationalTeam, state.intlQualifying?.opponentIds),
                  careerStart: state.careerStart,
                  domesticSuperCup,
                  squadStatus: stayStatus,
                },
              ),
            };
          }

          const offer = pending.offers?.find((o) => o.clubId === clubId);
          if (offer && !offer.renewal && offer.clubId !== state.clubId) {
            const valueClub = getClub(state.clubId);
            const playerValue = valueClub
              ? playerMarketValueFromSeasons({
                  age: state.age,
                  careerGoals: state.careerGoals,
                  careerGames: state.careerGames,
                  seasons: [
                    ...state.seasonHistory,
                    ...(state.currentSeason ? [state.currentSeason] : []),
                  ],
                  fallbackClub: valueClub,
                  contractYearsRemaining: state.contractYearsRemaining,
                  seasonNumber: state.seasonNumber,
                  careerStart: state.careerStart,
                  role: state.role,
                })
              : 0;
            const veto = sellingClubAcceptsOffer({
              offer,
              kind: pending.kind,
              allowDecline: pending.allowDecline,
              currentClubId: state.clubId,
              role: state.role,
              squadStatus: state.squadStatus ?? defaultSquadStatus(state.role),
              contractYearsLeft: state.contractYearsRemaining,
              playerValue,
            });
            if (!veto.accepted) {
              const remaining = (pending.offers ?? []).filter((item) => item !== offer);
              return {
                lastTransferRejection: veto.detail,
                pendingTransfer: {
                  ...pending,
                  offers: remaining,
                  clubIds: remaining.map((item) => item.clubId),
                  rejectionDetail: veto.detail,
                },
              };
            }
          }
          const takeLoan = offer ? offer.move === 'loan' : pending.kind === 'loan';
          const renewing = Boolean(!takeLoan && clubId === state.clubId);
          let role: PlayerRole;
          let parentClubId: string;
          if (takeLoan) {
            role = 'loan';
            parentClubId = state.parentClubId;
          } else {
            role = 'first-team';
            parentClubId = clubId;
          }
          const nextClub = getClub(clubId);
          const superCup = nextClub
            ? planSuperCup({
                nextClub,
                previousClubId: state.previousChampionClubId,
                previousCup: state.previousContinentalChampion,
                excludeOpponentId: state.lastSuperCupOpponentId,
              })
            : { include: false };
          const domesticSuperCup = nextDomesticSuperCup(
            nextClub,
            state.clubId,
            state.seasonSim,
            state.clubLeague ?? nextClub?.league,
            role,
          );
          const dealYears = takeLoan
            ? (offer?.contractYears && offer.contractYears > 0
              ? offer.contractYears
              : loanContractYearsRemaining(state.seasonNumber, state.contractYearsRemaining, state.age))
            : (offer?.contractYears && offer.contractYears > 0
              ? offer.contractYears
              : newContractYears(state.age));
          const nextCup = renewing
            ? (state.qualifiedContinentalCup ?? (nextClub ? clubContinentalCup(nextClub) : null))
            : nextClub
              ? clubContinentalCup(nextClub)
              : null;
          const fromOpeningLoan = Boolean(state.openingCampaign) || !state.currentSeason;
          const nextSeasonNumber = takeLoan && fromOpeningLoan && state.seasonNumber < 2 ? 2 : state.seasonNumber;
          const nextAge = takeLoan && fromOpeningLoan && state.age <= STARTING_AGE ? STARTING_AGE + 1 : state.age;
          const loanWage =
            takeLoan && state.role === 'reserve'
              ? RESERVE_WEEKLY_WAGE
              : (offer?.weeklyWage ?? state.weeklyWage);
          const homeYears = takeLoan
            ? state.role === 'loan'
              ? state.homeContractYearsRemaining
              : state.role === 'first-team'
                ? Math.max(0, state.contractYearsRemaining - 1)
                : null
            : null;
          const nextIfStay = pending.stay?.squadStatus
            ?? nextSquadStatusAfterSeason({
              role: state.role === 'reserve' ? 'first-team' : state.role,
              current: state.squadStatus ?? defaultSquadStatus(state.role),
              ratio: state.currentSeason && state.currentSeason.gamesPlayed > 0
                ? state.currentSeason.goals / state.currentSeason.gamesPlayed
                : 0,
              gamesPlayed: state.currentSeason?.gamesPlayed ?? 0,
              bar: (() => {
                const cur = getClub(state.clubId);
                const parent = state.parentClubId ? getClub(state.parentClubId) : undefined;
                return cur ? requiredGoalRatio(state.role, cur, parent) : 0;
              })(),
            });
          const arrivalStatus: SquadStatus = takeLoan
            ? 'starter'
            : renewing
              ? nextIfStay
              : squadStatusOnArrival({
                  fromClub: getClub(state.clubId),
                  toClub: nextClub,
                  move: 'permanent',
                  nextIfStay,
                });

          return {
            pendingTransfer: null,
            openingCampaign: null,
            trial: null,
            clubId,
            parentClubId,
            role,
            squadStatus: arrivalStatus,
            lastTransferRejection: null,
            seasonsAtCurrentClub: renewing ? state.seasonsAtCurrentClub + 1 : 0,
            weeklyWage: takeLoan ? loanWage : (offer?.weeklyWage ?? state.weeklyWage),
            contractYears: dealYears,
            contractYearsRemaining: dealYears,
            homeContractYearsRemaining: homeYears,
            availability: createAvailability(),
            qualifiedContinentalCup: nextCup,
            lastSuperCupOpponentId: superCup.opponentId ?? state.lastSuperCupOpponentId,
            seasonNumber: nextSeasonNumber,
            age: nextAge,
            phase: 'hub',
            ...startSimulatedSeason(
              nextSeasonNumber,
              clubId,
              role,
              state.seasonHistory,
              state.nationality,
              nextAge,
              state.careerGoals,
              state.careerGames,
              state.intlQualifying,
              superCup,
              {
                league: nextClub?.league,
                careerEarnings: state.careerEarnings,
                contractYearsRemaining: dealYears,
                continentalCup: nextCup,
                excludeQualifierIds: qualifierExcludeIds(state.nationalTeam, state.intlQualifying?.opponentIds),
                careerStart: state.careerStart,
                domesticSuperCup,
                squadStatus: arrivalStatus,
              },
            ),
          };
        }),

      resetCareer: () => set(initialState()),

      openCareerRecord: () => set({ phase: 'career' }),

      returnToHub: () =>
        set((state) => ({
          phase: state.clubId ? 'hub' : 'menu',
        })),

      returnToMenu: () => set({ phase: 'menu' }),
    }),
    {
      name: 'wpy-career-v1',
      version: 30,
      migrate: (persisted) => {
        const state = persisted as Partial<CareerState>;
        const sim = state.seasonSim;
        const padSeason = (season: SeasonRecord, index: number, archived = false): SeasonRecord => ({
          ...season,
          age: season.age ?? (state.age ?? 16) - Math.max(0, (state.seasonHistory?.length ?? 0) - index),
          leagueGoals: season.leagueGoals ?? season.goals,
          leagueGames: season.leagueGames ?? season.domesticGames ?? season.gamesPlayed,
          cupGames: season.cupGames ?? 0,
          cupGoals: season.cupGoals ?? Math.max(0, (season.domesticGoals ?? 0) - (season.leagueGoals ?? season.goals)),
          domesticGames: season.domesticGames ?? season.gamesPlayed,
          domesticGoals: season.domesticGoals ?? season.leagueGoals ?? season.goals,
          continentalStats: season.continentalStats ?? [],
          trophies: season.trophies ?? [],
          topGoalscorer: season.topGoalscorer ?? false,
          playerOfTheYear: season.playerOfTheYear ?? false,
          wonWpy: season.wonWpy ?? false,
          clubPlayerOfTheTournament: season.clubPlayerOfTheTournament ?? false,
          clubPlayerOfTheTournamentReason: season.clubPlayerOfTheTournamentReason ?? null,
          sponsorship: season.sponsorship ?? 0,
          league: season.league,
          international: season.international
            ? {
                ...season.international,
                qualifyingOutcome:
                  archived && season.international.qualifyingOutcome === 'ongoing'
                    ? 'none'
                    : season.international.qualifyingOutcome,
              }
            : emptyInternationalSeason(null),
        });
        const seasonHistory = (state.seasonHistory ?? []).map((season, index) => padSeason(season, index, true));
        const currentSeason = state.currentSeason
          ? padSeason(state.currentSeason, state.seasonHistory?.length ?? 0)
          : null;
        const totals = recountCareerTotals(seasonHistory, currentSeason);
        return {
          ...state,
          openingCampaign: state.openingCampaign
            ? {
                ...state.openingCampaign,
                bestTrialRatio: state.openingCampaign.bestTrialRatio ?? 0,
                rejectedClubIds: state.openingCampaign.rejectedClubIds ?? [],
                openingTier: state.openingCampaign.openingTier ?? state.openingCampaign.trialTier ?? null,
                originCountry: state.openingCampaign.originCountry ?? null,
                originClubId: state.openingCampaign.originClubId ?? null,
              }
            : null,
          careerStart: state.careerStart ?? null,
          nationality: state.nationality ?? null,
          nationalTeam: state.nationalTeam
            ? {
                ...state.nationalTeam,
                byCompetition: state.nationalTeam.byCompetition ?? [],
                recentQualifierOpponentIds: state.nationalTeam.recentQualifierOpponentIds ?? [],
              }
            : null,
          seasonCalendar: state.seasonCalendar
            ? { ...state.seasonCalendar, fixtures: reassignLeagueHomeAway(state.seasonCalendar.fixtures) }
            : null,
          seasonStandings: state.seasonStandings ?? null,
          seasonHistory,
          currentSeason,
          careerGoals: totals.careerGoals,
          careerGames: totals.careerGames,
          intlQualifying: state.intlQualifying
            ? {
                ...state.intlQualifying,
                opponentIds: state.intlQualifying.opponentIds ?? [],
                group: state.intlQualifying.group,
              }
            : null,
          seasonSim: sim
            ? ensureInternationalGroup(
                {
                  ...sim,
                  domesticCup: sim.domesticCup ?? null,
                  domesticCupStage: sim.domesticCupStage ?? 'not-entered',
                  internationalPhase: sim.internationalPhase ?? 'none',
                  nationId: sim.nationId ?? state.nationality ?? null,
                  qualifierPoints: sim.qualifierPoints ?? 0,
                  qualifierPlayed: sim.qualifierPlayed ?? 0,
                  qualifierTarget: sim.qualifierTarget ?? 0,
                  qualifierCarryPoints: sim.qualifierCarryPoints ?? 0,
                  qualifierCarryPlayed: sim.qualifierCarryPlayed ?? 0,
                  groupPoints: sim.groupPoints ?? 0,
                  groupPlayed: sim.groupPlayed ?? 0,
                  nationQualified: sim.nationQualified ?? false,
                  honours: {
                    leagueChampion: sim.honours?.leagueChampion ?? false,
                    continentalChampion: sim.honours?.continentalChampion ?? null,
                    superCup: sim.honours?.superCup ?? false,
                    domesticSuperCup: sim.honours?.domesticSuperCup ?? null,
                    internationalChampion: sim.honours?.internationalChampion ?? null,
                    domesticCup: sim.honours?.domesticCup ?? null,
                  },
                  titleRivalId: sim.titleRivalId ?? null,
                  rivalHomeOutcome: sim.rivalHomeOutcome ?? null,
                  rivalAwayOutcome: sim.rivalAwayOutcome ?? null,
                  playoffStage: sim.playoffStage ?? null,
                  leaguesCupStage: sim.leaguesCupStage ?? 'not-entered',
                  leaguesCupGroupPlayed: sim.leaguesCupGroupPlayed ?? 0,
                  leaguesCupGroupPoints: sim.leaguesCupGroupPoints ?? 0,
                  superCupStage: sim.superCupStage ?? 'not-entered',
                  domesticSuperCupStage: sim.domesticSuperCupStage ?? 'not-entered',
                  internationalReached: sim.internationalReached ?? null,
                  internationalGroup: sim.internationalGroup ?? null,
                  friendlyPlayed: sim.friendlyPlayed ?? 0,
                  knockoutGamesScored: sim.knockoutGamesScored ?? 0,
                },
                state.seasonCalendar,
                state.seasonNumber ?? 1,
              )
            : null,
          liveMatch: state.liveMatch ?? null,
          formWindow: (state.seasonNumber ?? 1) < 2 ? [] : (state.formWindow ?? []),
          wpyResult: state.wpyResult ?? null,
          lastMatchSummary: state.lastMatchSummary ?? null,
          lastMatchResult: state.lastMatchResult ?? null,
          weeklyWage: state.weeklyWage ?? 0,
          careerEarnings: state.careerEarnings ?? 0,
          contractYears:
            (state.role === 'loan' && (state.seasonNumber ?? 1) <= 2)
              ? YOUTH_LOAN_YEARS
              : (state.seasonNumber ?? 1) === 1
                ? FIRST_CONTRACT_YEARS
                : (state.contractYears ?? DEFAULT_CONTRACT_YEARS),
          contractYearsRemaining:
            (state.role === 'loan' && (state.seasonNumber ?? 1) <= 2)
              ? YOUTH_LOAN_YEARS
              : (state.seasonNumber ?? 1) === 1
                ? FIRST_CONTRACT_YEARS
                : (state.contractYearsRemaining ?? DEFAULT_CONTRACT_YEARS),
          clubLeague: state.clubLeague ?? (state.clubId ? getClub(state.clubId)?.league ?? null : null),
          homeContractYearsRemaining: state.homeContractYearsRemaining ?? null,
          seasonSponsorship: state.seasonSponsorship ?? 0,
          injuryGamesRemaining: state.injuryGamesRemaining ?? 0,
          previousContinentalChampion: state.previousContinentalChampion ?? null,
          previousChampionClubId: state.previousChampionClubId ?? null,
          qualifiedContinentalCup: state.qualifiedContinentalCup ?? null,
          lastSuperCupOpponentId: state.lastSuperCupOpponentId ?? null,
          squadStatus: state.squadStatus ?? defaultSquadStatus(state.role ?? 'reserve'),
          lastTransferRejection: state.lastTransferRejection ?? null,
          pendingTransfer: state.pendingTransfer
            ? {
                ...state.pendingTransfer,
                offers: (state.pendingTransfer.offers ??
                  (state.pendingTransfer.clubIds ?? []).map((clubId) => ({
                    clubId,
                    move: state.pendingTransfer?.kind === 'loan' ? 'loan' : 'permanent',
                    fee: 0,
                    weeklyWage: 0,
                    contractYears: 0,
                  }))).map((offer) => ({
                    ...offer,
                    contractYears:
                      offer.contractYears ??
                      (offer.move === 'loan' ? 1 : DEFAULT_CONTRACT_YEARS),
                  })),
              }
            : null,
        };
      },
    },
  ),
);

export const TRIAL_TOTAL_SHOTS = TRIAL_SHOTS;
