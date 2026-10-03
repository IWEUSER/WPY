import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from './data/competitions';
import { migrateTrophyName } from './data/displayNames';
import { ordinal, type SeasonLegacyHighlight } from './legacyRecords';

export type CareerMilestoneId =
  | 'signed-club'
  | 'pro-debut'
  | 'first-pro-goal'
  | 'nt-callup'
  | 'intl-debut'
  | 'first-intl-goal'
  | 'first-club-hattrick'
  | 'first-intl-hattrick'
  | 'league-medal'
  | 'cup-medal'
  | 'continental-medal'
  | 'world-championship'
  | 'european-championship'
  | 'nations-league'
  | 'continental-nations'
  | 'league-golden-boot'
  | 'world-golden-boot'
  | 'tournament-golden-boot'
  | 'league-player'
  | 'continental-player'
  | 'world-pott'
  | 'euro-pott'
  | 'nations-pott'
  | 'continental-nations-pott'
  | 'wpy';

export type TrophyClass =
  | 'league'
  | 'cup'
  | 'continental'
  | 'world'
  | 'euro'
  | 'nations-league'
  | 'continental-nations';

export type AwardClass =
  | 'league-boot'
  | 'world-boot'
  | 'tournament-boot'
  | 'league-player'
  | 'continental-player'
  | 'world-pott'
  | 'euro-pott'
  | 'nations-pott'
  | 'continental-nations-pott'
  | 'wpy'
  | 'other';

const FIRST = {
  signed:
    'The ink is dry on your first contract; the academy kit is gone, and the real work begins in the first-team dressing room.',
  debut:
    'You cross the white line as the crowd roars, your childhood dream melting away into 90 minutes of pure reality.',
  firstProGoal:
    'You wheel away in celebration as the stadium erupts—that first touch of the net changes your status forever.',
  callUp:
    'The letter arrived this morning; your country has called, and the weight of an entire nation rests on your shoulders.',
  intlDebut:
    'Standing in line for the national anthem, the crest on your chest feels heavier than any club shirt ever could.',
  firstIntlGoal:
    'A goal for your country—written into the national history books before the echo of the stadium whistle even fades.',
  clubHattrick:
    'Three goals, a masterclass in finishing, and the match ball tucked tightly under your arm to take home.',
  intlHattrick:
    "A hat-trick on the world stage; you didn't just beat the opposition today, you completely dismantled them.",
  league:
    'Through the winter mud and the grueling fixtures, you are finally standing on the podium as a champion.',
  cup: 'A knockout campaign defined by pressure, ending with silver in your hands and confetti in the air.',
  continental:
    'A European night, a European trophy; you have won a continental club competition and put your name on it.',
  world: 'The ultimate glory, immortalized on earth; you have won the World Championship and touched footballing heaven.',
  euro: 'The kings of Europe—you survived the toughest tournament grid in the world to claim continental crown rule.',
  nationsLeague:
    'From an elite testing ground to absolute victory, you take home the modern crown of international dominance.',
  continentalNations:
    'A continent on your shoulders, a medal on your chest; this is the night your nation will tell for decades.',
  leagueBoot:
    "The Golden Boot is yours; the league's defenders spent a season trying to stop you, and every single one failed.",
  worldBoot:
    'The Golden Boot at the World Championship — most goals at the tournament, not a league season dressed up as something else.',
  tournamentBoot:
    'You finished as the tournament’s top goalscorer. This award is the finishing chart, not a league title by another name.',
  leaguePlayer:
    "The undivided respect of your peers—you didn't just play in the league this year, you completely dictated it.",
  continentalPlayer:
    'The brightest star on the biggest European nights; an individual masterclass against the global elite.',
  worldPott: 'A tournament defined by your individual genius, carrying your nation through the fire to absolute history.',
  euroPott: 'Europe’s finest nights belonged to you; the tournament had one name on it from the first whistle.',
  nationsPott: 'You were the difference in every round; the Nations Cup had a player, and that player was you.',
  continentalNationsPott:
    'A tournament defined by your individual genius, carrying your nation through the fire to absolute history.',
  wpy: 'The debate is officially over; look at the trophy in your hands—you are the best football player on planet earth.',
  scoredInFinal: 'A champion’s contribution—your goal on the big stage paved the definitive path to lifting the trophy.',
  winningGoal: 'The history-maker; your decisive strike broke the deadlock and single-handedly won the championship trophy.',
  winningPen:
    'The coolest head in the stadium; you stepped up under immense pressure for the fifth penalty and secured the trophy.',
  missedPen:
    'A heartbreaking twist of fate; the fifth penalty slips away, leaving a cruel reminder of how thin the margins are.',
} as const;

