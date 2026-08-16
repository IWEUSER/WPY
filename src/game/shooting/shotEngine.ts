import {
  AIM_X_OVERSHOOT,
  AIM_Y_OVERSHOOT,
  DEFAULT_DIFFICULTY,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  KEEPER_DIVE_MS_PER_UNIT,
  MAX_SWIPE_DISTANCE,
  MAX_TRAVEL_MS,
  MIN_SWIPE_DISTANCE,
  MIN_TRAVEL_MS,
  REFERENCE_SPEED,
  WOODWORK_MARGIN,
} from './constants';
import type {
  AimPoint,
  KeeperDive,
  ShotDifficulty,
  ShotOutcomeKind,
  ShotResult,
  ShotZoneX,
  ShotZoneY,
  SwipeGesture,
} from './types';

export type RandomSource = () => number;

const defaultRandom: RandomSource = Math.random;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Standard-normal sample via Box-Muller, scaled to (mean, std). */
export function gaussianRandom(mean: number, std: number, rng: RandomSource = defaultRandom): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * std;
}

export function isValidSwipe(gesture: SwipeGesture): boolean {
  const distance = Math.hypot(gesture.dx, gesture.dy);
  return distance >= MIN_SWIPE_DISTANCE;
}

export interface IntendedShot {
  aim: AimPoint;
  power: number;
}

/** Maps a raw swipe into an intended (noise-free) aim point and a power scalar
 * where ~1.0 represents a well-struck "sweet spot" shot. */
export function computeIntendedShot(gesture: SwipeGesture): IntendedShot {
  const distance = Math.hypot(gesture.dx, gesture.dy);
  const speed = gesture.durationMs > 0 ? distance / gesture.durationMs : distance / 16;

  const power = clamp(speed / REFERENCE_SPEED, 0.25, 1.8);

  const aimX = clamp(gesture.dx / MAX_SWIPE_DISTANCE, -1, 1) * (GOAL_HALF_WIDTH * AIM_X_OVERSHOOT);
  const upward = Math.max(0, gesture.dy);
  const aimY = clamp(upward / MAX_SWIPE_DISTANCE, 0, 1) * (GOAL_HEIGHT * AIM_Y_OVERSHOOT);

  return { aim: { x: aimX, y: aimY }, power };
}

/** Total inaccuracy (std-dev, normalized units) applied on top of the intended aim. */
export function computeNoise(power: number, difficulty: ShotDifficulty): number {
  const overPenalty = Math.max(0, power - 1) * difficulty.powerNoisePenalty;
  const underPenalty = Math.max(0, 0.45 - power) * difficulty.powerNoisePenalty * 0.7;
  return difficulty.baseNoise + overPenalty + underPenalty;
}

export function computeTravelTimeMs(power: number): number {
  return lerp(MAX_TRAVEL_MS, MIN_TRAVEL_MS, power / 1.3);
}

export function classifyZoneX(x: number): ShotZoneX {
  if (x < -0.55) return 'far-left';
  if (x < -0.18) return 'left';
  if (x <= 0.18) return 'center';
  if (x <= 0.55) return 'right';
  return 'far-right';
}

export function classifyZoneY(y: number): ShotZoneY {
  if (y < 0.32) return 'low';
  if (y < 0.68) return 'mid';
  return 'high';
}

function isOnTarget(aim: AimPoint): boolean {
  return Math.abs(aim.x) <= GOAL_HALF_WIDTH - WOODWORK_MARGIN && aim.y >= 0 && aim.y <= GOAL_HEIGHT - WOODWORK_MARGIN;
}

function hitsWoodwork(aim: AimPoint): boolean {
  const nearPost = Math.abs(Math.abs(aim.x) - GOAL_HALF_WIDTH) < WOODWORK_MARGIN && aim.y <= GOAL_HEIGHT + WOODWORK_MARGIN;
  const nearBar = Math.abs(aim.y - GOAL_HEIGHT) < WOODWORK_MARGIN && Math.abs(aim.x) <= GOAL_HALF_WIDTH + WOODWORK_MARGIN;
  return nearPost || nearBar;
}

