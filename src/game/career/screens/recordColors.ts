import { recordColorKind, type LegacyBoardDef, type RecordColorKind } from '../legacyRecords';

export type { RecordColorKind };

export const RECORD_KIND_LABEL: Record<RecordColorKind, string> = {
  club: 'Club',
  internal: 'Domestic',
  tournament: 'Club tournament',
  international: 'International',
};

export const RECORD_KIND_TEXT: Record<RecordColorKind, string> = {
  club: 'text-sky-100',
  internal: 'text-violet-100',
  tournament: 'text-amber-100',
  international: 'text-emerald-100',
};

export const RECORD_KIND_VALUE: Record<RecordColorKind, string> = {
  club: 'text-sky-200',
  internal: 'text-violet-200',
  tournament: 'text-amber-200',
  international: 'text-emerald-200',
};

export const RECORD_KIND_MUTED: Record<RecordColorKind, string> = {
  club: 'text-sky-200/70',
  internal: 'text-violet-200/70',
  tournament: 'text-amber-200/70',
  international: 'text-emerald-200/70',
};

export const RECORD_KIND_CARD: Record<RecordColorKind, string> = {
  club: 'border-sky-300/30 bg-sky-500/10 text-sky-100',
  internal: 'border-violet-300/30 bg-violet-500/10 text-violet-100',
  tournament: 'border-amber-200/30 bg-amber-400/10 text-amber-100',
  international: 'border-emerald-300/30 bg-emerald-500/10 text-emerald-100',
};

export const RECORD_KIND_BADGE: Record<RecordColorKind, string> = {
  club: 'bg-sky-400/20 text-sky-200',
  internal: 'bg-violet-400/20 text-violet-200',
  tournament: 'bg-amber-400/20 text-amber-200',
  international: 'bg-emerald-400/20 text-emerald-200',
};

export function colorKindForDef(def: Pick<LegacyBoardDef, 'group' | 'domain'>): RecordColorKind {
  return recordColorKind(def);
}
