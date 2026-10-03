import { awardClass, awardCopyFor, recordCopy, scoredWinningGoal, titleCopyFor, tournamentWinFlavour, trophyClass } from '../src/game/career/careerBeatCopy';
import { positionZone } from '../src/game/career/leagueTableZones';
import { awardBeat, enqueueMatchMilestones, enqueueValueMilestoneBeats, firstCapBeat, firstTitleBeat, impactRoleBeat, recordBeat, signedClubBeat, titleBeat } from '../src/game/career/careerBeat';

function assert(cond: boolean, message: string) {
  if (!cond) {
    console.error(message);
    process.exitCode = 1;
  }
}

assert(positionZone({ kind: 'league', league: 'Premier League' }, 1, 20) === 'champions', 'PL 1 is CL blue');
assert(positionZone({ kind: 'league', league: 'Premier League' }, 4, 20) === 'champions', 'PL 4 is CL blue');
assert(positionZone({ kind: 'league', league: 'Premier League' }, 5, 20) === 'europe', 'PL 5 is Europa orange');
assert(positionZone({ kind: 'league', league: 'Premier League' }, 6, 20) === 'europe', 'PL 6 is ECL orange');
assert(positionZone({ kind: 'league', league: 'Premier League' }, 18, 20) === 'relegation', 'PL 18 is relegation');
assert(positionZone({ kind: 'league', league: 'Premier League' }, 20, 20) === 'relegation', 'PL 20 is relegation');
assert(positionZone({ kind: 'league', league: 'Premier League' }, 10, 20) === null, 'PL mid-table is unzoned');
assert(positionZone({ kind: 'league', league: 'La Liga' }, 6, 20) === 'europe', 'La Liga 6 is EL');
assert(positionZone({ kind: 'league', league: 'La Liga' }, 7, 20) === 'europe', 'La Liga 7 is ECL');
assert(positionZone({ kind: 'league', league: 'Bundesliga' }, 16, 18) === 'relegation', 'Bundesliga last 3 are red');
assert(positionZone({ kind: 'league', league: 'Championship' }, 1, 24) === 'champions', 'Championship 1 is promotion');
assert(positionZone({ kind: 'league', league: 'Championship' }, 5, 24) === 'europe', 'Championship 5 is playoff');
assert(positionZone({ kind: 'league', league: 'Championship' }, 22, 24) === 'relegation', 'Championship 22 is relegation');
assert(positionZone({ kind: 'mls-conference' }, 3, 14) === 'champions', 'MLS 1-4 playoff');
assert(positionZone({ kind: 'mls-conference' }, 6, 14) === 'europe', 'MLS 5-6 wild card');
assert(positionZone({ kind: 'mls-conference' }, 12, 14) === null, 'MLS has no relegation bar');
assert(positionZone({ kind: 'argentina-group' }, 8, 15) === 'champions', 'Argentina top 8 knockout');
assert(positionZone({ kind: 'europe', cup: 'ucl' }, 8, 36) === 'champions', 'UCL 1-8 automatic');
assert(positionZone({ kind: 'europe', cup: 'ucl' }, 24, 36) === 'europe', 'UCL 9-24 playoff');
assert(positionZone({ kind: 'intl-group' }, 2, 4) === 'champions', 'intl top 2 qualify');

assert(trophyClass('Spanish League') === 'league', 'league class');
assert(trophyClass('Spanish Cup') === 'cup', 'cup class');
assert(trophyClass('German Super Cup') === 'super-cup', 'domestic super cup class');
assert(trophyClass('European Super Cup') === 'super-cup', 'european super cup class');
assert(titleCopyFor('super-cup', true).includes('cabinet'), 'super cup copy is measured');
assert(!titleCopyFor('super-cup', true).includes('confetti'), 'super cup must not reuse knockout cup copy');
assert(trophyClass('European Cup') === 'continental', 'continental class');
assert(trophyClass('World Championship') === 'world', 'world class');
assert(trophyClass('European Nations Cup') === 'euro', 'euro class');
assert(trophyClass('Nations Cup') === 'nations-league', 'nations class');
assert(titleCopyFor('league', true).includes('podium'), 'first league copy');
assert(titleCopyFor('league', false).includes('Another winter'), 'repeat league copy');
assert(titleCopyFor('world', true).includes('World Championship'), 'first WC copy');
assert(!titleCopyFor('continental', true).includes('pinnacle'), 'Europe is a European competition, not the pinnacle');
assert(titleCopyFor('continental', true).includes('European'), 'Europe trophy names the competition');
assert(awardClass('World Player of the Year') === 'wpy', 'WPY class');
assert(awardClass('World Championship top goalscorer') === 'world-boot', 'WC boot is not league copy');
assert(awardCopyFor('world-boot', true).includes('World Championship'), 'WC boot copy is about the tournament');
assert(!awardCopyFor('world-boot', true).includes('dictated'), 'WC boot must not reuse league-player copy');
assert(impactRoleBeat().kind === 'impact-role', 'impact role beat exists');
assert(awardCopyFor('wpy', true).includes('planet earth'), 'first WPY copy');
assert(awardCopyFor('wpy', false).includes('again'), 'repeat WPY copy');
assert(scoredWinningGoal(1, 0, 1, true, false), '1-0 from one goal is the winner');
assert(!scoredWinningGoal(3, 0, 1, true, false), '3-0 with one goal is not the winner');
assert(!scoredWinningGoal(1, 1, 1, true, true), 'penalties are not an open-play winner');

