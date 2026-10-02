import { SECOND_DIVISIONS, TARGET_LEAGUE_SIZE } from './data/clubs';
import { cupFromLeaguePosition } from './europeanQualification';
import { ARGENTINA_KNOCKOUT_SPOTS, MLS_PLAYOFF_SPOTS, MLS_PLAYOFF_WILDCARD_FROM } from './data/leagueFormat';

export type StandingsZone = 'champions' | 'europe' | 'relegation' | null;

export type TableZoneContext =
  | { kind: 'league'; league: string }
  | { kind: 'mls-conference' }
  | { kind: 'argentina-group' }
  | { kind: 'europe'; cup?: string | null }
  | { kind: 'intl-group' };

/** Last places that read as the drop zone on a finished table. */
export function relegationCount(tableLength: number): number {
  if (tableLength >= 20) return 3;
  if (tableLength >= 18) return 3;
  if (tableLength >= 14) return 2;
  return 0;
}

export function positionZone(
  context: TableZoneContext,
  position: number,
  tableLength: number,
): StandingsZone {
  if (position < 1) return null;

  if (context.kind === 'intl-group') {
    return position <= 2 ? 'champions' : null;
  }

  if (context.kind === 'europe') {
    if (position <= 8) return 'champions';
    if (position <= 24) return 'europe';
    return null;
  }

  if (context.kind === 'mls-conference') {
    if (position < MLS_PLAYOFF_WILDCARD_FROM) return 'champions';
    if (position <= MLS_PLAYOFF_SPOTS) return 'europe';
    return null;
  }

  if (context.kind === 'argentina-group') {
    return position <= ARGENTINA_KNOCKOUT_SPOTS ? 'champions' : null;
  }

  const league = context.league;
  if (SECOND_DIVISIONS.has(league)) {
    if (position <= 2) return 'champions';
    if (position <= 6) return 'europe';
    const spots = relegationCount(tableLength || TARGET_LEAGUE_SIZE[league] || 0);
    if (spots > 0 && position > tableLength - spots) return 'relegation';
    return null;
  }

  const cup = cupFromLeaguePosition(league, position);
  if (cup === 'ucl' || cup === 'acle' || cup === 'libertadores') return 'champions';
  if (cup === 'uel' || cup === 'uecl' || cup === 'sudamericana') return 'europe';

  const size = tableLength || TARGET_LEAGUE_SIZE[league] || 0;
  const spots = relegationCount(size);
  if (spots > 0 && !isClosedShopLeague(league) && position > size - spots) return 'relegation';
  return null;
}

function isClosedShopLeague(league: string): boolean {
  return league === 'MLS' || league === 'Liga Profesional';
}

export function zoneEdgeClass(zone: StandingsZone, you: boolean): string {
  if (you) return 'border-emerald-400 shadow-[inset_4px_0_12px_rgba(52,211,153,0.4)]';
  if (zone === 'champions') return 'border-sky-400 shadow-[inset_4px_0_12px_rgba(56,189,248,0.32)]';
  if (zone === 'europe') return 'border-orange-400 shadow-[inset_4px_0_12px_rgba(251,146,60,0.32)]';
  if (zone === 'relegation') return 'border-red-600 shadow-[inset_4px_0_12px_rgba(220,38,38,0.34)]';
  return 'border-transparent';
}

export function zonePosClass(zone: StandingsZone, you: boolean): string {
  if (you) return 'text-emerald-300';
  if (zone === 'champions') return 'text-sky-300';
  if (zone === 'europe') return 'text-orange-300';
  if (zone === 'relegation') return 'text-red-400';
  return 'text-white/45';
}

export const STANDINGS_HEAD =
  'text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75';
