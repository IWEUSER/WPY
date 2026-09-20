import { MAX_SWIPE_DISTANCE, MIN_SWIPE_DISTANCE, REFERENCE_SPEED } from './constants';
import { BALL_SPAWN_X_MARGIN } from './render';

/** How far the rolling ball stays in from each canvas edge. */
export const BALL_TRAVEL_MIN_X = BALL_SPAWN_X_MARGIN + 0.04;
export const BALL_TRAVEL_MAX_X = 1 - BALL_TRAVEL_MIN_X;

/** Screen-width fraction the ball covers per second on open play. */
export const BALL_TRAVEL_SPEED = 0.22;

export type BallTravelDir = -1 | 1;

export function chanceBallTravels(kind: 'open' | 'penalty'): boolean {
  return kind !== 'penalty';
}

export function pickBallTravelDir(xRatio: number, rng: () => number = Math.random): BallTravelDir {
  if (xRatio <= BALL_TRAVEL_MIN_X + 0.02) return 1;
  if (xRatio >= BALL_TRAVEL_MAX_X - 0.02) return -1;
  return rng() < 0.5 ? 1 : -1;
}

/** Ping-pong the idle ball across the shooting line. */
export function advanceBallTravel(
  xRatio: number,
  direction: BallTravelDir,
  dtSeconds: number,
  speed = BALL_TRAVEL_SPEED,
  minX = BALL_TRAVEL_MIN_X,
  maxX = BALL_TRAVEL_MAX_X,
): { xRatio: number; direction: BallTravelDir } {
  const span = Math.max(1e-4, maxX - minX);
  const step = speed * Math.min(0.05, Math.max(0, dtSeconds));
  let next = xRatio + direction * step;
  let dir = direction;
  if (next > maxX) {
    const over = next - maxX;
    next = maxX - (over % span);
    dir = -1;
  } else if (next < minX) {
    const over = minX - next;
    next = minX + (over % span);
    dir = 1;
  }
  return { xRatio: next, direction: dir };
}

/**
 * 1 when the ball is central (easiest body position), 0 at the travel edges.
 * Swiping on the roll still works at the sides — just a more awkward take.
 */
export function takeQualityFromXRatio(xRatio: number): number {
  const half = (BALL_TRAVEL_MAX_X - BALL_TRAVEL_MIN_X) / 2;
  const t = Math.min(1, Math.abs(xRatio - 0.5) / Math.max(1e-4, half));
  return 1 - t * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** A swipe is a knock when it is clearly sideways, not an upward strike. */
export const KNOCK_HORIZONTAL_RATIO = 1.35;
/** Soft sideways tap — a small shift of the ball. */
export const KNOCK_SOFT_RATIO = 0.055;
/** Full-blooded horizontal knock. */
export const KNOCK_HARD_RATIO = 0.34;
export const KNOCK_SLIDE_MS = 180;

/** True when the gesture is a sideways knock rather than a shot. */
export function swipeIsHorizontalKnock(dx: number, dy: number): boolean {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  return absX >= MIN_SWIPE_DISTANCE && absX > absY * KNOCK_HORIZONTAL_RATIO;
}

/** 0.12–1 from swipe length and speed. A tap is soft; a long, fast swipe is hard. */
export function knockForceFromSwipe(dx: number, durationMs: number): number {
  const dist = Math.abs(dx);
  const speed = dist / Math.max(16, durationMs);
  const distT = clamp(dist / MAX_SWIPE_DISTANCE, 0, 1);
  const speedT = clamp(speed / REFERENCE_SPEED, 0, 1.35);
  return clamp(0.4 * distT + 0.6 * speedT, 0.12, 1);
}

/**
 * Shove the rolling ball sideways. Direction follows the swipe, so knocking
 * against the current roll (and a chasing defender) opens space.
 */
export function applyHorizontalKnock(
  xRatio: number,
  dx: number,
  durationMs: number,
): { xRatio: number; direction: BallTravelDir; force: number; delta: number } {
  const force = knockForceFromSwipe(dx, durationMs);
  const direction: BallTravelDir = dx >= 0 ? 1 : -1;
  const delta = direction * lerp(KNOCK_SOFT_RATIO, KNOCK_HARD_RATIO, force);
  return {
    xRatio: clamp(xRatio + delta, BALL_TRAVEL_MIN_X, BALL_TRAVEL_MAX_X),
    direction,
    force,
    delta,
  };
}
