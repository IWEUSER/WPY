import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { applyMatchResult, createAvailability, isAvailable, serveBannedGame } from './availabilityEngine';
import { rollInjuryAbsence } from './injury';
import { recordClubAppearanceStats } from './seasonStats';
import { FORM_WINDOW_GAMES, RETIREMENT_AGE, SEASON_LENGTH, STARTING_AGE } from './constants';
import { planSuperCup } from './continentalDraw';
import { getClub, leagueMatchWeeks } from './data/clubs';
import { clubContinentalCup, internationalCalendarSeason, isInternationalFinalsSeason, type ContinentalCupId } from './data/competitions';
import { continentalQualificationForNextSeason } from './europeanQualification';
import {
  DEFAULT_CONTRACT_YEARS,
  FIRST_CONTRACT_YEARS,
  loanContractYearsRemaining,
  newContractYears,
  nextContractYearsRemaining,
  playerMarketValue,
  playerMarketValueFromSeasons,
  RESERVE_CONTRACT_YEARS,
  RESERVE_WEEKLY_WAGE,
  seasonalSponsorship,
  weeklyWageForClub,
  YOUTH_LOAN_YEARS,
} from './playerValue';
import { evaluatePlayerOfTheYear, evaluateTopGoalscorer } from './domesticAwards';
import { evaluateInternationalTournamentAwards } from './internationalAwards';
import { countsTowardCareerRecord } from './seasonDisplay';
import { trophyLabels } from './honoursDisplay';
import {
  bumpInternationalSeason,
  createNationalTeamState,
  emptyInternationalSeason,
  isSelectedForNationalTeam,
  qualifierExcludeIds,
  recordInternationalAppearance,
  rememberQualifierOpponents,
  seasonRatioForSelection,
  snapshotInternationalOutcomes,
} from './international';
import { buildSeasonStandings } from './matchEngine';
import { isFinalFixture } from './calendar';
import {
  canWinLeague,
  hydrateSeason,
  remainingPlayableCount,
  reassignLeagueHomeAway,
  resolveFixture,
  shouldSkipFixture,
  trophyNameForFixture,
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
  openingMatchSummary,
  rejectAndDropTrial,
  resolveOpeningMatch,
  youthTournamentComplete,
  youthTrophyName,
} from './openingFlow';
import { getNation } from './international';
import { countLoanSpells, forcedLoanPending, requiredGoalRatio, resolveSeasonTransition } from './transfers';
import { evaluateWpy } from './wpy';
import type { ShotResult } from '../shooting/types';
import type { CareerStart, CareerState, MatchRecord, PlayerRole, SeasonRecord } from './types';

export { SEASON_LENGTH } from './constants';