const AGAIN = {
  league:
    'Another winter, another podium. The dressing room knows this feeling now — and they still never get tired of it.',
  cup: 'Another knockout run, another night of silver; you make winning cups look like a habit.',
  continental:
    'Another European trophy. The continent still has to play you, and you still win those nights.',
  world: 'Back on top of the world. Dynasties are built on nights like this, and yours is still being written.',
  euro: 'Europe bows twice. You walked the same brutal grid and came home with the crown again.',
  nationsLeague:
    'The modern international crown sits on your head once more. Dominance, not a one-off.',
  continentalNations:
    'Your nation lifts it again, and your name is in the middle of the pile of medals.',
  leagueBoot:
    'The Golden Boot returns to you. Defenders had a whole season to learn, and they still could not live with you.',
  worldBoot:
    'The World Championship Golden Boot is yours again. Same tournament, same finishing chart, another top mark.',
  tournamentBoot:
    'Tournament top goalscorer again. The chart still has your name at the top.',
  leaguePlayer:
    'Voted the best in the league again. When the votes come in, there is only one column that matters.',
  continentalPlayer:
    'The continent’s nights still bend to you. Another personal honour on the biggest club stage.',
  worldPott: 'The world’s tournament, your tournament — again. History does not usually repeat this cleanly.',
  euroPott: 'Europe’s player of the tournament, twice over. The rest of the grid was playing for second.',
  nationsPott: 'You owned the Nations Cup again. Same shirt, same gravity, another golden night.',
  continentalNationsPott:
    'Your continent still looks to you when the tournament tightens. Another personal crown.',
  wpy: 'The planet’s best, confirmed again. The debate did not even last until winter.',
  scoredInFinal: 'You found the net again on the biggest night; champions do that.',
  winningGoal: 'Once more the decisive boot. The trophy was waiting on your strike.',
  winningPen: 'Ice in the veins, again. The fifth penalty, the trophy, the same cool head.',
  missedPen: 'The fifth kick slips away. At this level the margins stay cruel, even for you.',
} as const;

const CONTINENTAL_NAMES = new Set(Object.values(CONTINENTAL_CUPS).map((cup) => cup.name));
const DOMESTIC_CUP_NAMES = new Set(Object.values(DOMESTIC_CUPS).map((cup) => cup.name));
const INTL_BY_NAME = new Map(Object.values(INTERNATIONAL_TOURNAMENTS).map((cup) => [cup.name, cup.id]));

export function trophyClass(trophyName: string | null | undefined): TrophyClass {
  const name = migrateTrophyName(trophyName ?? '');
  const intlId = INTL_BY_NAME.get(name) ?? INTL_BY_NAME.get(trophyName ?? '');
  if (intlId === 'world-cup') return 'world';
  if (intlId === 'euro') return 'euro';
  if (intlId === 'nations-league') return 'nations-league';
  if (intlId) return 'continental-nations';
  if (CONTINENTAL_NAMES.has(name) || CONTINENTAL_NAMES.has(trophyName ?? '')) return 'continental';
  if (
    DOMESTIC_CUP_NAMES.has(name)
    || DOMESTIC_CUP_NAMES.has(trophyName ?? '')
    || /Super Cup|super cup/i.test(name)
  ) {
    return 'cup';
  }
  return 'league';
}

export function trophyMilestoneId(klass: TrophyClass): CareerMilestoneId {
  switch (klass) {
    case 'league':
      return 'league-medal';
    case 'cup':
      return 'cup-medal';
    case 'continental':
      return 'continental-medal';
    case 'world':
      return 'world-championship';
    case 'euro':
      return 'european-championship';
    case 'nations-league':
      return 'nations-league';
    case 'continental-nations':
      return 'continental-nations';
  }
}

export function awardClass(awardName: string): AwardClass {
  if (/World Player of the Year/i.test(awardName)) return 'wpy';
  if (/League top goalscorer/i.test(awardName)) return 'league-boot';
  if (/top goalscorer/i.test(awardName)) {
    if (/World Championship|World Cup/i.test(awardName)) return 'world-boot';
    return 'tournament-boot';
  }
  if (/League player of the year/i.test(awardName)) return 'league-player';
  if (/Player of the Tournament/i.test(awardName)) {
    if (/World Championship|World Cup/i.test(awardName)) return 'world-pott';
    if (/European Nations Cup|European Championship/i.test(awardName)) return 'euro-pott';
    if (/Nations Cup|Nations League/i.test(awardName)) return 'nations-pott';
    if (
      /South American|North American|African|Asian|Oceania|Copa|Gold Cup|AFCON|continental/i.test(
        awardName,
      )
    ) {
      return 'continental-nations-pott';
    }
    if (/European Cup|Asian Club|South American Cup|Continental/i.test(awardName)) {
      return 'continental-player';
    }
    return 'continental-nations-pott';
  }
  if (/European Cup|Asian Club|South American Cup/.test(awardName) && /top goalscorer/i.test(awardName)) {
    return 'continental-player';
  }
  return 'other';
}

