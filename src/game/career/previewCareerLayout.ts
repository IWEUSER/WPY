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
      trophies: ['La Liga', 'Copa del Rey', 'Champions League'],
      topGoalscorer: true,
      playerOfTheYear: true,
      wonWpy: true,
      wpyReason: 'Elite goal ratio plus winning the Champions League.',
      earnings: 7_280_000,
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
      earnings: 7_280_000,
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
          kind: 'end-of-season',
          detail: 'These clubs have made an offer. You can stay where you are.',
          clubIds: ['barcelona', 'bayern', 'al-hilal'],
          offers: [
            { clubId: 'barcelona', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('barcelona')!, value) },
            { clubId: 'bayern', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('bayern')!, value) },
            { clubId: 'al-hilal', move: 'permanent', fee: value, weeklyWage: weeklyWageForClub(getClub('al-hilal')!, value) },
          ],
          allowDecline: true,
          stay: {
            clubId: 'real-madrid',
            parentClubId: 'real-madrid',
            role: 'first-team',
            seasonsAtCurrentClub: 3,
          },
        }
      : null;

  let nationalTeam = createNationalTeamState('spain');
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', true, 1);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', true, 0);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', false, 2);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'euro', true, 1);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'euro', false, 0);

  useCareerStore.setState({
    phase: preview === 'record' ? 'career' : preview === 'transfer' ? 'transfer-choice' : preview === 'result' ? 'match-result' : 'hub',
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
    lastMatchSummary: 'Spain won 1–0 vs Italy · 1 goal from 1 chance',
    lastMatchResult: {
      summary: 'Spain won 1–0 vs Italy · 1 goal from 1 chance',
      isFinal: true,
      won: true,
      trophyName: 'European Championship',
      afterPhase: 'season-summary',
    },
    weeklyWage: 280_000,
    careerEarnings: 14_560_000,
    intlQualifying: { tournament: 'euro', points: 7, played: 3 },
    pendingTransfer,
  });
}
