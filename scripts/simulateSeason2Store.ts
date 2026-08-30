/**
 * Exercises the season 1 → season 2 store transition: a full reserve season
 * that earns promotion, then the first simulated matchday of season 2
 * (calendar, standings, multi-chance live match).
 *
 * Run with: npx tsx scripts/simulateSeason2Store.ts
 */
import { useCareerStore } from '../src/game/career/store';
import { getClub, leagueMatchWeeks } from '../src/game/career/data/clubs';
import { currentCalendarWeek } from '../src/game/career/calendar';
import { playerMarketValueFromSeasons, YOUTH_MARKET_VALUE } from '../src/game/career/playerValue';
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
console.log(
  'after nationality phase',
  store.getState().phase,
  'nation',
  store.getState().nationality,
  store.getState().openingCampaign?.youthName,
);
if (
  store.getState().phase !== 'match'
  || store.getState().nationality !== 'spain'
  || store.getState().openingCampaign?.kind !== 'youth-tournament'
) {
  console.error('Choosing nationality with no club must start the U16 tournament');
  process.exitCode = 1;
}

function playOpeningMatch(goals: number) {
  const live = store.getState().liveMatch;
  if (!live) {
    console.error('expected a live opening match');
    process.exitCode = 1;
    return;
  }
  for (let i = 0; i < live.chancesTotal; i++) {
    store.getState().recordMatchChance(fakeShot(i < goals));
  }
  store.getState().finishLiveMatch();
  store.getState().acknowledgeMatchResult();
}

function playSimSeason(scoreAll: boolean) {
  let guard = 0;
  while (guard++ < 160) {
    const phase = store.getState().phase;
    if (phase === 'season-summary' || phase === 'transfer-choice') break;
    if (phase === 'match-result') {
      store.getState().acknowledgeMatchResult();
      continue;
    }
    if (phase === 'match') {
      const live = store.getState().liveMatch;
      if (!live) {
        store.getState().advance();
        continue;
      }
      for (let i = 0; i < live.chancesTotal; i++) {
        store.getState().recordMatchChance(fakeShot(scoreAll));
      }
      store.getState().finishLiveMatch();
      continue;
    }
    store.getState().advance();
  }
}

function completeOpeningAndSign(): string | undefined {
  while (store.getState().phase === 'match' && store.getState().openingCampaign?.kind === 'youth-tournament') {
    playOpeningMatch(store.getState().liveMatch?.chancesTotal ?? 1);
  }
  if (store.getState().phase === 'match-result') store.getState().acknowledgeMatchResult();
  if (store.getState().phase === 'opening-brief') store.getState().startOpeningTrial();
  while (store.getState().phase === 'match' && store.getState().openingCampaign?.kind === 'club-trial') {
    playOpeningMatch(store.getState().liveMatch?.chancesTotal ?? 1);
  }
  if (store.getState().phase === 'match-result') store.getState().acknowledgeMatchResult();
  const clubId = store.getState().trial?.offeredClubIds[0];
  if (clubId) store.getState().chooseClub(clubId);
  return clubId;
}

const youthName = store.getState().openingCampaign?.youthName;
const clubId = completeOpeningAndSign();
console.log('after opening', store.getState().phase, youthName, 'signed', clubId);
if (!clubId || store.getState().phase !== 'hub' || getClub(clubId)?.country !== 'Spain') {
  console.error('a passed Spanish U16 trial must sign a Spanish club');
  process.exitCode = 1;
}
console.log(
  'S1 club',
  clubId,
  'phase',
  store.getState().phase,
  'calendar',
  store.getState().seasonCalendar,
  'contract',
  store.getState().contractYearsRemaining,
  'sponsorship',
  store.getState().seasonSponsorship,
);
if (store.getState().contractYearsRemaining !== 1) {
  console.error('Reserve team contracts must be 1 year');
  process.exitCode = 1;
}
if (store.getState().seasonSponsorship !== 0) {
  console.error('Reserve team players must not receive sponsorship');
  process.exitCode = 1;
}
if (store.getState().phase !== 'hub') {
  console.error('Signing a club after nationality must go to the hub, not nationality again');
  process.exitCode = 1;
}

