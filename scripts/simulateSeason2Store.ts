/**
 * Exercises the youth-path store: tournament + trial, then Season 1 as a
 * Rising star, then the first matchday checks (calendar, standings, chances).
 *
 * Run with: npx tsx scripts/simulateSeason2Store.ts
 */
import { useCareerStore } from '../src/game/career/store';
import { getClub, leagueMatchWeeks } from '../src/game/career/data/clubs';
import { currentCalendarWeek } from '../src/game/career/calendar';
import { FIRST_CONTRACT_YEARS, playerMarketValue, playerMarketValueFromSeasons, weeklyWageForSquadStatus, YOUTH_MARKET_VALUE } from '../src/game/career/playerValue';
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
function pickNation(nationId: string, name = 'Ian Test') {
  store.getState().chooseNationality(nationId);
  store.getState().confirmPlayerName(name);
}

pickNation('spain');
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
  if (store.getState().phase === 'hub' && store.getState().openingCampaign && !store.getState().seasonSim) {
    store.getState().advance();
  }
  if (store.getState().phase === 'opening-brief') {
    store.getState().startOpeningTrial();
  }
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

function completeLiveMatch(openPlayGoals = 1) {
  let guard = 0;
  while (store.getState().liveMatch && guard < 8) {
    const live = store.getState().liveMatch;
    if (!live) break;
    if (live.penaltyKick) {
      store.getState().recordMatchChance(fakeShot(true));
    } else if (live.chancesTaken < live.chancesTotal) {
      for (let i = live.chancesTaken; i < live.chancesTotal; i++) {
        store.getState().recordMatchChance(fakeShot(i < openPlayGoals));
      }
    }
    store.getState().finishLiveMatch();
    guard += 1;
  }
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
  let guard = 0;
  while (guard++ < 80) {
    const phase = store.getState().phase;
    if (phase === 'hub' && store.getState().openingCampaign && !store.getState().seasonSim) {
      store.getState().advance();
      continue;
    }
    if (phase === 'match-result') {
      store.getState().acknowledgeMatchResult();
      continue;
    }
    if (phase === 'opening-brief') {
      store.getState().startOpeningTrial();
      continue;
    }
    if (phase === 'club-offer') {
      const clubId = store.getState().trial?.offeredClubIds[0];
      if (clubId) store.getState().chooseClub(clubId);
      return clubId;
    }
    if (phase === 'match' && store.getState().openingCampaign) {
      playOpeningMatch(store.getState().liveMatch?.chancesTotal ?? 1);
      continue;
    }
    break;
  }
  return store.getState().clubId ?? undefined;
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
{
  const signed = store.getState();
  const signedClub = signed.clubId ? getClub(signed.clubId) : undefined;
  const risingWage = signedClub
    ? weeklyWageForSquadStatus(
        signedClub,
        playerMarketValue({ age: signed.age, ratio: 0.3, careerGoals: 0, club: signedClub }),
        'rising-star',
      )
    : 0;
  if (
    signed.role !== 'first-team'
    || signed.squadStatus !== 'rising-star'
    || signed.age !== 17
    || signed.contractYearsRemaining !== FIRST_CONTRACT_YEARS
    || signed.weeklyWage !== risingWage
  ) {
    console.error('A passed trial must start Season 1 as a Rising star on a 2-year deal at 10% of that club’s top wage');
    process.exitCode = 1;
  }
}
if (store.getState().seasonSponsorship !== 0) {
  console.error('Season 1 sponsorship must stay at zero until market value reaches €10m');
  process.exitCode = 1;
}
if (store.getState().phase !== 'hub') {
  console.error('Signing a club after nationality must go to the hub, not nationality again');
  process.exitCode = 1;
}

const firstCal = store.getState().seasonCalendar;
const firstKinds = [...new Set(firstCal?.fixtures.map((f) => f.kind) ?? [])];
const leagueGames = leagueMatchWeeks(getClub(clubId)?.league ?? 'La Liga');
console.log('S1 calendar', firstCal?.fixtures.length, firstKinds, 'league weeks', leagueGames);
if (!firstCal || !firstKinds.includes('league') || !firstKinds.includes('domestic-cup')) {
  console.error('Season 1 after a trial must be the full first-team calendar');
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
if (s2.role !== 'first-team' || s2.age !== 17) {
  console.error('The first first-team season must be at age 17');
  process.exitCode = 1;
}
if (s2.squadStatus !== 'rising-star') {
  console.error('Youth-path first-team Season 1 must start as a Rising star');
  process.exitCode = 1;
}
if (s2.seasonSim?.internationalTournament !== 'world-cup' || s2.seasonSim?.internationalPhase !== 'qualifiers') {
  console.error('Youth-path first-team Season 1 must be World Cup qualifying, not the tournament');
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
];
const s2Rounds = s2Intl.map((f) => f.internationalRound);
if (s2Rounds.join() !== s2Expected.join()) {
  console.error('Youth-path first-team Season 1 must include five World Cup qualifiers and no tournament');
  process.exitCode = 1;
}
if (s2.seasonSim?.internationalSelected) {
  console.error('Call-up must wait until this season’s goal ratio meets the national bar');
  process.exitCode = 1;
}
if (s2.contractYearsRemaining !== FIRST_CONTRACT_YEARS) {
  console.error('Season 1 as a Rising star must start a 2-year contract');
  process.exitCode = 1;
}

store.getState().advance();
if (store.getState().phase === 'match-result') {
  console.log('S2 first match sit-out', store.getState().lastMatchResult?.sitOutReason);
  if (!store.getState().lastMatchResult?.sitOutReason) {
    console.error('Rising star Season 1 must sit the opening first-team match');
    process.exitCode = 1;
  }
  store.getState().acknowledgeMatchResult();
}
{
  let guard = 0;
  while (!store.getState().liveMatch && guard++ < 12) {
    if (store.getState().phase === 'match-result') {
      store.getState().acknowledgeMatchResult();
      continue;
    }
    store.getState().advance();
  }
}
const live = store.getState().liveMatch;
const fixture = store.getState().seasonCalendar?.fixtures[live?.fixtureIndex ?? 0];
console.log('first S2 live match', live, 'fixture', fixture?.kind, fixture?.opponentLabel, 'chances', live?.chancesTotal);
if (!live || live.chancesTotal !== 1) {
  console.error('Rising star Season 1 must get one chance in each game played');
  process.exitCode = 1;
}
completeLiveMatch(1);
if (store.getState().phase === 'match-result') store.getState().acknowledgeMatchResult();
const after = store.getState();
console.log('after first S2 match:', after.lastMatchSummary);
console.log('league pos', after.seasonStandings?.league.find((r) => r.clubId === after.clubId)?.position, 'pts', after.seasonStandings?.league.find((r) => r.clubId === after.clubId)?.points);
console.log('phase', after.phase, 'career games', after.careerGames, '(expect 1 after first first-team match)');
const expectedCareer = after.weeklyWage * 2 + after.seasonSponsorship;
console.log(
  'after first S1 match',
  after.careerEarnings,
  'wage',
  after.weeklyWage,
  'S1 sponsorship',
  after.seasonSponsorship,
);
if (after.careerEarnings !== expectedCareer) {
  console.error(
    `career earnings ${after.careerEarnings} should be sit-out week + played week ${after.weeklyWage} + S1 sponsorship ${after.seasonSponsorship}`,
  );
  process.exitCode = 1;
}
const afterRatio =
  after.currentSeason && after.currentSeason.gamesPlayed > 0
    ? after.currentSeason.goals / after.currentSeason.gamesPlayed
    : 0;
console.log('after first match intl selected', after.seasonSim?.internationalSelected, 'season ratio', afterRatio.toFixed(2));
if (after.seasonSim?.internationalSelected) {
  console.error('Season 1 call-ups must wait until after week 20');
  process.exitCode = 1;
}
if (after.careerGames !== 1) {
  console.error('Career games must start counting in Season 1');
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
          careerStart: after.careerStart,
          role: after.role,
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

const cupFinalIndex = after.seasonCalendar?.fixtures.findIndex(
  (f) => f.kind === 'domestic-cup' && f.domesticCupStage === 'final',
);
const wcFinal = after.seasonCalendar?.fixtures.find(
  (f) => f.kind === 'international' && f.internationalRound === 'final',
);
if (wcFinal) {
  console.error('Youth-path first-team Season 1 must not include a World Cup final');
  process.exitCode = 1;
}
if (cupFinalIndex == null || cupFinalIndex < 0 || !after.seasonSim || !after.seasonCalendar) {
  console.error('Season 2 must include a domestic-cup final');
  process.exitCode = 1;
} else {
  store.setState({
    seasonSim: {
      ...after.seasonSim,
      fixtureIndex: cupFinalIndex,
      domesticCupStage: 'final',
    },
    liveMatch: { fixtureIndex: cupFinalIndex, chancesTotal: 1, chancesTaken: 0, goals: 0, openPlayGoals: 0 },
    lastMatchResult: null,
    lastMatchSummary: null,
    injuryGamesRemaining: 0,
  });
  completeLiveMatch(1);
  const finalState = store.getState();
  console.log('cup final phase', finalState.phase, finalState.lastMatchResult);
  if (finalState.phase !== 'match-result' || !finalState.lastMatchResult?.isFinal) {
    console.error('A cup final must show the result screen before returning to the hub');
    process.exitCode = 1;
  }
  store.getState().acknowledgeMatchResult();
  console.log('after acknowledge', store.getState().phase);
}

store.getState().resetCareer();
store.getState().startCareer();
pickNation('spain');
const loanParent = completeOpeningAndSign();
if (!loanParent) {
  console.error('opening flow must still produce a club before a failed Season 1');
  process.exit(1);
}
playSimSeason(false);
if (store.getState().phase === 'season-summary') store.getState().continueAfterSeason();
console.log(
  'failed S1 phase',
  store.getState().phase,
  'season',
  store.getState().seasonNumber,
  'offers',
  store.getState().pendingTransfer?.kind,
);
{
  const pending = store.getState().pendingTransfer;
  const renewal = pending?.offers?.find((o) => o.renewal && o.clubId === loanParent);
  const otherWages = (pending?.offers ?? []).filter((o) => !o.renewal).map((o) => o.weeklyWage);
  if (
    store.getState().phase !== 'transfer-choice'
    || !pending?.allowDecline
    || !renewal
    || renewal.weeklyWage <= 0
    || otherWages.length === 0
    || otherWages.some((wage) => wage <= 0)
  ) {
    console.error('Missing Season 1 must still offer a current-club renewal wage plus other clubs’ salary offers');
    process.exitCode = 1;
  }
}
const loanClubId = store.getState().pendingTransfer?.offers?.find((o) => o.move === 'loan' && !o.renewal)?.clubId
  ?? store.getState().pendingTransfer?.clubIds.find((id) => id !== loanParent);
if (!loanClubId) {
  console.error('Season 1 loan offers must include a club');
  process.exitCode = 1;
} else {
  store.getState().resolveTransferChoice(loanClubId);
  const loaned = store.getState();
  console.log(
    'S2 loan',
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
  if (loaned.role !== 'loan' || loaned.seasonNumber !== 2 || loaned.age !== 18) {
    console.error('A Season 1 loan move must start Season 2 on loan at age 18');
    process.exitCode = 1;
  }
  {
    const dest = loaned.clubId ? getClub(loaned.clubId) : undefined;
    const destWage = dest
      ? weeklyWageForSquadStatus(dest, playerMarketValueFromSeasons({
          age: loaned.age,
          careerGoals: loaned.careerGoals,
          careerGames: loaned.careerGames,
          seasons: loaned.seasonHistory,
          fallbackClub: dest,
          seasonNumber: loaned.seasonNumber,
          calendarWeek: 99,
          role: 'loan',
        }), 'starter', dest.league)
      : 0;
    if (loaned.weeklyWage !== destWage) {
      console.error('The first loan must pay the destination starter wage');
      process.exitCode = 1;
    }
  }
  if (loaned.contractYearsRemaining !== 1) {
    console.error('A season 2 loan must remain a 1-year contract');
    process.exitCode = 1;
  }
  if (loaned.seasonSponsorship !== 0) {
    console.error('A season 2 loan below €10m must not receive sponsorship');
    process.exitCode = 1;
  }
}

console.log('\n--- Favourite club start paths ---');
store.getState().resetCareer();
store.getState().startFavouritePath('favourite-trial');
if (store.getState().phase !== 'club-choice' || store.getState().careerStart !== 'favourite-trial') {
  console.error('Favourite trial must open the club picker');
  process.exitCode = 1;
}
store.getState().chooseFavouriteClub('real-madrid');
if (store.getState().phase !== 'nationality-choice' || store.getState().clubId !== 'real-madrid') {
  console.error('Picking a favourite club must then ask for nationality');
  process.exitCode = 1;
}
pickNation('spain');
{
  const s = store.getState();
  console.log('favourite trial start', s.phase, s.openingCampaign?.kind, s.clubId, s.seasonCalendar?.fixtures.length);
  if (
    s.phase !== 'match'
    || s.openingCampaign?.kind !== 'club-trial'
    || s.openingCampaign.calendar.fixtures.length !== 3
    || s.clubId !== 'real-madrid'
  ) {
    console.error('Favourite trial must start the 3-game academy trial at the chosen club');
    process.exitCode = 1;
  }
}
for (let i = 0; i < 3; i++) playOpeningMatch(4);
if (store.getState().phase === 'club-offer') {
  const signed = store.getState().trial?.offeredClubIds[0];
  if (signed) store.getState().chooseClub(signed);
}
{
  const s = store.getState();
  console.log('favourite trial pass', s.phase, s.role, s.seasonNumber, s.age, s.weeklyWage, s.contractYearsRemaining);
  if (
    s.phase !== 'hub'
    || s.role !== 'first-team'
    || s.squadStatus !== 'rising-star'
    || s.seasonNumber !== 1
    || s.age !== 17
    || s.weeklyWage !== (getClub(s.clubId ?? '')
      ? weeklyWageForSquadStatus(
          getClub(s.clubId!)!,
          playerMarketValue({ age: s.age, ratio: 0.3, careerGoals: 0, club: getClub(s.clubId!)! }),
          'rising-star',
        )
      : -1)
    || s.contractYearsRemaining !== FIRST_CONTRACT_YEARS
  ) {
    console.error('Hitting a favourite-club trial must sign a 2-year Rising star deal at 10% of that club’s top wage');
    process.exitCode = 1;
  }
  const kinds = new Set(s.seasonCalendar?.fixtures.map((f) => f.kind) ?? []);
  if (!kinds.has('league') || !kinds.has('domestic-cup')) {
    console.error('Favourite trial success must start Season 1 first-team football');
    process.exitCode = 1;
  }
}

store.getState().resetCareer();
store.getState().startFavouritePath('favourite-trial');
store.getState().chooseFavouriteClub('real-madrid');
pickNation('spain');
for (let i = 0; i < 3; i++) playOpeningMatch(0);
if (store.getState().phase === 'opening-brief') store.getState().startOpeningTrial();
{
  const s = store.getState();
  console.log(
    'favourite trial fail',
    s.phase,
    s.pendingTransfer?.kind,
    s.parentClubId,
    s.openingCampaign?.trialClubId,
    s.openingCampaign?.trialTier,
  );
  if (
    s.phase !== 'match'
    || s.parentClubId !== 'real-madrid'
    || s.openingCampaign?.trialClubId === 'real-madrid'
    || s.openingCampaign?.trialTier !== getClub('real-madrid')?.tier
    || s.pendingTransfer
  ) {
    console.error('missing a favourite-club trial must offer another look at the same level, not a forced loan');
    process.exitCode = 1;
  }
}

store.getState().resetCareer();
store.getState().startFavouritePath('favourite-reserve');
store.getState().chooseFavouriteClub('barcelona');
pickNation('spain');
{
  const s = store.getState();
  const kinds = new Set(s.seasonCalendar?.fixtures.map((f) => f.kind) ?? []);
  console.log('favourite reserve', s.phase, s.role, s.seasonNumber, [...kinds].join('/'), s.seasonCalendar?.fixtures.length);
  if (
    s.phase !== 'hub'
    || s.role !== 'first-team'
    || s.squadStatus !== 'rising-star'
    || s.seasonNumber !== 1
    || !kinds.has('domestic-cup')
  ) {
    console.error('The leftover favourite-reserve start now joins Season 1 as a Rising star');
    process.exitCode = 1;
  }
}

store.getState().resetCareer();
store.getState().startFavouritePath('favourite-first-team');
store.getState().chooseFavouriteClub('liverpool');
pickNation('england');
{
  const s = store.getState();
  const kinds = new Set(s.seasonCalendar?.fixtures.map((f) => f.kind) ?? []);
  console.log(
    'favourite first-team',
    s.phase,
    s.role,
    s.seasonNumber,
    s.age,
    s.contractYearsRemaining,
    [...kinds].join('/'),
  );
  if (
    s.phase !== 'hub'
    || s.role !== 'first-team'
    || s.seasonNumber !== 1
    || s.age !== 17
    || s.contractYearsRemaining !== FIRST_CONTRACT_YEARS
    || s.squadStatus !== 'rising-star'
    || !kinds.has('league')
    || !kinds.has('domestic-cup')
  ) {
    console.error('Favourite first-team must start Season 1 at age 17 on a 2-year deal as a Rising star with the full calendar');
    process.exitCode = 1;
  }
  const tournamentGames = (s.seasonCalendar?.fixtures ?? []).filter(
    (f) => f.kind === 'international' && f.internationalRound && f.internationalRound !== 'qualifier',
  );
  if (tournamentGames.length > 0 || (s.seasonSim?.internationalPhase && s.seasonSim.internationalPhase !== 'qualifiers' && s.seasonSim.internationalPhase !== 'none')) {
    console.error('Favourite first-team Season 1 must not schedule the World Cup tournament');
    process.exitCode = 1;
  }
  const week = s.seasonCalendar && s.seasonSim
    ? currentCalendarWeek(s.seasonCalendar, s.seasonSim.fixtureIndex)
    : 1;
  const club = getClub(s.clubId ?? 'liverpool');
  const value = club
    ? playerMarketValueFromSeasons({
        age: s.age,
        careerGoals: s.careerGoals,
        careerGames: s.careerGames,
        seasons: s.currentSeason ? [s.currentSeason] : [],
        fallbackClub: club,
        contractYearsRemaining: s.contractYearsRemaining,
        seasonNumber: s.seasonNumber,
        calendarWeek: week,
        careerStart: s.careerStart,
        role: s.role,
      })
    : 0;
  console.log('favourite first-team S1 week', week, 'value', value, 'cup', s.seasonSim?.europeanStanding?.cup);
  if (value !== YOUTH_MARKET_VALUE) {
    console.error('Favourite first-team Season 1 must show €100k until week 20');
    process.exitCode = 1;
  }
}

store.getState().resetCareer();
store.getState().startFavouritePath('favourite-first-team');
store.getState().chooseFavouriteClub('wolves');
pickNation('brazil');
{
  const s = store.getState();
  console.log('favourite Wolves Brazil', s.seasonSim?.europeanStanding?.cup, s.seasonSim?.internationalPhase, s.seasonSim?.internationalSelected);
  if (s.seasonSim?.europeanStanding?.cup !== 'uecl') {
    console.error('Wolves must start in the Conference League, not the Champions League');
    process.exitCode = 1;
  }
}

console.log('\n--- Renew vs continue without renewing ---');
store.getState().resetCareer();
store.getState().startFavouritePath('favourite-first-team');
store.getState().chooseFavouriteClub('liverpool');
pickNation('england');
{
  const s = store.getState();
  if (!s.currentSeason || !s.clubId) {
    console.error('favourite first-team must have a live season before testing contract renewal');
    process.exitCode = 1;
  } else {
    store.setState({
      currentSeason: {
        ...s.currentSeason,
        goals: 30,
        gamesPlayed: 38,
        leagueGoals: 30,
      },
      seasonsAtCurrentClub: 1,
      contractYearsRemaining: 2,
    });
    store.getState().continueAfterSeason();
    const pending = store.getState().pendingTransfer;
    const renewal = pending?.offers?.find((o) => o.renewal && o.clubId === s.clubId);
    console.log(
      'S1 end renewal',
      Boolean(renewal),
      'years',
      renewal?.contractYears,
      'stay',
      pending?.stay?.contractYearsRemaining,
    );
    const otherWages = (pending?.offers ?? []).filter((o) => !o.renewal).map((o) => o.weeklyWage);
    if (
      !renewal
      || renewal.weeklyWage <= 0
      || !pending?.allowDecline
      || pending.stay?.contractYearsRemaining !== 1
      || otherWages.length === 0
      || otherWages.some((wage) => wage <= 0)
    ) {
      console.error('after Season 1 there must be a current-club salary offer plus other clubs’ wage offers');
      process.exitCode = 1;
    }
    store.getState().resolveTransferChoice(null);
    const stayed = store.getState();
    console.log('S2 after stay-without-renew', stayed.contractYearsRemaining, stayed.phase, stayed.seasonNumber);
    if (stayed.contractYearsRemaining !== 1 || stayed.phase !== 'hub') {
      console.error('continuing without renewing must leave 1 year on the existing deal');
      process.exitCode = 1;
    }
    if (!stayed.currentSeason) {
      console.error('Season 2 must start after staying without a renewal');
      process.exitCode = 1;
    } else {
      store.setState({
        currentSeason: {
          ...stayed.currentSeason,
          goals: 30,
          gamesPlayed: 38,
          leagueGoals: 30,
        },
        seasonsAtCurrentClub: 2,
        contractYearsRemaining: 1,
      });
      store.getState().continueAfterSeason();
      const late = store.getState().pendingTransfer;
      const lateRenewal = late?.offers?.find((o) => o.renewal && o.clubId === stayed.clubId);
      console.log('S2 end renewal', Boolean(lateRenewal), lateRenewal?.contractYears);
      if (!lateRenewal) {
        console.error('the end of Season 2 must still offer a contract renewal');
        process.exitCode = 1;
      } else {
        store.getState().resolveTransferChoice(stayed.clubId);
        const renewed = store.getState();
        console.log('S3 after renew', renewed.contractYearsRemaining);
        if (renewed.contractYearsRemaining !== lateRenewal.contractYears) {
          console.error('accepting the renewal must apply the new contract length');
          process.exitCode = 1;
        }
      }
    }
  }
}

