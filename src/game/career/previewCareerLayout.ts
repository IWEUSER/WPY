import { createAvailability } from './availabilityEngine';
import { getClub } from './data/clubs';
import { createNationalTeamState, recordInternationalAppearance } from './international';
import { buildSeasonStandings } from './matchEngine';
import { playerMarketValueFromSeasons, weeklyWageForClub } from './playerValue';
import { hydrateSeason } from './seasonSim';
import { useCareerStore } from './store';
import type { PendingTransfer } from './transfers';
import type { SeasonRecord } from './types';

function season(partial: SeasonRecord): SeasonRecord {
  return partial;
}

/** DEV-only layout preview: three finished seasons plus a live hub season. */
export function applyCareerLayoutPreview(): void {
  const history: SeasonRecord[] = [
    season({
      seasonNumber: 1,
      clubId: 'real-madrid',
      role: 'reserve',
      matches: [],
      goals: 20,
      gamesPlayed: 24,
      ratioMet: true,
      age: 16,
      leagueGoals: 20,
      domesticGames: 24,
      domesticGoals: 20,
      continentalStats: [],
      trophies: [],
      topGoalscorer: true,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 0,
    }),
    season({
      seasonNumber: 2,
      clubId: 'real-madrid',
      role: 'first-team',
      matches: [],
      goals: 30,
      gamesPlayed: 38,
      ratioMet: true,
      age: 17,
      leagueGoals: 24,
      domesticGames: 42,
      domesticGoals: 26,
      continentalStats: [{ cup: 'ucl', games: 13, goals: 4 }],
      trophies: ['La Liga', 'Copa del Rey', 'Champions League'],
      topGoalscorer: true,
      playerOfTheYear: true,
      wonWpy: true,
      wpyReason: 'Elite goal ratio plus winning the Champions League.',
      earnings: 7_280_000,
      sponsorship: 8_800_000,
      league: 'La Liga',
    }),
    season({
      seasonNumber: 3,
      clubId: 'real-madrid',
      role: 'first-team',
      matches: [],
      goals: 26,
      gamesPlayed: 36,
      ratioMet: true,
      age: 18,
      leagueGoals: 20,
      domesticGames: 40,
      domesticGoals: 22,
      continentalStats: [{ cup: 'super-cup', games: 1, goals: 1 }, { cup: 'ucl', games: 10, goals: 3 }],
      trophies: ['La Liga', 'Super Cup'],
      topGoalscorer: true,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 7_280_000,
      sponsorship: 8_400_000,
      league: 'La Liga',
    }),
    season({
      seasonNumber: 6,
      clubId: 'leicester',
      role: 'first-team',
      matches: [],
      goals: 22,
      gamesPlayed: 46,
      ratioMet: true,
      age: 21,
      leagueGoals: 20,
      domesticGames: 48,
      domesticGoals: 21,
      continentalStats: [],
      trophies: ['Championship'],
      topGoalscorer: true,
      playerOfTheYear: true,
      wonWpy: false,
      earnings: 1_200_000,
      sponsorship: 0,
      league: 'Championship',
    }),
    season({
      seasonNumber: 7,
      clubId: 'leicester',
      role: 'first-team',
      matches: [],
      goals: 16,
      gamesPlayed: 38,
      ratioMet: true,
      age: 22,
      leagueGoals: 14,
      domesticGames: 40,
      domesticGoals: 15,
      continentalStats: [],
      trophies: [],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 2_400_000,
      sponsorship: 0,
      league: 'Premier League',
    }),
    season({
      seasonNumber: 12,
      clubId: 'inter-miami',
      role: 'first-team',
      matches: [],
      goals: 18,
      gamesPlayed: 34,
      ratioMet: true,
      age: 27,
      leagueGoals: 16,
      domesticGames: 36,
      domesticGoals: 17,
      continentalStats: [],
      trophies: ['MLS Cup'],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 4_200_000,
      sponsorship: 1_600_000,
      league: 'MLS',
    }),
    season({
      seasonNumber: 21,
      clubId: 'inter-miami',
      role: 'first-team',
      matches: [],
      goals: 9,
      gamesPlayed: 28,
      ratioMet: true,
      age: 36,
      leagueGoals: 8,
      domesticGames: 30,
      domesticGoals: 8,
      continentalStats: [],
      trophies: [],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 2_100_000,
      sponsorship: 280_000,
      league: 'MLS',
    }),
  ];

  const preview = new URLSearchParams(window.location.search).get('preview-career');
  const previewClubId = preview === 'mls' ? 'lafc' : preview === 'saudi' ? 'al-hilal' : 'real-madrid';
  const club = getClub(previewClubId);
  if (!club) return;
  const { calendar, sim } = hydrateSeason({
    seasonNumber: 4,
    club,
    careerGoalRatio: 0.78,
    nationId: preview === 'mls' ? 'united-states' : preview === 'saudi' ? 'saudi-arabia' : 'spain',
    qualifierCarry:
      preview === 'mls'
        ? { tournament: 'gold-cup', points: 7, played: 3 }
        : preview === 'saudi'
          ? { tournament: 'asian-cup', points: 7, played: 3 }
          : { tournament: 'euro', points: 7, played: 3 },
  });

  const value = playerMarketValueFromSeasons({
    age: 19,
    careerGoals: 61,
    careerGames: 114,
    seasons: [
      ...history,
      season({
        seasonNumber: 4,
        clubId: 'real-madrid',
        role: 'first-team',
        matches: [],
        goals: 3,
        gamesPlayed: 38,
        ratioMet: false,
        age: 19,
        leagueGoals: 3,
        domesticGames: 30,
        domesticGoals: 3,
        continentalStats: [{ cup: 'ucl', games: 8, goals: 0 }],
        trophies: [],
        topGoalscorer: false,
        playerOfTheYear: false,
        wonWpy: false,
      }),
    ],
    fallbackClub: club,
  });
  const pendingTransfer: PendingTransfer | null =
    preview === 'transfer'
      ? {
          kind: 'loan-or-transfer',
          detail: 'Loan offers let you return next season. Permanent offers follow your market value, not just this season.',
          clubIds: ['dortmund', 'real-sociedad', 'sevilla', 'barcelona', 'bayern', 'atletico-madrid'],
          offers: [
            { clubId: 'dortmund', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('dortmund')!, value) },
            { clubId: 'real-sociedad', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('real-sociedad')!, value) },
            { clubId: 'sevilla', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('sevilla')!, value) },
            { clubId: 'barcelona', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('barcelona')!, value) },
            { clubId: 'bayern', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('bayern')!, value) },
            { clubId: 'atletico-madrid', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('atletico-madrid')!, value) },
          ],
          allowDecline: false,
        }
      : null;

  const promoteSummary = preview === 'summary';
  const leicester = getClub('leicester');
  const leicesterTable = leicester
    ? [{
        clubId: 'leicester',
        played: 46,
        won: 30,
        drawn: 8,
        lost: 8,
        goalsFor: 88,
        goalsAgainst: 36,
        points: 98,
        position: 1,
      }]
    : sim.leagueTable;

  let nationalTeam = createNationalTeamState('spain');
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', true, 1);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', true, 0);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', false, 2);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'euro', true, 1);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'euro', false, 0);

  useCareerStore.setState({
    phase:
      preview === 'record'
        ? 'career'
        : preview === 'transfer'
          ? 'transfer-choice'
          : preview === 'result'
            ? 'match-result'
            : preview === 'end'
              ? 'career-end'
              : preview === 'summary'
                ? 'season-summary'
                : 'hub',
    age: preview === 'end' ? 36 : promoteSummary ? 22 : 19,
    seasonNumber: preview === 'end' ? 21 : promoteSummary ? 6 : 4,
    clubId: preview === 'end' ? 'inter-miami' : preview === 'mls' ? 'lafc' : preview === 'saudi' ? 'al-hilal' : promoteSummary ? 'leicester' : 'real-madrid',
    parentClubId: preview === 'end' ? 'inter-miami' : preview === 'mls' ? 'lafc' : preview === 'saudi' ? 'al-hilal' : promoteSummary ? 'leicester' : 'real-madrid',
    role: 'first-team',
    seasonsAtCurrentClub: preview === 'end' ? 10 : promoteSummary ? 1 : 3,
    nationality: preview === 'mls' ? 'united-states' : preview === 'saudi' ? 'saudi-arabia' : 'spain',
    nationalTeam,
    availability: createAvailability(),
    seasonHistory: history,
    careerGoals: preview === 'end' ? 312 : 58,
    careerGames: preview === 'end' ? 540 : 76,
    seasonCalendar: calendar,
    seasonSim: promoteSummary
      ? { ...sim, leagueTable: leicesterTable, honours: { ...sim.honours, leagueChampion: true } }
      : sim,
    seasonStandings: buildSeasonStandings(promoteSummary ? leicesterTable : sim.leagueTable, promoteSummary ? null : sim.europeanStanding),
    currentSeason:
      preview === 'end'
        ? history[history.length - 1]
        : promoteSummary
          ? season({
              seasonNumber: 6,
              clubId: 'leicester',
              role: 'first-team',
              matches: [],
              goals: 22,
              gamesPlayed: 46,
              ratioMet: true,
              age: 22,
              leagueGoals: 20,
              domesticGames: 48,
              domesticGoals: 21,
              continentalStats: [],
              trophies: ['Championship'],
              topGoalscorer: true,
              playerOfTheYear: true,
              wonWpy: false,
              earnings: 1_200_000,
              sponsorship: 0,
              league: 'Championship',
            })
        : season({
            seasonNumber: 4,
            clubId: preview === 'mls' ? 'lafc' : preview === 'saudi' ? 'al-hilal' : 'real-madrid',
            role: 'first-team',
            matches: [
              { matchNumber: 1, played: true, scored: true },
              { matchNumber: 2, played: true, scored: false },
            ],
            goals: 2,
            gamesPlayed: 2,
            ratioMet: null,
            age: 19,
            leagueGoals: 1,
            domesticGames: 2,
            domesticGoals: 2,
            continentalStats: [],
            trophies: [],
            topGoalscorer: false,
            playerOfTheYear: false,
            wonWpy: false,
            sponsorship: 9_300_000,
            earnings: 9_580_000,
            league: preview === 'mls' ? 'MLS' : preview === 'saudi' ? 'Saudi Pro League' : 'La Liga',
          }),
    lastMatchSummary: 'Spain won 1–0 vs Italy · 1 goal from 1 chance',
    lastMatchResult: {
      summary: 'Spain won 1–0 vs Italy · 1 goal from 1 chance',
      isFinal: true,
      won: true,
      trophyName: 'European Championship',
      afterPhase: 'season-summary',
    },
    weeklyWage: preview === 'end' ? 40_000 : promoteSummary && leicester ? weeklyWageForClub(leicester, value, 'Championship') : 140_000,
    careerEarnings: preview === 'end' ? 86_400_000 : 14_560_000,
    contractYears: preview === 'end' ? 1 : promoteSummary ? 2 : 5,
    contractYearsRemaining: preview === 'end' ? 1 : promoteSummary ? 2 : 5,
    clubLeague: preview === 'end' || preview === 'mls' ? 'MLS' : preview === 'saudi' ? 'Saudi Pro League' : promoteSummary ? 'Championship' : 'La Liga',
    seasonSponsorship: preview === 'end' ? 280_000 : 9_300_000,
    injuryGamesRemaining: 0,
    intlQualifying: { tournament: 'euro', points: 7, played: 3 },
    pendingTransfer,
  });
}
