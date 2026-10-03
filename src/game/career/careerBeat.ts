import type { SeasonLegacyHighlight } from './legacyRecords';
import { INTERNATIONAL_TOURNAMENTS } from './data/competitions';
import { migrateTrophyName } from './data/displayNames';
import { awardLabels, leagueTrophyLabel } from './honoursDisplay';
import type { Club } from './data/clubs';
import type { SeasonHonours } from './seasonSim';
import type { SeasonRecord } from './types';
import {
  awardClass,
  awardCopyFor,
  awardMilestoneId,
  callUpCopy,
  clubHattrickCopy,
  debutCopy,
  firstIntlGoalCopy,
  firstProGoalCopy,
  hasMilestone,
  intlDebutCopy,
  intlHattrickCopy,
  recordCopy,
  signedCopy,
  titleCopyFor,
  trophyClass,
  trophyMilestoneId,
  type CareerMilestoneId,
} from './careerBeatCopy';

export type CareerBeatKind =
  | 'first-cap'
  | 'tournament-callup'
  | 'first-title'
  | 'title'
  | 'sold'
  | 'record'
  | 'retirement'
  | 'award'
  | 'signed'
  | 'debut'
  | 'first-goal'
  | 'intl-debut'
  | 'first-intl-goal'
  | 'hattrick'
  | 'intl-hattrick'
  | 'impact-role';

export interface CareerBeat {
  kind: CareerBeatKind;
  eyebrow: string;
  headline: string;
  copy: string;
  portrait: 'club' | 'nation' | 'both';
  /** Trophy or award name used to pick the honour illustration. */
  honourName?: string;
  /** First-time milestone so later trophies/awards can use the thereafter line. */
  milestoneId?: CareerMilestoneId;
}

const INTERNATIONAL_TROPHY_NAMES = new Set(
  Object.values(INTERNATIONAL_TOURNAMENTS).map((tournament) => tournament.name),
);

/** Club cups and leagues use the club kit; World Cup / Euro / Copa use the nation kit. */
export function portraitForTrophyName(trophyName: string | null | undefined): 'club' | 'nation' {
  if (!trophyName) return 'club';
  const migrated = migrateTrophyName(trophyName);
  return INTERNATIONAL_TROPHY_NAMES.has(trophyName) || INTERNATIONAL_TROPHY_NAMES.has(migrated) ? 'nation' : 'club';
}

export function signedClubBeat(clubName: string): CareerBeat {
  return {
    kind: 'signed',
    eyebrow: 'First contract',
    headline: `${clubName} sign you`,
    copy: signedCopy(),
    portrait: 'club',
    milestoneId: 'signed-club',
  };
}

export function impactRoleBeat(): CareerBeat {
  return {
    kind: 'impact-role',
    eyebrow: 'Impact',
    headline: 'You move into an Impact role',
    copy: 'The manager has seen enough. You are no longer waiting on the fringe — you are in the side to change matches.',
    portrait: 'club',
  };
}

export function debutBeat(): CareerBeat {
  return {
    kind: 'debut',
    eyebrow: 'Debut',
    headline: 'Professional debut',
    copy: debutCopy(),
    portrait: 'club',
    milestoneId: 'pro-debut',
  };
}

export function firstGoalBeat(): CareerBeat {
  return {
    kind: 'first-goal',
    eyebrow: 'First goal',
    headline: 'Your first professional goal',
    copy: firstProGoalCopy(),
    portrait: 'club',
    milestoneId: 'first-pro-goal',
  };
}

export function firstCapBeat(nationName: string): CareerBeat {
  return {
    kind: 'first-cap',
    eyebrow: 'Call-up',
    headline: `${nationName} call you up`,
    copy: callUpCopy(),
    portrait: 'nation',
    milestoneId: 'nt-callup',
  };
}

export function intlDebutBeat(nationName: string): CareerBeat {
  return {
    kind: 'intl-debut',
    eyebrow: 'International debut',
    headline: `You debut for ${nationName}`,
    copy: intlDebutCopy(),
    portrait: 'nation',
    milestoneId: 'intl-debut',
  };
}

export function firstIntlGoalBeat(nationName: string): CareerBeat {
  return {
    kind: 'first-intl-goal',
    eyebrow: 'International goal',
    headline: `Your first goal for ${nationName}`,
    copy: firstIntlGoalCopy(),
    portrait: 'nation',
    milestoneId: 'first-intl-goal',
  };
}

export function clubHattrickBeat(): CareerBeat {
  return {
    kind: 'hattrick',
    eyebrow: 'Hat-trick',
    headline: 'A hat-trick, and the match ball',
    copy: clubHattrickCopy(),
    portrait: 'club',
    milestoneId: 'first-club-hattrick',
  };
}

