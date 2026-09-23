import type { SeasonLegacyHighlight } from './legacyRecords';
import { INTERNATIONAL_TOURNAMENTS } from './data/competitions';
import { awardLabels, leagueTrophyLabel } from './honoursDisplay';
import type { Club } from './data/clubs';
import type { SeasonHonours } from './seasonSim';
import type { SeasonRecord } from './types';

export type CareerBeatKind = 'first-cap' | 'first-title' | 'title' | 'sold' | 'record' | 'retirement' | 'award';

export interface CareerBeat {
  kind: CareerBeatKind;
  eyebrow: string;
  headline: string;
  copy: string;
  portrait: 'club' | 'nation' | 'both';
}

const INTERNATIONAL_TROPHY_NAMES = new Set(
  Object.values(INTERNATIONAL_TOURNAMENTS).map((tournament) => tournament.name),
);

/** Club cups and leagues use the club kit; World Cup / Euro / Copa use the nation kit. */
export function portraitForTrophyName(trophyName: string | null | undefined): 'club' | 'nation' {
  if (!trophyName) return 'club';
  return INTERNATIONAL_TROPHY_NAMES.has(trophyName) ? 'nation' : 'club';
}

export function firstCapBeat(nationName: string): CareerBeat {
  return {
    kind: 'first-cap',
    eyebrow: 'First cap',
    headline: `${nationName} call you up`,
    copy: 'The anthem, the shirt, a night that stays. Everything after this is a career.',
    portrait: 'nation',
  };
}

export function titleBeat(trophyName: string, opts?: { first?: boolean }): CareerBeat {
  const first = Boolean(opts?.first);
  return {
    kind: first ? 'first-title' : 'title',
    eyebrow: first ? 'First title' : 'Champions',
    headline: `You won the ${trophyName}`,
    copy: first
      ? 'The first one is the one you remember. The dressing room will never be this new again.'
      : 'Another night that stays. The dressing room is bouncing.',
    portrait: portraitForTrophyName(trophyName),
  };
}

export function firstTitleBeat(trophyName: string): CareerBeat {
  return titleBeat(trophyName, { first: true });
}

export function soldBeat(clubName: string): CareerBeat {
  return {
    kind: 'sold',
    eyebrow: 'Sold',
    headline: `${clubName} are selling you`,
    copy: 'The shirt comes off. What you built there travels with you — the next club is a choice, not a favour.',
    portrait: 'club',
  };
}

export function recordBeat(highlight: SeasonLegacyHighlight, playerName: string): CareerBeat {
  return {
    kind: 'record',
    eyebrow: highlight.kind === 'season' ? 'Season record' : 'All-time record',
    headline: `${playerName} — ${highlight.rankLabel}`,
    copy: `${highlight.title}. ${highlight.subtitle}. A line on the board that used to belong to someone else.`,
    portrait: 'both',
  };
}

const NATION_AWARD = /World Cup|European Championship|Copa América|Gold Cup|Africa Cup|Asian Cup|Nations Cup|Nations League/i;

export function awardBeat(awardName: string, playerName: string, reason?: string | null): CareerBeat {
  const world = /World Player/i.test(awardName);
  return {
    kind: 'award',
    eyebrow: 'Award',
    headline: `${playerName} — ${awardName}`,
    copy: reason?.trim()
      || 'A personal honour written into the season. The table is one thing; this is yours.',
    portrait: world ? 'both' : NATION_AWARD.test(awardName) ? 'nation' : 'club',
  };
}

export function seasonAwardBeats(season: SeasonRecord, playerName: string): CareerBeat[] {
  const names = [
    ...awardLabels(season),
    ...(season.wonWpy ? ['World Player of the Year'] : []),
  ];
  return names.map((name) => {
    const reason = name === 'League top goalscorer'
      ? season.topGoalscorerReason
      : name === 'League player of the year'
        ? season.playerOfTheYearReason
        : name === 'World Player of the Year'
          ? season.wpyReason
          : null;
    return awardBeat(name, playerName, reason);
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
  },
): CareerBeat[] {
  let next = pending ?? [];
  for (const beat of seasonAwardBeats(args.season, args.playerName)) {
    next = pushCareerBeat(next, seen, beat);
  }
  for (const highlight of args.outrightRecords) {
    next = pushCareerBeat(next, seen, recordBeat(highlight, args.playerName));
  }
  if (args.soldClubName) {
    next = pushCareerBeat(next, seen, soldBeat(args.soldClubName));
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

const ONCE_BEATS: CareerBeatKind[] = ['first-cap', 'first-title', 'retirement'];

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

/** Repeatable league-win beat. The first career title still uses first-title. */
export function enqueueLeagueTitleBeat(
  pending: CareerBeat[] | null | undefined,
  seen: CareerBeatKind[] | null | undefined,
  honours: SeasonHonours | null | undefined,
  club: Club | undefined,
  league: string | null | undefined,
  seasonHistory: { trophies?: string[] }[],
): CareerBeat[] {
  if (!honours?.leagueChampion || !club) return pending ?? [];
  const name = leagueTrophyLabel(club, league);
  const first =
    !careerHadTrophies(seasonHistory)
    && !(seen ?? []).includes('first-title')
    && !(pending ?? []).some((item) => item.kind === 'first-title');
  return pushCareerBeat(pending, seen, titleBeat(name, { first }));
}
