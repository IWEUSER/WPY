/**
 * Exercises the season 1 → season 2 store transition: a full reserve season
 * that earns promotion, then the first simulated matchday of season 2
 * (calendar, standings, multi-chance live match).
 *
 * Run with: npx tsx scripts/simulateSeason2Store.ts
 */
import { useCareerStore } from '../src/game/career/store';
import { getClub, leagueMatchWeeks } from '../src/game/career/data/clubs';
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

const reserveGames = leagueMatchWeeks(getClub(clubId)?.league ?? 'La Liga');
for (let i = 0; i < reserveGames; i++) {
  store.getState().advance();
  store.getState().recordMatchShot(fakeShot(true));
}
console.log('S1 done phase', store.getState().phase, 'goals', store.getState().currentSeason?.goals);
store.getState().continueAfterSeason();
if (store.getState().phase === 'transfer-choice') {
  store.getState().resolveTransferChoice(null);
}

const s1record = store.getState().seasonHistory[0];
console.log(
  'S1 record',
  s1record && {
    age: s1record.age,
    clubId: s1record.clubId,
    games: s1record.gamesPlayed,
    goals: s1record.goals,
    leagueGoals: s1record.leagueGoals,
    ratio: s1record.gamesPlayed ? (s1record.goals / s1record.gamesPlayed).toFixed(2) : '0',
    trophies: s1record.trophies,
    topGoalscorer: s1record.topGoalscorer,
    playerOfTheYear: s1record.playerOfTheYear,
    wonWpy: s1record.wonWpy,
  },
);
if (!s1record || s1record.age !== 16 || s1record.gamesPlayed !== reserveGames || s1record.goals !== reserveGames) {
  console.error('Season 1 career record must store age, games and goals');
  process.exitCode = 1;
}
if (store.getState().careerGoals !== 0 || store.getState().careerGames !== 0) {
  console.error('Trial and the reserve year must not count toward the overall career ratio');
  process.exitCode = 1;
}
if (s1record.playerOfTheYear) {
  console.error('Season 1 has no league title, so it cannot award Player of the Year');
  process.exitCode = 1;
}

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
const s2Expected = [
  'qualifier',
  'qualifier',
  'qualifier',
  'group',
  'group',
  'group',
  'round-of-32',
  'round-of-16',
  'quarter-final',
  'semi-final',
  'final',
];
const s2Rounds = s2Intl.map((f) => f.internationalRound);
if (s2Rounds.join() !== s2Expected.join()) {
  console.error('Season 2 must include the remaining World Cup qualifiers and a last-32 tournament');
  process.exitCode = 1;
}
if (s2.seasonSim?.internationalSelected) {
  console.error('Call-up must wait until this season’s goal ratio meets the national bar');
  process.exitCode = 1;
}
if (s2.contractYearsRemaining !== 5) {
  console.error('Promotion onto a first-team deal should start a 5-year contract');
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
console.log('phase', after.phase, 'career games', after.careerGames, '(expect 1 after first first-team match)');
const reserveEarnings = store.getState().seasonHistory[0]?.earnings ?? 0;
console.log('earnings after S1', reserveEarnings, 'after first S2 match', after.careerEarnings, 'wage', after.weeklyWage);
if (reserveEarnings <= 0 || reserveEarnings !== after.weeklyWage * reserveGames) {
  console.error('reserve-year earnings must rise by the weekly wage after every match');
  process.exitCode = 1;
}
if (after.careerEarnings !== reserveEarnings + after.weeklyWage) {
  console.error('career earnings must move by one weekly wage after each first-team match');
  process.exitCode = 1;
}
const afterRatio =
  after.currentSeason && after.currentSeason.gamesPlayed > 0
    ? after.currentSeason.goals / after.currentSeason.gamesPlayed
    : 0;
console.log('after first match intl selected', after.seasonSim?.internationalSelected, 'season ratio', afterRatio.toFixed(2));
if (afterRatio >= 0.66 && !after.seasonSim?.internationalSelected) {
  console.error('hitting the national bar this season must trigger a call-up');
  process.exitCode = 1;
}
if (afterRatio < 0.66 && after.seasonSim?.internationalSelected) {
  console.error('a season ratio below the national bar must not keep the player selected');
  process.exitCode = 1;
}
if (after.careerGames !== 1) {
  console.error('Career games must start counting in season 2');
  process.exitCode = 1;
}

const finalIndex = after.seasonCalendar?.fixtures.findIndex(
  (f) => f.kind === 'international' && f.internationalRound === 'final',
);
if (finalIndex == null || finalIndex < 0 || !after.seasonSim || !after.seasonCalendar) {
  console.error('Season 2 must include a World Cup final');
  process.exitCode = 1;
} else {
  store.setState({
    seasonSim: { ...after.seasonSim, fixtureIndex: finalIndex },
    liveMatch: { fixtureIndex: finalIndex, chancesTotal: 1, chancesTaken: 1, goals: 1 },
  });
  store.getState().finishLiveMatch();
  const finalState = store.getState();
  console.log('WC final phase', finalState.phase, finalState.lastMatchResult);
  if (finalState.phase !== 'match-result' || !finalState.lastMatchResult?.isFinal) {
    console.error('A World Cup final must show the result screen before season summary');
    process.exitCode = 1;
  }
  if (finalState.lastMatchResult?.afterPhase !== 'season-summary') {
    console.error('Acknowledging the last final of the year should then open season summary');
    process.exitCode = 1;
  }
  store.getState().acknowledgeMatchResult();
  if (store.getState().phase !== 'season-summary') {
    console.error('Continue after a season-ending final must reach season summary');
    process.exitCode = 1;
  }
  console.log('after acknowledge', store.getState().phase);
}