export function intlHattrickBeat(): CareerBeat {
  return {
    kind: 'intl-hattrick',
    eyebrow: 'International hat-trick',
    headline: 'A hat-trick on the world stage',
    copy: intlHattrickCopy(),
    portrait: 'nation',
    milestoneId: 'first-intl-hattrick',
  };
}

export function tournamentCallUpBeat(nationName: string, tournamentName: string): CareerBeat {
  return {
    kind: 'tournament-callup',
    eyebrow: 'Tournament squad',
    headline: `${nationName} name you in the ${tournamentName} squad`,
    copy: 'The finals start here. The shirt is the same — the nights are not.',
    portrait: 'nation',
  };
}

export function titleBeat(
  trophyName: string,
  opts?: { first?: boolean; seenMilestones?: readonly string[] | null },
): CareerBeat {
  const klass = trophyClass(trophyName);
  const milestoneId = trophyMilestoneId(klass);
  const firstCategory = !hasMilestone(opts?.seenMilestones, milestoneId);
  const firstCareerTitle = Boolean(opts?.first);
  return {
    kind: firstCareerTitle ? 'first-title' : 'title',
    eyebrow: firstCareerTitle ? 'First title' : firstCategory ? 'First of its kind' : 'Champions',
    headline: `You won the ${trophyName}`,
    copy: titleCopyFor(klass, firstCategory),
    portrait: portraitForTrophyName(trophyName),
    honourName: trophyName,
    milestoneId,
  };
}

export function firstTitleBeat(trophyName: string, seenMilestones?: readonly string[] | null): CareerBeat {
  return titleBeat(trophyName, { first: true, seenMilestones });
}

export function soldBeat(clubName: string, opts?: { freeAgent?: boolean }): CareerBeat {
  if (opts?.freeAgent) {
    return {
      kind: 'sold',
      eyebrow: 'Free agent',
      headline: `${clubName} will not review your contract`,
      copy: 'You are now a free agent.',
      portrait: 'club',
    };
  }
  return {
    kind: 'sold',
    eyebrow: 'Sold',
    headline: `${clubName} are selling you`,
    copy: '',
    portrait: 'club',
  };
}

export function recordBeat(highlight: SeasonLegacyHighlight, _playerName: string): CareerBeat {
  const holder = highlight.rank === 1;
  return {
    kind: 'record',
    eyebrow: holder
      ? highlight.kind === 'season' ? 'Season record' : 'All-time record'
      : highlight.kind === 'season' ? 'Season chart' : 'All-time chart',
    headline: `${highlight.title} — ${highlight.rankLabel}`,
    copy: recordCopy(highlight),
    portrait: highlight.domain === 'nation' ? 'nation' : 'club',
  };
}

const NATION_AWARD = /World Championship|World Cup|European Nations Cup|European Championship|South American Championship|Copa Am[eé]rica|North American Championship|Gold Cup|African Championship|Africa Cup|Asian Championship|Asian Cup|Oceania Championship|Nations Cup|Nations League/i;

export function awardBeat(
  awardName: string,
  playerName: string,
  reason?: string | null,
  seenMilestones?: readonly string[] | null,
): CareerBeat {
  const world = /World Player/i.test(awardName);
  const klass = awardClass(awardName);
  const milestoneId = awardMilestoneId(klass);
  const first = !hasMilestone(seenMilestones, milestoneId);
  return {
    kind: 'award',
    eyebrow: first ? 'Award' : 'Award again',
    headline: `${playerName} — ${awardName}`,
    copy: awardCopyFor(klass, first, reason),
    portrait: world ? 'both' : NATION_AWARD.test(awardName) ? 'nation' : 'club',
    honourName: awardName,
    milestoneId: milestoneId ?? undefined,
  };
}

export function seasonAwardBeats(
  season: SeasonRecord,
  playerName: string,
  seenMilestones?: readonly string[] | null,
): CareerBeat[] {
  const names = [
    ...awardLabels(season),
    ...(season.wonWpy ? ['World Player of the Year'] : []),
  ];
  const seen = [...(seenMilestones ?? [])];
  return names.map((name) => {
    const reason = name === 'League top goalscorer'
      ? season.topGoalscorerReason
      : name === 'League player of the year'
        ? season.playerOfTheYearReason
        : name === 'World Player of the Year'
          ? season.wpyReason
          : null;
    const beat = awardBeat(name, playerName, reason, seen);
    if (beat.milestoneId && !seen.includes(beat.milestoneId)) seen.push(beat.milestoneId);
    return beat;
  });
}

