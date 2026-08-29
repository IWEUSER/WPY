import { createAvailability } from './availabilityEngine';
import { getClub } from './data/clubs';
import { createNationalTeamState, recordInternationalAppearance } from './international';
import { buildSeasonStandings } from './matchEngine';
import { playerMarketValue, weeklyWageForClub } from './playerValue';
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
      trophies: [],
      topGoalscorer: true,
      playerOfTheYear: false,
      wonWpy: false,
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
      trophies: ['La Liga', 'Copa del Rey', 'Champions League'],
      topGoalscorer: true,
      playerOfTheYear: true,
      wonWpy: true,
      wpyReason: 'Elite goal ratio plus winning the Champions League.',
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
      trophies: ['Super Cup'],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
    }),
  ];

  const club = getClub('real-madrid');
  if (!club) return;
  const { calendar, sim } = hydrateSeason({
    seasonNumber: 4,
    club,
    careerGoalRatio: 0.78,
    nationId: 'spain',
    qualifierCarry: { tournament: 'euro', points: 7, played: 3 },
  });

  const preview = new URLSearchParams(window.location.search).get('preview-career');
  const value = playerMarketValue({ age: 19, ratio: 58 / 76, careerGoals: 58, club });
  const pendingTransfer: PendingTransfer | null =
    preview === 'transfer'
      ? {
          kind: 'loan-or-transfer',
          detail: 'Three loan offers and three transfer offers. After two loan spells you must move permanently.',
          clubIds: ['mainz', 'leicester', 'almeria', 'barcelona', 'bayern', 'al-hilal'],
          offers: [
            { clubId: 'mainz', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('mainz')!, value) },
            { clubId: 'leicester', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('leicester')!, value) },
            { clubId: 'almeria', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('almeria')!, value) },
            { clubId: 'barcelona', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('barcelona')!, value) },
            { clubId: 'bayern', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('bayern')!, value) },
            { clubId: 'al-hilal', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('al-hilal')!, value) },
          ],
          allowDecline: false,
        }
      : null;

  let nationalTeam = createNationalTeamState('spain');
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', true, 1);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', true, 0);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', false, 2);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'euro', true, 1);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'euro', false, 0);

  useCareerStore.setState({
    phase: preview === 'record' ? 'career' : preview === 'transfer' ? 'transfer-choice' : 'hub',
    age: 19,
    seasonNumber: 4,
    clubId: 'real-madrid',
    parentClubId: 'real-madrid',
    role: 'first-team',
    seasonsAtCurrentClub: 3,
    nationality: 'spain',
    nationalTeam,
    availability: createAvailability(),
    seasonHistory: history,
    careerGoals: 58,
    careerGames: 76,
    seasonCalendar: calendar,
    seasonSim: sim,
    seasonStandings: buildSeasonStandings(sim.leagueTable, sim.europeanStanding),
    currentSeason: season({
      seasonNumber: 4,
      clubId: 'real-madrid',
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
      trophies: [],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
    }),
    lastMatchSummary: 'Won 2–1 vs Barcelona · 1 goal from 3 chances',
    intlQualifying: { tournament: 'euro', points: 7, played: 3 },
    pendingTransfer,
  });
}
