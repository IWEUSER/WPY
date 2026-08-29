/**
 * Exercises the season 1 → season 2 store transition: a full reserve season
 * that earns promotion, then the first simulated matchday of season 2
 * (calendar, standings, multi-chance live match).
 *
 * Run with: npx tsx scripts/simulateSeason2Store.ts
 */
import { useCareerStore, SEASON_LENGTH } from '../src/game/career/store';
import { getClub } from '../src/game/career/data/clubs';
import type { ShotResult } from '../src/game/shooting/types';

function fakeShot(scored: boolean): ShotResult {
  return {
    outcome: scored ? 'goal' : 'wide',
    aim: { x: 0, y: 0.5 },
    intendedAim: { x: 0, y: 0.5 },
    power: 1,
    curl: 0,
    travelTimeMs: 400,
    keeperDive: {
      target: { x: 0, y: 0.5 },
      hand: { x: 0, y: 0.5 },
      reactionMs: 80,
      diveDurationMs: 300,
      reach: 0.2,
      direction: 0,
      stretch: 0,
      layout: 0,
      elevation: 0,
    },
    saveMargin: scored ? 1 : 0,
  };
}

const store = useCareerStore;
store.getState().resetCareer();
store.getState().startCareer();
console.log('after startCareer phase', store.getState().phase, '(expect nationality-choice)');
if (store.getState().phase !== 'nationality-choice') {
  console.error('Start Career must open nationality selection before the trial');
  process.exitCode = 1;
}
store.getState().chooseNationality('spain');
console.log('after nationality phase', store.getState().phase, 'nation', store.getState().nationality, '(expect trial / spain)');
if (store.getState().phase !== 'trial' || store.getState().nationality !== 'spain') {
  console.error('Choosing nationality with no club must start the trial');
  process.exitCode = 1;
}
for (let i = 0; i < 10; i++) store.getState().recordTrialShot(fakeShot(true));
store.getState().finishTrial();
const offered = store.getState().trial!.offeredClubIds;
const spanishOffers = offered.filter((id) => getClub(id)?.country === 'Spain').length;
console.log('S1 offers', offered, `spanish=${spanishOffers}`);
if (spanishOffers < 2) {
  console.error('Spanish nationality should produce 2 of 3 trial offers from Spain');
  process.exitCode = 1;
}
const clubId = offered[0];
store.getState().chooseClub(clubId);
console.log('S1 club', clubId, 'phase', store.getState().phase, 'calendar', store.getState().seasonCalendar);
if (store.getState().phase !== 'hub') {
  console.error('Signing a club after nationality must go to the hub, not nationality again');
  process.exitCode = 1;
}

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
console.log(
  'S2 international',
  s2.seasonSim?.internationalTournament,
  s2.seasonSim?.internationalPhase,
  s2.seasonSim?.internationalStage,
);
const s2Intl = s2.seasonCalendar?.fixtures.filter((f) => f.kind === 'international') ?? [];
const s2ClubVsCountry = s2Intl.filter((f) => f.opponentId && getClub(f.opponentId));
console.log(
  'S2 intl rounds',
  s2Intl.map((f) => `${f.internationalRound} vs ${f.opponentLabel}`),
  'club opponents',
  s2ClubVsCountry.length,
);
if (s2.seasonSim?.internationalTournament !== 'world-cup') {
  console.error('Season 2 must be a World Cup year for a Spanish player');
  process.exitCode = 1;
}
if (s2ClubVsCountry.length > 0) {
  console.error('International fixtures must not use club opponents');
  process.exitCode = 1;
}
if (!s2Intl.some((f) => f.internationalRound === 'qualifier') || !s2Intl.some((f) => f.internationalRound === 'final')) {
  console.error('Season 2 must include World Cup qualifiers and the World Cup itself');
  process.exitCode = 1;
}

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