export function awardMilestoneId(klass: AwardClass): CareerMilestoneId | null {
  switch (klass) {
    case 'league-boot':
      return 'league-golden-boot';
    case 'world-boot':
      return 'world-golden-boot';
    case 'tournament-boot':
      return 'tournament-golden-boot';
    case 'league-player':
      return 'league-player';
    case 'continental-player':
      return 'continental-player';
    case 'world-pott':
      return 'world-pott';
    case 'euro-pott':
      return 'euro-pott';
    case 'nations-pott':
      return 'nations-pott';
    case 'continental-nations-pott':
      return 'continental-nations-pott';
    case 'wpy':
      return 'wpy';
    default:
      return null;
  }
}

export function hasMilestone(
  seen: readonly string[] | null | undefined,
  id: CareerMilestoneId | null | undefined,
): boolean {
  if (!id) return false;
  return (seen ?? []).includes(id);
}

export function signedCopy(): string {
  return FIRST.signed;
}

export function debutCopy(): string {
  return FIRST.debut;
}

export function firstProGoalCopy(): string {
  return FIRST.firstProGoal;
}

export function callUpCopy(): string {
  return FIRST.callUp;
}

export function intlDebutCopy(): string {
  return FIRST.intlDebut;
}

export function firstIntlGoalCopy(): string {
  return FIRST.firstIntlGoal;
}

export function clubHattrickCopy(): string {
  return FIRST.clubHattrick;
}

export function intlHattrickCopy(): string {
  return FIRST.intlHattrick;
}

export function titleCopyFor(klass: TrophyClass, first: boolean): string {
  if (first) {
    switch (klass) {
      case 'league':
        return FIRST.league;
      case 'cup':
        return FIRST.cup;
      case 'continental':
        return FIRST.continental;
      case 'world':
        return FIRST.world;
      case 'euro':
        return FIRST.euro;
      case 'nations-league':
        return FIRST.nationsLeague;
      case 'continental-nations':
        return FIRST.continentalNations;
    }
  }
  switch (klass) {
    case 'league':
      return AGAIN.league;
    case 'cup':
      return AGAIN.cup;
    case 'continental':
      return AGAIN.continental;
    case 'world':
      return AGAIN.world;
    case 'euro':
      return AGAIN.euro;
    case 'nations-league':
      return AGAIN.nationsLeague;
    case 'continental-nations':
      return AGAIN.continentalNations;
  }
}

export function awardCopyFor(klass: AwardClass, first: boolean, fallback?: string | null): string {
  if (klass === 'other') return fallback?.trim() || FIRST.leaguePlayer;
  if (first) {
    switch (klass) {
      case 'league-boot':
        return FIRST.leagueBoot;
      case 'world-boot':
        return FIRST.worldBoot;
      case 'tournament-boot':
        return FIRST.tournamentBoot;
      case 'league-player':
        return FIRST.leaguePlayer;
      case 'continental-player':
        return FIRST.continentalPlayer;
      case 'world-pott':
        return FIRST.worldPott;
      case 'euro-pott':
        return FIRST.euroPott;
      case 'nations-pott':
        return FIRST.nationsPott;
      case 'continental-nations-pott':
        return FIRST.continentalNationsPott;
      case 'wpy':
        return FIRST.wpy;
    }
  }
  switch (klass) {
    case 'league-boot':
      return AGAIN.leagueBoot;
    case 'world-boot':
      return AGAIN.worldBoot;
    case 'tournament-boot':
      return AGAIN.tournamentBoot;
    case 'league-player':
      return AGAIN.leaguePlayer;
    case 'continental-player':
      return AGAIN.continentalPlayer;
    case 'world-pott':
      return AGAIN.worldPott;
    case 'euro-pott':
      return AGAIN.euroPott;
    case 'nations-pott':
      return AGAIN.nationsPott;
    case 'continental-nations-pott':
      return AGAIN.continentalNationsPott;
    case 'wpy':
      return AGAIN.wpy;
  }
}

