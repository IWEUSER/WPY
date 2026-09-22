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
