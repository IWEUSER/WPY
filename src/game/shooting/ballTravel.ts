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