export function enqueueEndOfSeasonBeats(
  pending: CareerBeat[] | null | undefined,
  seen: CareerBeatKind[] | null | undefined,
  args: {
    season: SeasonRecord;
    playerName: string;
    outrightRecords: SeasonLegacyHighlight[];
    soldClubName?: string | null;
    soldFreeAgent?: boolean;
    seenMilestones?: readonly string[] | null;
  },
): CareerBeat[] {
  let next = pending ?? [];
  for (const beat of seasonAwardBeats(args.season, args.playerName, args.seenMilestones)) {
    next = pushCareerBeat(next, seen, beat);
  }
  for (const highlight of args.outrightRecords) {
    next = pushCareerBeat(next, seen, recordBeat(highlight, args.playerName));
  }
  if (args.soldClubName) {
    next = pushCareerBeat(next, seen, soldBeat(args.soldClubName, { freeAgent: args.soldFreeAgent }));
  }
  return next;
}

export function retirementBeat(playerName: string, clubName: string | null): CareerBeat {
  return {
    kind: 'retirement',
    eyebrow: 'Season 20',
    headline: `${playerName} hangs the boots up`,
    copy: clubName
      ? `Twenty seasons. ${clubName} was the last stop. The career is the nights that stuck, not the table.`
      : 'Twenty seasons. The career is the nights that stuck, not the table.',
    portrait: 'both',
  };
}

export function careerHadTrophies(seasons: { trophies?: string[] }[]): boolean {
  return seasons.some((season) => (season.trophies?.length ?? 0) > 0);
}

const ONCE_BEATS: CareerBeatKind[] = [
  'first-cap',
  'first-title',
  'retirement',
  'signed',
  'debut',
  'first-goal',
  'intl-debut',
  'first-intl-goal',
  'hattrick',
  'intl-hattrick',
  'impact-role',
];

export function pushCareerBeat(
  pending: CareerBeat[] | null | undefined,
  seen: CareerBeatKind[] | null | undefined,
  beat: CareerBeat,
): CareerBeat[] {
  const queue = pending ?? [];
  if (ONCE_BEATS.includes(beat.kind)) {
    if ((seen ?? []).includes(beat.kind) || queue.some((item) => item.kind === beat.kind)) {
      return queue;
    }
  }
  return [...queue, beat];
}

export function enqueueMatchMilestones(
  pending: CareerBeat[] | null | undefined,
  seen: CareerBeatKind[] | null | undefined,
  args: {
    clubAppearance: boolean;
    international: boolean;
    playerGoals: number;
    priorClubGames: number;
    priorClubGoals: number;
    priorCaps: number;
    priorIntlGoals: number;
    nationName: string;
  },
): CareerBeat[] {
  let next = pending ?? [];
  if (args.clubAppearance && args.priorClubGames === 0) {
    next = pushCareerBeat(next, seen, debutBeat());
  }
  if (args.clubAppearance && args.playerGoals > 0 && args.priorClubGoals === 0) {
    next = pushCareerBeat(next, seen, firstGoalBeat());
  }
  if (args.clubAppearance && args.playerGoals >= 3) {
    next = pushCareerBeat(next, seen, clubHattrickBeat());
  }
  if (args.international && args.priorCaps === 0) {
    next = pushCareerBeat(next, seen, intlDebutBeat(args.nationName));
  }
  if (args.international && args.playerGoals > 0 && args.priorIntlGoals === 0) {
    next = pushCareerBeat(next, seen, firstIntlGoalBeat(args.nationName));
  }
  if (args.international && args.playerGoals >= 3) {
    next = pushCareerBeat(next, seen, intlHattrickBeat());
  }
  return next;
}

/** Repeatable league-win beat. The first career title still uses first-title. */
export function enqueueLeagueTitleBeat(
  pending: CareerBeat[] | null | undefined,
  seen: CareerBeatKind[] | null | undefined,
  honours: SeasonHonours | null | undefined,
  club: Club | undefined,
  league: string | null | undefined,
  seasonHistory: { trophies?: string[] }[],
  seenMilestones?: readonly string[] | null,
): CareerBeat[] {
  if (!honours?.leagueChampion || !club) return pending ?? [];
  const name = leagueTrophyLabel(club, league);
  const first =
    !careerHadTrophies(seasonHistory)
    && !(seen ?? []).includes('first-title')
    && !(pending ?? []).some((item) => item.kind === 'first-title');
  return pushCareerBeat(pending, seen, titleBeat(name, { first, seenMilestones }));
}

export function markMilestone(
  seen: readonly string[] | null | undefined,
  id: CareerMilestoneId | null | undefined,
): string[] {
  const next = [...(seen ?? [])];
  if (id && !next.includes(id)) next.push(id);
  return next;
}