const reserveCal = store.getState().seasonCalendar;
const reserveKinds = [...new Set(reserveCal?.fixtures.map((f) => f.kind) ?? [])];
const reserveGames = leagueMatchWeeks(getClub(clubId)?.league ?? 'La Liga');
console.log('S1 reserve calendar', reserveCal?.fixtures.length, reserveKinds, 'league weeks', reserveGames);
if (!reserveCal || reserveKinds.join() !== 'league' || reserveCal.fixtures.length !== reserveGames) {
  console.error('the reserve year must be a league-only first-team calendar');
  process.exitCode = 1;
}
if (reserveCal.fixtures.some((f) => f.playerChances == null)) {
  console.error('reserve league games must use the first-team chance roll');
  process.exitCode = 1;
}
playSimSeason(true);
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
if (!s1record || s1record.age !== 16 || s1record.matches.length !== reserveGames) {
  console.error('Season 1 career record must store age and a full league of reserve games');
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
console.log(
  'S2 weeks',
  s2.seasonCalendar?.totalWeeks,
  'rival',
  s2.seasonSim?.titleRivalId,
  'injury',
  s2.injuryGamesRemaining,
);
const s2LeagueWeeks = leagueMatchWeeks(getClub(s2.clubId ?? '')?.league ?? 'La Liga');
const s2CupFinal = s2.seasonCalendar?.fixtures.find((f) => f.kind === 'domestic-cup' && f.domesticCupStage === 'final')?.week;
const s2EuroFinal = s2.seasonCalendar?.fixtures.find((f) => f.kind === 'continental-final')?.week;
if (s2CupFinal !== s2LeagueWeeks + 1 || (s2EuroFinal != null && s2EuroFinal !== s2LeagueWeeks + 2)) {
  console.error('Season 2 week order must be league, cup final, then European final');
  process.exitCode = 1;
}
if (!s2.seasonSim?.titleRivalId) {
  console.error('Season 2 must assign a title rival');
  process.exitCode = 1;
}
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
const reserveSponsorship = store.getState().seasonHistory[0]?.sponsorship ?? 0;
const s1Wages = after.weeklyWage * reserveGames;
console.log(
  'earnings after S1',
  reserveEarnings,
  'sponsorship',
  reserveSponsorship,
  'after first S2 match',
  after.careerEarnings,
  'wage',
  after.weeklyWage,
  'S2 sponsorship',
  after.seasonSponsorship,
);
if (reserveEarnings <= 0 || reserveEarnings !== s1Wages + reserveSponsorship) {
  console.error(
    `reserve-year earnings ${reserveEarnings} should be wages ${s1Wages} + sponsorship ${reserveSponsorship}`,
  );
  process.exitCode = 1;
}
const expectedCareer = reserveEarnings + after.weeklyWage + after.seasonSponsorship;
if (after.careerEarnings !== expectedCareer) {
  console.error(
    `career earnings ${after.careerEarnings} should be reserve ${reserveEarnings} + one week ${after.weeklyWage} + S2 sponsorship ${after.seasonSponsorship}`,
  );
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

{
  const snapshot = store.getState();
  const cal = snapshot.seasonCalendar;
  const domesticFinalIndex = cal?.fixtures.findIndex(
    (f) => f.kind === 'domestic-cup' && f.domesticCupStage === 'final',
  );
  const cupFinalIndex = cal?.fixtures.findIndex((f) => f.kind === 'continental-final');
  const finalIndex =
    domesticFinalIndex != null && domesticFinalIndex >= 0
      ? domesticFinalIndex
      : cupFinalIndex != null && cupFinalIndex >= 0
        ? cupFinalIndex
        : -1;
  const fixture = finalIndex >= 0 ? cal?.fixtures[finalIndex] : undefined;
  if (finalIndex >= 0 && fixture && snapshot.seasonSim) {
    store.setState({
      injuryGamesRemaining: 1,
      liveMatch: null,
      lastMatchResult: null,
      seasonSim: {
        ...snapshot.seasonSim,
        fixtureIndex: finalIndex,
        domesticCupStage: fixture.kind === 'domestic-cup' ? 'final' : snapshot.seasonSim.domesticCupStage,
        europeanStanding:
          fixture.kind === 'continental-final' && snapshot.seasonSim.europeanStanding
            ? { ...snapshot.seasonSim.europeanStanding, stage: 'final' }
            : snapshot.seasonSim.europeanStanding,
      },
    });
    store.getState().advance();
    const injured = store.getState();
    console.log('injured final', injured.phase, injured.lastMatchResult);
    if (injured.phase !== 'match-result' || !injured.lastMatchResult?.isFinal) {
      console.error('missing a final through injury must still show the result screen');
      process.exitCode = 1;
    }
    if (!injured.lastMatchResult?.summary.includes('injured')) {
      console.error('the injured-final result must say the player was injured');
      process.exitCode = 1;
    }
    store.setState({
      phase: snapshot.phase,
      seasonSim: snapshot.seasonSim,
      currentSeason: snapshot.currentSeason,
      injuryGamesRemaining: 0,
      liveMatch: snapshot.liveMatch,
      lastMatchResult: snapshot.lastMatchResult,
      lastMatchSummary: snapshot.lastMatchSummary,
      seasonStandings: snapshot.seasonStandings,
      availability: snapshot.availability,
      nationalTeam: snapshot.nationalTeam,
      careerGames: snapshot.careerGames,
      careerGoals: snapshot.careerGoals,
      careerEarnings: snapshot.careerEarnings,
      formWindow: snapshot.formWindow,
      wpyResult: snapshot.wpyResult,
    });
  } else {
    console.error('Season 2 must include a final to test the injury result screen');
    process.exitCode = 1;
  }
}
const afterClub = after.clubId ? getClub(after.clubId) : undefined;
const afterWeek =
  after.seasonCalendar && after.seasonSim
    ? currentCalendarWeek(after.seasonCalendar, after.seasonSim.fixtureIndex)
    : 1;
const afterValue = afterClub && after.currentSeason
  ? playerMarketValueFromSeasons({
      age: after.age,
      careerGoals: after.careerGoals,
      careerGames: after.careerGames,
      seasons: [...after.seasonHistory, after.currentSeason],
      fallbackClub: afterClub,
      contractYearsRemaining: after.contractYearsRemaining,
      seasonNumber: after.seasonNumber,
      calendarWeek: afterWeek,
    })
  : null;
console.log('S1 market value after first match', afterValue, 'week', afterWeek);
if (afterValue !== YOUTH_MARKET_VALUE) {
  console.error('Season 1 market value must stay €100k until week 20');
  process.exitCode = 1;
}
if (after.seasonSponsorship !== 0) {
  console.error('Season 1 sponsorship must stay at zero until market value reaches €10m');
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

store.getState().resetCareer();
store.getState().startCareer();
store.getState().chooseNationality('spain');
const loanParent = completeOpeningAndSign();
if (!loanParent) {
  console.error('opening flow must still produce a club before a failed reserve season');
  process.exit(1);
}
playSimSeason(false);
store.getState().continueAfterSeason();
console.log(
  'failed reserve phase',
  store.getState().phase,
  'season',
  store.getState().seasonNumber,
  'offers',
  store.getState().pendingTransfer?.kind,
);
if (store.getState().phase !== 'transfer-choice' || store.getState().pendingTransfer?.kind !== 'loan') {
  console.error('Missing the reserve ratio must force a season-1 loan');
  process.exitCode = 1;
}
const loanClubId = store.getState().pendingTransfer?.clubIds[0];
if (!loanClubId) {
  console.error('Season 1 loan offers must include a club');
  process.exitCode = 1;
} else {
  store.getState().resolveTransferChoice(loanClubId);
  const loaned = store.getState();
  console.log(
    'S1 loan',
    loaned.clubId,
    'role',
    loaned.role,
    'season',
    loaned.seasonNumber,
    'contract',
    loaned.contractYearsRemaining,
    'sponsorship',
    loaned.seasonSponsorship,
  );
  if (loaned.role !== 'loan' || loaned.seasonNumber !== 2) {
    console.error('The reserve miss must send the player on loan for public season 1');
    process.exitCode = 1;
  }
  if (loaned.contractYearsRemaining !== 1) {
    console.error('A season 1 loan must remain a 1-year contract');
    process.exitCode = 1;
  }
  if (loaned.seasonSponsorship !== 0) {
    console.error('A season 1 loan below €10m must not receive sponsorship');
    process.exitCode = 1;
  }
}