export function scoredWinningGoal(
  scoreFor: number,
  scoreAgainst: number,
  playerGoals: number,
  won: boolean,
  onPenalties: boolean,
): boolean {
  if (!won || onPenalties || playerGoals <= 0) return false;
  return scoreFor - playerGoals <= scoreAgainst;
}

export function tournamentWinFlavour(opts: {
  first: boolean;
  playerGoals: number;
  winningGoal: boolean;
  penaltyKick: boolean;
  penaltyScored: boolean;
  penaltiesWon: boolean | null;
}): string | null {
  if (opts.penaltyKick) {
    if (opts.penaltyScored && opts.penaltiesWon) {
      return opts.first ? FIRST.winningPen : AGAIN.winningPen;
    }
    if (!opts.penaltyScored && opts.penaltiesWon === false) {
      return opts.first ? FIRST.missedPen : AGAIN.missedPen;
    }
  }
  if (opts.winningGoal) return opts.first ? FIRST.winningGoal : AGAIN.winningGoal;
  if (opts.playerGoals > 0 && !opts.penaltyKick) {
    return opts.first ? FIRST.scoredInFinal : AGAIN.scoredInFinal;
  }
  return null;
}

export function penaltyOutcomeCopy(opts: {
  penaltyKick: boolean;
  penaltyScored: boolean;
  penaltiesWon: boolean | null;
  first?: boolean;
}): string | null {
  if (!opts.penaltyKick || opts.penaltiesWon == null) return null;
  const first = opts.first !== false;
  if (opts.penaltyScored && opts.penaltiesWon) return first ? FIRST.winningPen : AGAIN.winningPen;
  if (!opts.penaltyScored && !opts.penaltiesWon) return first ? FIRST.missedPen : AGAIN.missedPen;
  if (opts.penaltyScored && !opts.penaltiesWon) {
    return 'You converted the fifth penalty, but the shootout still slipped away.';
  }
  return 'The fifth penalty missed, yet the night somehow still broke your way.';
}

export function recordScopeLabel(highlight: Pick<SeasonLegacyHighlight, 'group' | 'domain' | 'id'>): string {
  const id = highlight.id ?? '';
  if (id.startsWith('continental:') || highlight.group === 'continental') return 'club tournament record';
  if (id.startsWith('intl-tournament:') || highlight.group === 'nation' || highlight.domain === 'nation') {
    return 'tournament record';
  }
  if (highlight.group === 'league') return 'league record';
  if (highlight.group === 'cup') return 'cup record';
  return 'club record';
}

function recordBoardCopy(highlight: SeasonLegacyHighlight): string | null {
  const id = highlight.id ?? '';
  const title = `${highlight.title} ${highlight.subtitle}`.toLowerCase();
  if (highlight.rank !== 1) return null;
  if (id.includes('intl-tournament:career:world-cup') || /world championship.*all-time/.test(title)) {
    return 'You now hold the World Championship all-time tournament record — the most goals in World Championship history.';
  }
  if (id.includes('intl-tournament:season:world-cup') || /world championship.*single/.test(title)) {
    return 'You now hold the World Championship single-campaign tournament record — the most goals in one World Championship.';
  }
  if (id.includes('continental:career:ucl') || /european cup.*all-time/.test(title)) {
    return 'You now hold the European Cup club tournament record — the most goals in the history of that competition.';
  }
  if (id.includes('league:') && highlight.kind === 'season' && /single-season league/.test(title)) {
    return `You now hold the ${highlight.title} league record for a single season.`;
  }
  if (id.startsWith('nation-overall:') || /all-time international goals/.test(title)) {
    return "You now hold your nation's all-time international scoring record.";
  }
  if (/international caps|appearances/.test(title)) {
    return 'You now hold the tournament record for international appearances.';
  }
  return null;
}

export function recordCopy(highlight: SeasonLegacyHighlight): string {
  const scope = recordScopeLabel(highlight);
  const board = `${highlight.title} — ${highlight.subtitle}`;
  if (highlight.rank === 1) {
    return recordBoardCopy(highlight) ?? `You now hold the ${scope}: ${board}.`;
  }
  const recordGoals = highlight.recordGoals ?? 0;
  const gap = highlight.goalsToRecord ?? Math.max(0, recordGoals - highlight.playerGoals);
  const place = highlight.rankLabel || ordinal(highlight.rank);
  if (gap <= 0) {
    return `You are now ${place} on the ${scope} (${board}), level with the historic mark.`;
  }
  return `You are now ${place} on the ${scope} (${board}) — ${gap} goal${gap === 1 ? '' : 's'} from the record.`;
}
