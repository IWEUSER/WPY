import { createAvailability } from './availabilityEngine';
import { getClub } from './data/clubs';
import { createNationalTeamState } from './international';
import { buildSeasonStandings } from './matchEngine';
import { hydrateSeason } from './seasonSim';
import { useCareerStore } from './store';
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
      goals: 22,
      gamesPlayed: 38,
      ratioMet: true,
      age: 17,
      leagueGoals: 18,
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
      goals: 14,
      gamesPlayed: 36,
      ratioMet: true,
      age: 18,
      leagueGoals: 11,
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
    previousSeasonRatio: 0.61,
    nationId: 'spain',
  });

  useCareerStore.setState({
    phase: new URLSearchParams(window.location.search).get('preview-career') === 'record' ? 'career' : 'hub',
    age: 19,
    seasonNumber: 4,
    clubId: 'real-madrid',
    parentClubId: 'real-madrid',
    role: 'first-team',
    seasonsAtCurrentClub: 3,
    nationality: 'spain',
    nationalTeam: createNationalTeamState('spain'),
    availability: createAvailability(),
    seasonHistory: history,
    careerGoals: 56,
    careerGames: 98,
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
  });
}