const flavour = tournamentWinFlavour({
  first: true,
  playerGoals: 1,
  winningGoal: false,
  penaltyKick: true,
  penaltyScored: true,
  penaltiesWon: true,
});
assert(flavour?.includes('fifth penalty'), 'winning fifth penalty copy');
const miss = tournamentWinFlavour({
  first: true,
  playerGoals: 0,
  winningGoal: false,
  penaltyKick: true,
  penaltyScored: false,
  penaltiesWon: false,
});
assert(miss?.includes('fifth penalty slips'), 'missed fifth penalty copy');

assert(firstCapBeat('Spain').copy.includes('letter arrived'), 'call-up uses the letter line');
assert(signedClubBeat('Madrid').kind === 'signed', 'signed beat kind');
assert(firstTitleBeat('Spanish League').copy.includes('podium'), 'first league title copy');
assert(titleBeat('Spanish League', { seenMilestones: ['league-medal'] }).copy.includes('Another winter'), 'repeat league title copy');
assert(awardBeat('League top goalscorer', 'Alex').copy.includes('Golden Boot'), 'first golden boot copy');
assert(awardBeat('League top goalscorer', 'Alex', null, ['league-golden-boot']).copy.includes('returns'), 'repeat golden boot copy');

const climb = recordBeat({
  title: 'World Championship',
  subtitle: 'All-time World Championship goals',
  rankLabel: '2nd',
  rank: 2,
  playerGoals: 13,
  kind: 'all-time',
  domain: 'nation',
  group: 'nation',
  recordGoals: 16,
  goalsToRecord: 3,
  id: 'intl-tournament:career:world-cup',
}, 'Alex');
assert(climb.copy.includes('2nd') && climb.copy.includes('3 goal') && climb.copy.includes('World Championship'), `climb copy: ${climb.copy}`);
assert(climb.headline.includes('World Championship'), 'top-ten popup names the record');
const wcHold = recordCopy({
  title: 'World Championship',
  subtitle: 'All-time World Championship goals',
  rankLabel: '1st',
  rank: 1,
  playerGoals: 17,
  kind: 'all-time',
  domain: 'nation',
  group: 'nation',
  id: 'intl-tournament:career:world-cup',
});
assert(wcHold.includes('World Championship'), 'unique WC record line');
assert(!/shatter/i.test(wcHold), 'record copy must not say shattered');
const seasonClimb = recordCopy({
  title: 'Spanish League',
  subtitle: 'Single-season league goals',
  rankLabel: '3rd',
  rank: 3,
  playerGoals: 40,
  kind: 'season',
  domain: 'club',
  group: 'league',
  recordGoals: 47,
  goalsToRecord: 7,
  id: 'league:season:la-liga',
});
assert(seasonClimb.includes('league record'), 'top ten names league vs club vs tournament');
assert(!/from the record/i.test(seasonClimb), 'single-season records must not mention the gap to the record');
const seasonRecordBeat = recordBeat({
  title: 'Spanish League',
  subtitle: 'Single-season league goals',
  rankLabel: '1st',
  rank: 1,
  playerGoals: 50,
  kind: 'season',
  domain: 'club',
  group: 'league',
  id: 'league:season:la-liga',
}, 'Alex');
assert(seasonRecordBeat.recordRank === 1 && seasonRecordBeat.honourName === 'Spanish League', 'outright records carry trophy art');
const valueBeats = enqueueValueMilestoneBeats([], [], 900_000, 12_000_000);
assert(valueBeats.length === 2 && valueBeats[0].kind === 'value-milestone', 'crossing 1m and 10m queues both value popups');

const milestones = enqueueMatchMilestones([], [], {
  clubAppearance: true,
  international: false,
  playerGoals: 3,
  priorClubGames: 0,
  priorClubGoals: 0,
  priorCaps: 0,
  priorIntlGoals: 0,
  nationName: 'Spain',
});
assert(milestones.some((b) => b.kind === 'debut'), 'debut on first club game');
assert(milestones.some((b) => b.kind === 'first-goal'), 'first goal on first club goals');
assert(milestones.some((b) => b.kind === 'hattrick'), 'hat-trick on three goals');

if (process.exitCode) {
  console.error('career ui copy tests failed');
} else {
  console.log('career ui copy tests ok');
}
