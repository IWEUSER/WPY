import { recordColorKind, type LegacyBoardDef, type RecordColorKind } from '../legacyRecords';

export type { RecordColorKind };

export const RECORD_KIND_LABEL: Record<RecordColorKind, string> = {
  club: 'Club',
  internal: 'Domestic',
  tournament: 'Tournament',
  international: 'International',
};

export const RECORD_KIND_TEXT: Record<RecordColorKind, string> = {
  club: 'text-sky-100',
  internal: 'text-violet-100',
  tournament: 'text-rose-100',
  international: 'text-emerald-100',
};

export const RECORD_KIND_VALUE: Record<RecordColorKind, string> = {
  club: 'text-sky-200',
  internal: 'text-violet-200',
  tournament: 'text-rose-200',
  international: 'text-emerald-200',
};

export const RECORD_KIND_MUTED: Record<RecordColorKind, string> = {
  club: 'text-sky-200/70',
  internal: 'text-violet-200/70',
  tournament: 'text-rose-200/70',
  international: 'text-emerald-200/70',
};

export const RECORD_KIND_CARD: Record<RecordColorKind, string> = {
  club: 'border-sky-300/30 bg-sky-500/10 text-sky-100',
  internal: 'border-violet-300/30 bg-violet-500/10 text-violet-100',
  tournament: 'border-rose-300/45 bg-rose-500/15 text-rose-100',
  international: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
};

export const RECORD_KIND_BADGE: Record<RecordColorKind, string> = {
  club: 'bg-sky-400/20 text-sky-200',
  internal: 'bg-violet-400/20 text-violet-200',
  tournament: 'bg-rose-400/25 text-rose-100',
  international: 'bg-emerald-400/20 text-emerald-200',
};

export function colorKindForDef(
  def: Pick<LegacyBoardDef, 'group' | 'domain'> & { id?: string },
): RecordColorKind {
  return recordColorKind(def);
}
