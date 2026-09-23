import type { SeasonLegacyHighlight } from './legacyRecords';

export type CareerBeatKind = 'first-cap' | 'first-title' | 'sold' | 'record' | 'retirement';

export interface CareerBeat {
  kind: CareerBeatKind;
  eyebrow: string;
  headline: string;
  copy: string;
  portrait: 'club' | 'nation' | 'both';
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

export function firstTitleBeat(trophyName: string): CareerBeat {
  return {
    kind: 'first-title',
    eyebrow: 'First title',
    headline: `You won the ${trophyName}`,
    copy: 'The first one is the one you remember. The dressing room will never be this new again.',
    portrait: 'club',
  };
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
    eyebrow: highlight.kind === 'season' ? 'Season record' : 'All-time top 10',
    headline: `${playerName} — ${highlight.rankLabel}`,
    copy: `${highlight.title}. ${highlight.subtitle}. A line on the board that used to belong to someone else.`,
    portrait: 'both',
  };
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
