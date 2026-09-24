import { MAX_SWIPE_DISTANCE, MIN_SWIPE_DISTANCE, REFERENCE_SPEED } from './constants';
import { BALL_SPAWN_X_MARGIN } from './render';

/** How far the rolling ball stays in from each canvas edge. */
export const BALL_TRAVEL_MIN_X = BALL_SPAWN_X_MARGIN + 0.04;
export const BALL_TRAVEL_MAX_X = 1 - BALL_TRAVEL_MIN_X;

/** Screen-width fraction the ball covers per second on a typical roll. */
export const BALL_TRAVEL_SPEED = 0.22;
/** Upper end of a whipped ball across the face of goal. */
export const CROSS_TRAVEL_SPEED = 1.28;
export const BALL_BOUNCE_PERIOD_S = 0.92;
export const VOLLEY_BOUNCE_PERIOD_S = 1.14;
export const BALL_BOUNCE_HEIGHT_RATIO = 0.038;
/** Volley is the same bounce, just higher as it comes across. */
export const VOLLEY_BOUNCE_HEIGHT_RATIO = 0.112;
/** Fallback when no defender is on the pitch — about a standing head. */
export const HEADER_HEIGHT_RATIO = 0.155;

export type BallFlight = 'roll' | 'bounce' | 'volley' | 'header';

export function isAerialFlight(flight: BallFlight | null | undefined): boolean {
  return flight === 'volley' || flight === 'header';
}

export function flightBounces(flight: BallFlight | null | undefined): boolean {
  return flight === 'bounce' || flight === 'volley';
}

export function bouncePeriodS(flight: BallFlight | null | undefined): number {
  return flight === 'volley' ? VOLLEY_BOUNCE_PERIOD_S : BALL_BOUNCE_PERIOD_S;
}

export function idleBallHeightRatio(
  flight: BallFlight | null | undefined,
  bounceLift = 0,
  headerLift = HEADER_HEIGHT_RATIO,
): number {
  if (flight === 'header') return headerLift;
  if (flight === 'volley') return bounceLift * VOLLEY_BOUNCE_HEIGHT_RATIO;
  if (flight === 'bounce') return bounceLift * BALL_BOUNCE_HEIGHT_RATIO;
  return 0;
}

export type BallTravelDir = -1 | 1;

export function chanceBallTravels(kind: string): boolean {
  return kind !== 'penalty';
}

export function ballTravelSpeedForKind(kind: string, flight?: BallFlight | null): number {
  if (kind === 'cross') return flight === 'roll' ? 0.78 : CROSS_TRAVEL_SPEED;
  if (flight === 'volley') return 0.52;
  if (flight === 'header') return 0.4;
  if (flight === 'bounce') return 0.3;
  return BALL_TRAVEL_SPEED;
}

/** Sample a travel speed. Crosses sit on the high end; stronger sides see more of the fast ones. */
export function pickBallTravelSpeed(
  kind: string,
  flight: BallFlight,
  opponentStrength = 70,
  rng: () => number = Math.random,
): number {
  const elite = clamp((opponentStrength - 52) / 42, 0, 1);
  const pick = (min: number, max: number, bias = 0) => {
    const t = clamp(rng() * (1 - bias * 0.35) + rng() * elite * bias, 0, 1);
    return min + (max - min) * t;
  };
  if (kind === 'cross') {
    const floor = flight === 'roll' ? 0.58 : flight === 'bounce' ? 0.64 : 0.72;
    return pick(floor, CROSS_TRAVEL_SPEED, 0.85);
  }
  if (flight === 'header') return pick(0.22, 0.72, 0.45);
  if (flight === 'volley') return pick(0.3, 0.96, 0.55);
  if (flight === 'bounce') return pick(0.16, 0.5, 0.35);
  return pick(0.14, 0.4, 0.25);
}

/** 0 on the turf, 1 at the peak of the bounce. */
export function ballBounceLift(elapsedS: number, periodS = BALL_BOUNCE_PERIOD_S): number {
  const period = periodS > 0 ? periodS : BALL_BOUNCE_PERIOD_S;
  const t = ((elapsedS % period) + period) % period;
  return Math.sin((t / period) * Math.PI);
}

/** How much an under-swipe should loft the ball, given bounce height. */
export function underSwipeLift(
  startScreenY: number,
  ballY: number,
  ballRadius: number,
  bounceHeight: number,
): number {
  const ballBottom = ballY + ballRadius * 0.85;
  const under = startScreenY - ballBottom;
  const raw = clamp(under / Math.max(18, ballRadius * 2.4), 0, 1);
  return raw * (0.55 + (1 - bounceHeight) * 0.45);
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
  opts?: {
    speed?: number;
    minX?: number;
    maxX?: number;
    bounce?: boolean;
  },
): { xRatio: number; direction: BallTravelDir } {
  const speed = opts?.speed ?? BALL_TRAVEL_SPEED;
  const minX = opts?.minX ?? BALL_TRAVEL_MIN_X;
  const maxX = opts?.maxX ?? BALL_TRAVEL_MAX_X;
  const bounce = opts?.bounce !== false;
  const span = Math.max(1e-4, maxX - minX);
  const step = speed * Math.min(0.05, Math.max(0, dtSeconds));
  let next = xRatio + direction * step;
  let dir = direction;
  if (!bounce) {
    return { xRatio: clamp(next, minX, maxX), direction: dir };
  }
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
export function takeQualityFromXRatio(xRatio: number, kind?: string): number {
  const half = (BALL_TRAVEL_MAX_X - BALL_TRAVEL_MIN_X) / 2;
  const t = Math.min(1, Math.abs(xRatio - 0.5) / Math.max(1e-4, half));
  const base = 1 - t * t;
  if (kind === 'cross') return clamp(base ** 1.65 * 0.72, 0.08, 0.78);
  return base;
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
/** After a knock, keep that direction and sit at the edge instead of bouncing back. */
export const KNOCK_HOLD_MS = 420;

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
 * Shove the rolling ball sideways. Direction follows the swipe; the ball
 * keeps its travel pace after the slide instead of stopping dead.
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