function classifyMiss(aim: AimPoint): ShotOutcomeKind {
  if (Math.abs(aim.x) > GOAL_HALF_WIDTH) return 'wide';
  if (aim.y > GOAL_HEIGHT) return 'over';
  return 'wide';
}

/** Decides where the keeper dives to: a correct "read" of the ball with a small
 * tracking error, or a bad guess that sends them the wrong way entirely. */
export function computeKeeperDive(
  actualAim: AimPoint,
  intendedAim: AimPoint,
  power: number,
  difficulty: ShotDifficulty,
  rng: RandomSource = defaultRandom,
): KeeperDive {
  const centralBonus = (1 - clamp(Math.abs(intendedAim.x) / GOAL_HALF_WIDTH, 0, 1)) * difficulty.keeperReadBonus * 0.5;
  const slowBonus = Math.max(0, 1 - power) * difficulty.keeperReadBonus;
  const readChance = clamp(difficulty.keeperReadChance + centralBonus + slowBonus, 0.05, 0.97);

  const readCorrectly = rng() < readChance;

  let target: AimPoint;
  if (readCorrectly) {
    target = {
      x: actualAim.x + gaussianRandom(0, 0.08, rng),
      y: clamp(actualAim.y + gaussianRandom(0, 0.08, rng), 0, GOAL_HEIGHT),
    };
  } else {
    const wrongSide = actualAim.x >= 0 ? -1 : 1;
    target = {
      x: wrongSide * (0.35 + rng() * 0.6),
      y: clamp(0.15 + rng() * 0.6, 0, GOAL_HEIGHT),
    };
  }

  const keeperStart: AimPoint = { x: 0, y: 0.28 };
  const diveDistance = Math.hypot(target.x - keeperStart.x, target.y - keeperStart.y);
  const reactionMs = difficulty.keeperReactionMs;
  const diveDurationMs = reactionMs + diveDistance * KEEPER_DIVE_MS_PER_UNIT;

  return { target, reactionMs, diveDurationMs, reach: difficulty.keeperReach };
}

export interface ResolveShotOptions {
  difficulty?: ShotDifficulty;
  rng?: RandomSource;
}

export function resolveShot(gesture: SwipeGesture, options: ResolveShotOptions = {}): ShotResult {
  const difficulty = options.difficulty ?? DEFAULT_DIFFICULTY;
  const rng = options.rng ?? defaultRandom;

  const { aim: intendedAim, power } = computeIntendedShot(gesture);
  const noise = computeNoise(power, difficulty);

  const actualAim: AimPoint = {
    x: intendedAim.x + gaussianRandom(0, noise, rng),
    y: Math.max(0, intendedAim.y + gaussianRandom(0, noise * 0.75, rng)),
  };

  const travelTimeMs = computeTravelTimeMs(power);

  if (hitsWoodwork(actualAim)) {
    return {
      outcome: 'post',
      aim: actualAim,
      intendedAim,
      power,
      travelTimeMs,
      keeperDive: computeKeeperDive(actualAim, intendedAim, power, difficulty, rng),
      saveMargin: 0,
    };
  }

  if (!isOnTarget(actualAim)) {
    return {
      outcome: classifyMiss(actualAim),
      aim: actualAim,
      intendedAim,
      power,
      travelTimeMs,
      keeperDive: computeKeeperDive(actualAim, intendedAim, power, difficulty, rng),
      saveMargin: 0,
    };
  }

  const keeperDive = computeKeeperDive(actualAim, intendedAim, power, difficulty, rng);
  const keeperOnTime = keeperDive.diveDurationMs <= travelTimeMs;
  const distanceToBall = Math.hypot(actualAim.x - keeperDive.target.x, actualAim.y - keeperDive.target.y);
  const withinReach = distanceToBall <= keeperDive.reach;
  const saved = keeperOnTime && withinReach;

  const saveMargin = keeperOnTime ? clamp(1 - distanceToBall / keeperDive.reach, 0, 1) : 0;

  return {
    outcome: saved ? 'saved' : 'goal',
    aim: actualAim,
    intendedAim,
    power,
    travelTimeMs,
    keeperDive,
    saveMargin,
  };
}
