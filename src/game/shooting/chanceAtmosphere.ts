import type { ShotOutcomeKind } from './types';
import type { CrowdFill } from './stadium';

export interface CrowdBedLevel {
  home?: boolean;
  night?: boolean;
  cup?: boolean;
  final?: boolean;
  lastChance?: boolean;
  penalty?: boolean;
  crowdFill?: CrowdFill;
}

export type ChanceStake = 'league' | 'cup' | 'final' | 'penalty';

export function introHoldMs(stake: ChanceStake, lastChance: boolean, firstChance: boolean): number {
  if (stake === 'final' || stake === 'penalty') return firstChance ? 1400 : 1100;
  if (lastChance || stake === 'cup') return firstChance ? 1000 : 800;
  return firstChance ? 720 : 480;
}

export function resultHoldMs(
  outcome: ShotOutcomeKind,
  stake: ChanceStake,
  lastChance: boolean,
  power: number,
): number {
  let hold = 1600;
  if (outcome === 'goal') hold = 2100;
  else if (outcome === 'post') hold = 1900;
  else if (outcome === 'blocked') hold = 1750;
  else if (outcome === 'over' || (outcome === 'wide' && power > 1.2)) hold = 1800;
  if (stake === 'final' || stake === 'penalty') hold += 400;
  if (lastChance) hold += 250;
  return hold;
}

/** Crowds stay quiet for a block — only the impact SFX should play. */
export function crowdReactsToOutcome(outcome: ShotOutcomeKind): boolean {
  return outcome !== 'blocked';
}

export function chanceBeatLine(
  stake: ChanceStake,
  night: boolean,
  matchScoreLine?: string | null,
): string {
  if (matchScoreLine) return matchScoreLine;
  if (stake === 'penalty') return 'Penalty';
  if (stake === 'final') return 'The final';
  if (stake === 'cup') return night ? 'Cup night' : 'Cup tie';
  return 'Here we go';
}

const MINUTE_BANDS: Record<ChanceStake, number[]> = {
  league: [54, 67, 78, 87],
  cup: [62, 74, 83, 89],
  final: [68, 79, 88, 90],
  penalty: [120, 120, 120, 120],
};

/** Minute the next chance falls in, from 0-based index. */
export function chanceMinute(taken: number, total: number, stake: ChanceStake): number {
  const band = MINUTE_BANDS[stake] ?? MINUTE_BANDS.league;
  if (total <= 1) return band[band.length - 1] ?? 87;
  const last = Math.min(total, band.length) - 1;
  const idx = Math.min(Math.max(0, taken), last);
  return band[idx] ?? band[band.length - 1] ?? 87;
}

export function formatChanceMinute(minute: number): string {
  if (minute > 90) return `90+${minute - 90}`;
  if (minute === 90) return '90th minute';
  const mod = minute % 10;
  const suffix = minute % 100 >= 11 && minute % 100 <= 13
    ? 'th'
    : mod === 1 ? 'st' : mod === 2 ? 'nd' : mod === 3 ? 'rd' : 'th';
  return `${minute}${suffix} minute`;
}

export function chancesLeftLine(remaining: number): string {
  if (remaining <= 1) return '1 chance left';
  return `${remaining} chances left`;
}

/** Why this chance matters when the live score is already on the card. */
export function chanceImportanceLine(
  scoreFor: number,
  scoreAgainst: number,
  remaining: number,
  knockout: boolean,
): string | null {
  if (remaining <= 0) return null;
  const need = scoreAgainst - scoreFor;
  if (!knockout && remaining > 1 && need <= 0) return null;
  if (need > remaining) {
    return knockout
      ? `Even ${remaining} goal${remaining === 1 ? '' : 's'} leave you behind`
      : null;
  }
  if (need === remaining && need > 0) {
    return remaining === 1
      ? (knockout ? 'Score or go out' : 'Score here to stay in it')
      : `Score all ${remaining} to ${knockout ? 'stay in the tie' : 'level it'}`;
  }
  if (need > 0) {
    return `Need ${need} more from ${remaining} to level it`;
  }
  if (knockout && remaining === 1) return 'A goal can win it';
  return null;
}

export function crowdLevelForChance(args: {
  home?: boolean;
  night?: boolean;
  stake?: ChanceStake;
  lastChance?: boolean;
  crowdFill?: CrowdFill;
}): CrowdBedLevel {
  const stake = args.stake ?? 'league';
  return {
    home: Boolean(args.home),
    night: Boolean(args.night),
    cup: stake === 'cup' || stake === 'final' || stake === 'penalty',
    final: stake === 'final',
    lastChance: Boolean(args.lastChance),
    penalty: stake === 'penalty',
    crowdFill: args.crowdFill,
  };
}

export function defaultVenueLine(args: {
  groundName?: string;
  isHome?: boolean;
  night?: boolean;
}): string {
  const bits = [
    args.groundName,
    args.isHome === false ? 'Away' : 'Home',
    args.night ? 'Night' : null,
  ].filter(Boolean);
  return bits.join(' · ') || 'The pitch';
}