function freshSeason(seasonNumber: number, clubId: string, role: CareerState['role'], age: number): SeasonRecord {
  return {
    seasonNumber,
    clubId,
    role,
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
): SeasonSimState {
  if (!clubId) return sim;
  const club = getClub(clubId);
  if (!club) return sim;
  const selected = isSelectedForNationalTeam({
    clubTier: club.tier,
    careerGoalRatio: seasonRatioForSelection(season),
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
  let season = freshSeason(seasonNumber, clubId, role, age);
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
    careerGoalRatio: seasonRatioForSelection(season),
    nationId,
    qualifierCarry,
    includeSuperCup: leagueOnly ? false : superCup?.include,
    superCupOpponentId: leagueOnly ? undefined : superCup?.opponentId,
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

function finalizeSimHonours(state: CareerState): CareerState['seasonSim'] {
  const sim = state.seasonSim;
  if (!sim || !state.clubId) return sim;
  return { ...sim, honours: { ...sim.honours, leagueChampion: canWinLeague(sim, state.clubId) } };
}

function evaluateSeasonWpy(state: CareerState) {
  const club = state.clubId ? getClub(state.clubId) : undefined;
  const season = state.currentSeason;
  const sim = state.seasonSim;
  if (!club || !season || !sim || state.seasonNumber < 2) return null;
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
  if (state.seasonNumber < 2 || state.role === 'reserve') {
    return {
      season: {
        ...season,
        age: state.age,
        trophies: [],
        topGoalscorer: false,
        playerOfTheYear: false,
        wonWpy: false,
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
      })
    : { playerOfTheTournament: false, topGoalscorer: false, chance: 0 };
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
    if (done) {
      const assigned = assignOpeningTrialClub(next, nationId);
      return {
        openingCampaign: assigned,
        seasonCalendar: assigned.calendar,
        liveMatch: null,
        lastMatchSummary: summary,
        lastMatchResult: {
          summary,
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
      lastMatchSummary: summary,
      lastMatchResult: {
        summary,
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
  if (state.careerStart === 'favourite-trial' && club) {
    const pending = forcedLoanPending({
      clubId: club.id,
      nationality: nationId,
      age: STARTING_AGE,
      seasonNumber: 2,
      ratio: next.gamesPlayed > 0 ? next.goals / next.gamesPlayed : 0,
    });
    return {
      openingCampaign: next,
      clubId: club.id,
      parentClubId: club.id,
      role: 'reserve',
      seasonNumber: 1,
      age: STARTING_AGE,
      seasonsAtCurrentClub: 0,
      weeklyWage: RESERVE_WEEKLY_WAGE,
      contractYears: FIRST_CONTRACT_YEARS,
      contractYearsRemaining: FIRST_CONTRACT_YEARS,
      pendingTransfer: pending,
      trial: { shots: [], goals: next.goals, offeredClubIds: [club.id] },
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
  const dropped = rejectAndDropTrial(next, state.nationality);
  return {
    openingCampaign: dropped,
    seasonCalendar: dropped.calendar,
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
  };
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
  const calendar = state.seasonCalendar;
  let season = state.currentSeason;
  let availability = state.availability;
  let nationalTeam = state.nationalTeam;
  let careerGames = state.careerGames;
  let careerEarnings = state.careerEarnings;
  let formWindow = state.formWindow;
  let lastMatchSummary = state.lastMatchSummary;
  let injuryGamesRemaining = state.injuryGamesRemaining ?? 0;
  if (!sim || !calendar || !season || !state.clubId) return {};
  const club = getClub(state.clubId);
  if (!club) return {};

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
      careerEarnings = injuredPay.careerEarnings;
      lastMatchSummary = `${resolution.summary} · you were injured`;
      injuryGamesRemaining -= 1;
      if (isFinalFixture(fixture)) {
        const complete = sim.fixtureIndex >= calendar.fixtures.length;
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
          currentSeason: awarded.season,
          availability,
          nationalTeam,
          careerGames,
          careerEarnings,
          formWindow,
          lastMatchSummary,
          injuryGamesRemaining,
          seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
          liveMatch: null,
          lastMatchResult: {
            summary: lastMatchSummary,
            isFinal: true,
            won: resolution.result.outcome === 'win',
            trophyName: trophyNameForFixture(fixture, withHonours.internationalTournament),
            afterPhase: complete ? 'season-summary' : 'hub',
          },
          phase: 'match-result',
          wpyResult: awarded.wpyResult,
        };
      }
      continue;
    }
    if (squad && !isAvailable(squad)) {
      const resolution = resolveFixture(sim, fixture, club, 0);
      sim = { ...resolution.sim, fixtureIndex: sim.fixtureIndex + 1 };
      const record: MatchRecord = { matchNumber: season.matches.length + 1, played: false, scored: null };
      const droppedPay = withWeeklyPay(season, careerEarnings, state.weeklyWage);
      season = { ...droppedPay.season, matches: [...droppedPay.season.matches, record] };
      careerEarnings = droppedPay.careerEarnings;
      lastMatchSummary = `${resolution.summary} · you were dropped`;
      if (isInternational && nationalTeam) {
        nationalTeam = { ...nationalTeam, availability: serveBannedGame(nationalTeam.availability) };
      } else {
        availability = serveBannedGame(availability);
      }
      continue;
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
      lastMatchSummary = `${resolution.summary} · no chance this match`;
      if (isInternational && nationalTeam) {
        nationalTeam = recordInternationalAppearance(
          nationalTeam,
          sim.internationalTournament,
          fixture.internationalRound === 'qualifier',
          0,
        );
        season = {
          ...season,
          international: bumpInternationalSeason(
            season.international,
            sim.internationalTournament,
            fixture.internationalRound === 'qualifier',
            0,
          ),
        };
      }
      continue;
    }

    const liveMatch: LiveMatch = { fixtureIndex: sim.fixtureIndex, chancesTotal: chances, chancesTaken: 0, goals: 0 };
    return {
      seasonSim: withInternationalForm(sim, season, state.clubId, state.nationality),
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
          if (state.pendingTransfer && state.careerStart === 'favourite-trial') {
            return {
              openingCampaign: null,
              trial: null,
              seasonNumber: 2,
              age: STARTING_AGE + 1,
              weeklyWage: RESERVE_WEEKLY_WAGE,
              contractYears: FIRST_CONTRACT_YEARS,
              contractYearsRemaining: 1,
              role: 'reserve' as const,
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
          return {
            liveMatch: {
              ...live,
              chancesTaken: live.chancesTaken + 1,
              goals: live.goals + (scored ? 1 : 0),
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
          const scored = live.goals > 0;
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
              ),
              availability: applyMatchResult(nationalTeam.availability, scored),
            };
          } else {
            availability = applyMatchResult(availability, scored);
          }

          const withIntlSeason: SeasonRecord = isInternational
            ? {
                ...updatedSeason,
                international: bumpInternationalSeason(
                  updatedSeason.international,
                  sim.internationalTournament,
                  fixture.internationalRound === 'qualifier',
                  live.goals,
                ),
              }
            : updatedSeason;

          const selectedSim = withInternationalForm(nextSim, withIntlSeason, state.clubId, state.nationality);
          const complete = nextSim.fixtureIndex >= calendar.fixtures.length;
          const withHonours = complete
            ? { ...selectedSim, honours: { ...selectedSim.honours, leagueChampion: canWinLeague(selectedSim, state.clubId) } }
            : selectedSim;
          const remainingAfter = remainingPlayableCount(
            { ...calendar, fixtures: calendar.fixtures },
            withHonours,
          );
          const injuryGamesRemaining = complete
            ? 0
            : (state.injuryGamesRemaining ?? 0) > 0
              ? state.injuryGamesRemaining
              : rollInjuryAbsence(remainingAfter);
          const counts = countsTowardCareerRecord(state.seasonNumber, state.role);
          const merged = {
            ...state,
            seasonSim: withHonours,
            currentSeason: withIntlSeason,
            formWindow: counts ? pushForm(state.formWindow, live.goals) : state.formWindow,
          };
          const awarded = complete ? attachSeasonAwards(merged) : { season: withIntlSeason, wpyResult: state.wpyResult };
          const summary = `${resolution.summary} · ${live.goals} goal${live.goals === 1 ? '' : 's'} from ${live.chancesTotal} chance${live.chancesTotal === 1 ? '' : 's'}`;
          const afterPhase = complete ? 'season-summary' : 'hub';
          const lastMatchResult = {
            summary,
            isFinal: isFinalFixture(fixture),
            won: resolution.result.outcome === 'win',
            trophyName: trophyNameForFixture(fixture, sim.internationalTournament),
            afterPhase: afterPhase as 'hub' | 'season-summary',
          };

          return {
            seasonSim: withHonours,
            currentSeason: awarded.season,
            availability,
            nationalTeam,
            liveMatch: null,
            seasonStandings: buildSeasonStandings(withHonours.leagueTable, withHonours.europeanStanding),
            lastMatchSummary: summary,
            lastMatchResult,
            formWindow: merged.formWindow,
            careerGoals: counts ? state.careerGoals + live.goals : state.careerGoals,
            careerGames: counts ? state.careerGames + 1 : state.careerGames,
            careerEarnings: paid.careerEarnings,
            injuryGamesRemaining,
            phase: lastMatchResult.isFinal ? 'match-result' : afterPhase,
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
          });

          const club = getClub(state.clubId);
          const parent = state.parentClubId ? getClub(state.parentClubId) : undefined;
          const threshold = club ? requiredGoalRatio(state.role, club, parent) : 0;
          const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
          const finishedSeason: SeasonRecord = {
            ...season,
            ratioMet: ratio >= threshold,
            earnings: season.earnings ?? 0,
          };
          const seasonHistory = [...state.seasonHistory, finishedSeason];
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
                })
              : { include: false };
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
          if (!pending || !state.clubId || !state.parentClubId) return state;

          if (clubId === null) {
            const stay = pending.stay ?? {
              clubId: state.clubId,
              parentClubId: state.parentClubId,
              role: state.role,
              seasonsAtCurrentClub: state.seasonsAtCurrentClub + 1,
              contractYearsRemaining: nextContractYearsRemaining(state.contractYearsRemaining, state.age),
              clubLeague: state.clubLeague ?? undefined,
            };
            const nextClub = getClub(stay.clubId);
            const superCup = nextClub
              ? planSuperCup({
                  nextClub,
                  previousClubId: state.previousChampionClubId,
                  previousCup: state.previousContinentalChampion,
                })
              : { include: false };
            const stayCup = state.qualifiedContinentalCup ?? (nextClub ? clubContinentalCup(nextClub) : null);
            return {
              pendingTransfer: null,
              clubId: stay.clubId,
              parentClubId: stay.parentClubId,
              role: stay.role,
              seasonsAtCurrentClub: stay.seasonsAtCurrentClub,
              weeklyWage: stay.weeklyWage ?? state.weeklyWage,
              contractYearsRemaining: stay.contractYearsRemaining,
              contractYears: stay.contractYearsRemaining,
              homeContractYearsRemaining: stay.role === 'loan' ? state.homeContractYearsRemaining : null,
              availability: createAvailability(),
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
                },
              ),
            };
          }

          const offer = pending.offers?.find((o) => o.clubId === clubId);
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
              })
            : { include: false };
          const dealYears = takeLoan
            ? (offer?.contractYears ??
              loanContractYearsRemaining(state.seasonNumber, state.contractYearsRemaining, state.age))
            : (offer?.contractYears ?? newContractYears(state.age));
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

          return {
            pendingTransfer: null,
            openingCampaign: null,
            trial: null,
            clubId,
            parentClubId,
            role,
            seasonsAtCurrentClub: renewing ? state.seasonsAtCurrentClub + 1 : 0,
            weeklyWage: takeLoan ? loanWage : (offer?.weeklyWage ?? state.weeklyWage),
            contractYears: dealYears,
            contractYearsRemaining: dealYears,
            homeContractYearsRemaining: homeYears,
            availability: createAvailability(),
            qualifiedContinentalCup: nextCup,
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
      version: 23,
      migrate: (persisted) => {
        const state = persisted as Partial<CareerState>;
        const sim = state.seasonSim;
        const padSeason = (season: SeasonRecord, index: number): SeasonRecord => ({
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
          sponsorship: season.sponsorship ?? 0,
          league: season.league,
          international: season.international ?? emptyInternationalSeason(null),
        });
        const seasonHistory = (state.seasonHistory ?? []).map(padSeason);
        const currentSeason = state.currentSeason
          ? padSeason(state.currentSeason, state.seasonHistory?.length ?? 0)
          : null;
        const totals = recountCareerTotals(seasonHistory, currentSeason);
        return {
          ...state,
          openingCampaign: state.openingCampaign ?? null,
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
              }
            : null,
          seasonSim: sim
            ? {
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
                internationalReached: sim.internationalReached ?? null,
              }
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
