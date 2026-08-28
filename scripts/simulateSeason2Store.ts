/**
 * Exercises the season 1 → season 2 store transition: a full reserve season
 * that earns promotion, then the first simulated matchday of season 2
 * (calendar, standings, multi-chance live match).
 *
 * Run with: npx tsx scripts/simulateSeason2Store.ts
 */
import { useCareerStore, SEASON_LENGTH } from '../src/game/career/store';
import type { ShotResult } from '../src/game/shooting/types';

function fakeShot(scored: boolean): ShotResult {
  return {
    outcome: scored ? 'goal' : 'wide',
    aim: { x: 0, y: 0.5 },
    intendedAim: { x: 0, y: 0.5 },
    power: 1,
    curl: 0,
    travelTimeMs: 400,
    keeperDive: { target: { x: 0, y: 0.5 }, reactionMs: 80, diveDurationMs: 300, reach: 0.2 },
    saveMargin: scored ? 1 : 0,
  };
}

const store = useCareerStore;
store.getState().resetCareer();
store.getState().startTrial();
for (let i = 0; i < 10; i++) store.getState().recordTrialShot(fakeShot(true));
store.getState().finishTrial();
const clubId = store.getState().trial!.offeredClubIds[0];
store.getState().chooseClub(clubId);
store.getState().chooseNationality('spain');
console.log('S1 club', clubId, 'phase', store.getState().phase, 'calendar', store.getState().seasonCalendar);

for (let i = 0; i < SEASON_LENGTH; i++) {
  store.getState().advance();
  store.getState().recordMatchShot(fakeShot(true));
}
console.log('S1 done phase', store.getState().phase, 'goals', store.getState().currentSeason?.goals);
store.getState().continueAfterSeason();

const s2 = store.getState();
console.log('S2 phase', s2.phase, 'season', s2.seasonNumber, 'role', s2.role);
console.log('S2 fixtures', s2.seasonCalendar?.fixtures.length, 'standings rows', s2.seasonStandings?.league.length);
console.log('Europe', s2.seasonStandings?.europeanStanding, 'intl selected', s2.seasonSim?.internationalSelected);

store.getState().advance();
const live = store.getState().liveMatch;
const fixture = store.getState().seasonCalendar?.fixtures[live?.fixtureIndex ?? 0];
console.log('first S2 live match', live, 'fixture', fixture?.kind, fixture?.opponentLabel, 'chances', live?.chancesTotal);

if (live) {
  for (let i = 0; i < live.chancesTotal; i++) {
    store.getState().recordMatchChance(fakeShot(i === 0));
  }
  store.getState().finishLiveMatch();
}
const after = store.getState();
console.log('after first S2 match:', after.lastMatchSummary);
console.log('league pos', after.seasonStandings?.league.find((r) => r.clubId === after.clubId)?.position, 'pts', after.seasonStandings?.league.find((r) => r.clubId === after.clubId)?.points);
console.log('phase', after.phase, 'career games', after.careerGames);
