import {
  CAM_BEHIND_M,
  CAMERA_FOCAL,
  FIFA,
  YARD_M,
  randomBallStartXRatio,
  randomShotDistanceM,
  worldToScreen,
  type PitchView,
} from './render';
import type { AimPoint } from './types';

/** Minimum gap from the ball to an open-play defender, when the pitch allows it. */
export const DEFENDER_GAP_YARDS = 10;
export const DEFENDER_GAP_M = DEFENDER_GAP_YARDS * YARD_M;

/** Don't plant a defender on the goal line itself. */
const MIN_DEFENDER_Z_M = 2.2;
/** Jog toward the ball — urgent, but a swipe still has time to land. */
export const DEFENDER_CLOSE_SPEED_MPS = 3.15;
/** Slower press when they already start next to a 6-yard kick. */
export const DEFENDER_CLOSE_SPEED_NEAR_MPS = 1.65;
/** Stop this far from the ball on an open-play close-down. */
export const DEFENDER_CLOSE_STOP_GAP_M = 2.7;
export const DEFENDER_CLOSE_STOP_GAP_NEAR_M = 1.4;
/** How far off the ball→goal-centre line a close-range cover must stand. */
const CLOSE_COVER_MIN_OFFSET_M = 1.65;
const CLOSE_COVER_MAX_OFFSET_M = 2.85;

export interface DefenderPose {
  worldX: number;
  /** Metres from the goal line toward the ball. */
  z: number;
  /** Which post they shade: −1 left, +1 right from the shooter's view. */
  coverSide: -1 | 1;
  /** Walk-cycle phase, radians. */
  stride?: number;
}

export type ChanceKind = 'open' | 'penalty';

export interface ChanceSetup {
  kind: ChanceKind;
  distanceM: number;
  ballStartXRatio: number;
  defender: DefenderPose | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * World X of the idle ball. The camera sits a fixed distance behind the ball,
 * so this does not depend on canvas size.
 */
export function ballWorldXFromRatio(xRatio: number): number {
  return (xRatio - 0.5) * CAM_BEHIND_M / CAMERA_FOCAL;
}

/** X on the straight line from the ball to the centre of the goal, at depth z. */
export function lineToGoalCentreX(ballWorldX: number, shotDistanceM: number, z: number): number {
  if (shotDistanceM <= 1e-6) return 0;
  return ballWorldX * (z / shotDistanceM);
}

/**
 * Penalties a club of this strength typically wins in a 38-game league season.
 * Weak sides (~52) sit around 3; elite sides (~94) around 8; a mid-table 70
 * is about 5 — the Premier League average.
 */
export function expectedPenaltiesPerSeason(clubStrength: number): number {
  const t = clamp((clubStrength - 52) / (94 - 52), 0, 1);
  return 3.2 + t * 4.8;
}

/**
 * Expected player chances across a 38-game league season. Mirrors
 * `meanChancesFromStrength` in the career chance engine so penalty frequency
 * stays a season rate, not an arbitrary per-shot spice.
 */
export function expectedChancesPerLeagueSeason(clubStrength: number): number {
  const t = clamp((clubStrength - 52) / (94 - 52), 0, 1);
  const meanPerMatch = 0.8 + t * 2.4;
  return meanPerMatch * 38;
}

/** Per-chance probability that this look is a penalty. */
export function penaltyChanceProbability(clubStrength = 70): number {
  const chances = expectedChancesPerLeagueSeason(clubStrength);
  return clamp(expectedPenaltiesPerSeason(clubStrength) / Math.max(1, chances), 0.02, 0.14);
}

export function rollIsPenalty(clubStrength: number, rng: () => number): boolean {
  return rng() < penaltyChanceProbability(clubStrength);
}

export function canKeepTenYardGap(shotDistanceM: number): boolean {
  return shotDistanceM - DEFENDER_GAP_M >= MIN_DEFENDER_Z_M - 1e-6;
}

/**
 * Place one outfield defender. When the ball is far enough from goal they
 * stand at least 10 yards from it, biased toward the goal so they shrink
 * the target. When the ball has spawned too close for that gap, they stand
 * near the six-yard line but off the shooting line, shading one post.
 */
export function placeDefender(
  shotDistanceM: number,
  ballStartXRatio: number,
  rng: () => number = Math.random,
): DefenderPose {
  const ballWorldX = ballWorldXFromRatio(ballStartXRatio);
  const coverSide: -1 | 1 = rng() < 0.5 ? -1 : 1;
  const maxZ = shotDistanceM - DEFENDER_GAP_M;

  if (maxZ >= MIN_DEFENDER_Z_M) {
    const t = 0.12 + rng() * 0.5;
    const z = MIN_DEFENDER_Z_M + t * (maxZ - MIN_DEFENDER_Z_M);
    const offset = 0.7 + rng() * 0.95;
    const worldX = clamp(lineToGoalCentreX(ballWorldX, shotDistanceM, z) + coverSide * offset, -7.5, 7.5);
    return { worldX, z, coverSide, stride: 0 };
  }

  const z = clamp(Math.min(shotDistanceM * 0.38, 3.2), 1.55, Math.max(1.55, shotDistanceM - 1.15));
  const offset = CLOSE_COVER_MIN_OFFSET_M + rng() * (CLOSE_COVER_MAX_OFFSET_M - CLOSE_COVER_MIN_OFFSET_M);
  const worldX = clamp(lineToGoalCentreX(ballWorldX, shotDistanceM, z) + coverSide * offset, -3.45, 3.45);
  return { worldX, z, coverSide, stride: 0 };
}

/** Point they rush — on the shooting line, a few metres in front of the ball. */
export function defenderCloseTarget(
  shotDistanceM: number,
  ballStartXRatio: number,
  coverSide: -1 | 1,
): { worldX: number; z: number } {
  const ballWorldX = ballWorldXFromRatio(ballStartXRatio);
  const near = !canKeepTenYardGap(shotDistanceM);
  const stopGap = near ? DEFENDER_CLOSE_STOP_GAP_NEAR_M : DEFENDER_CLOSE_STOP_GAP_M;
  const z = clamp(shotDistanceM - stopGap, 1.35, shotDistanceM - 0.9);
  const lineX = lineToGoalCentreX(ballWorldX, shotDistanceM, z);
  const offset = near ? 0.72 : 0.16;
  return { worldX: clamp(lineX + coverSide * offset, -7.5, 7.5), z };
}

export function defenderCloseSpeedMps(shotDistanceM: number): number {
  return canKeepTenYardGap(shotDistanceM) ? DEFENDER_CLOSE_SPEED_MPS : DEFENDER_CLOSE_SPEED_NEAR_MPS;
}

/** Step the defender toward the ball. dt is seconds; large frames are capped. */
export function advanceDefender(
  defender: DefenderPose,
  shotDistanceM: number,
  ballStartXRatio: number,
  dtSeconds: number,
): DefenderPose {
  const target = defenderCloseTarget(shotDistanceM, ballStartXRatio, defender.coverSide);
  const dx = target.worldX - defender.worldX;
  const dz = target.z - defender.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.025) {
    return { ...defender, worldX: target.worldX, z: target.z };
  }
  const speed = defenderCloseSpeedMps(shotDistanceM);
  const step = Math.min(dist, speed * clamp(dtSeconds, 0, 0.05));
  const t = step / dist;
  return {
    ...defender,
    worldX: defender.worldX + dx * t,
    z: defender.z + dz * t,
    stride: (defender.stride ?? 0) + step * 3.4,
  };
}

export function defenderDistanceFromBallM(
  defender: DefenderPose,
  shotDistanceM: number,
  ballStartXRatio: number,
): number {
  const ballWorldX = ballWorldXFromRatio(ballStartXRatio);
  return Math.hypot(defender.worldX - ballWorldX, defender.z - shotDistanceM);
}

export function defenderOffsetFromShootingLineM(
  defender: DefenderPose,
  shotDistanceM: number,
  ballStartXRatio: number,
): number {
  const ballWorldX = ballWorldXFromRatio(ballStartXRatio);
  return Math.abs(defender.worldX - lineToGoalCentreX(ballWorldX, shotDistanceM, defender.z));
}

export interface DefenderScreenBody {
  feet: { x: number; y: number };
  headY: number;
  torsoX: number;
  torsoY: number;
  bodyR: number;
  hipsY: number;
  legsR: number;
}

export function defenderScreenBody(view: PitchView, defender: DefenderPose): DefenderScreenBody {
  const meterPx = view.halfWidthPx(1, defender.z);
  const feet = worldToScreen(view, defender.worldX, defender.z);
  return {
    feet,
    headY: feet.y - 1.82 * meterPx,
    torsoX: feet.x,
    torsoY: feet.y - 0.95 * meterPx,
    bodyR: 0.5 * meterPx,
    hipsY: feet.y - 0.42 * meterPx,
    legsR: 0.28 * meterPx,
  };
}

/** True once the flying ball has visually reached the defender's grass line. */
export function ballHasReachedDefender(
  view: PitchView,
  defender: DefenderPose,
  ballPx: { x: number; y: number },
  ballRadiusPx: number,
): boolean {
  const body = defenderScreenBody(view, defender);
  return ballPx.y <= body.feet.y + ballRadiusPx;
}

/**
 * World-space line from the ball to the aimed point on the goal. Used so a
 * driven shot at the defender still blocks even when the flight bezier arcs
 * over their sprite.
 */
export function shotLineHitsDefender(
  shotDistanceM: number,
  ballStartXRatio: number,
  aim: AimPoint,
  defender: DefenderPose,
): boolean {
  if (shotDistanceM <= 1e-6) return false;
  const fromBall = clamp((shotDistanceM - defender.z) / shotDistanceM, 0, 1);
  const ballX = ballWorldXFromRatio(ballStartXRatio);
  const aimWorldX = aim.x * (FIFA.goalWidth / 2);
  const x = ballX + (aimWorldX - ballX) * fromBall;
  const height = Math.max(0, aim.y) * FIFA.goalHeight * fromBall;
  if (height > 1.82 + FIFA.ballDiameter / 2) return false;
  return Math.abs(x - defender.worldX) < 0.72;
}

/**
 * Screen-space body check. A lob over the head (ball above the skull) is not
 * a block; a strike through the torso or legs is.
 */
export function defenderBlocksBall(
  view: PitchView,
  defender: DefenderPose,
  ballPx: { x: number; y: number },
  ballRadiusPx: number,
): boolean {
  const body = defenderScreenBody(view, defender);
  if (ballPx.y + ballRadiusPx < body.headY) return false;

  const inColumn = Math.abs(ballPx.x - body.torsoX) < body.bodyR + ballRadiusPx;
  const inHeight = ballPx.y - ballRadiusPx <= body.feet.y && ballPx.y + ballRadiusPx >= body.headY;
  if (inColumn && inHeight) return true;

  if (Math.hypot(ballPx.x - body.torsoX, ballPx.y - body.torsoY) < body.bodyR + ballRadiusPx) return true;
  return Math.hypot(ballPx.x - body.torsoX, ballPx.y - body.hipsY) < body.legsR + ballRadiusPx;
}

export interface RollChanceOptions {
  clubStrength?: number;
  rng?: () => number;
  forcePenalty?: boolean;
  forceDistanceM?: number;
  disableDefender?: boolean;
}

export function rollChanceSetup(options: RollChanceOptions = {}): ChanceSetup {
  const rng = options.rng ?? Math.random;
  const clubStrength = options.clubStrength ?? 70;
  const takePenalty = Boolean(options.forcePenalty) || (
    options.forceDistanceM === undefined && rollIsPenalty(clubStrength, rng)
  );

  if (takePenalty) {
    return {
      kind: 'penalty',
      distanceM: FIFA.penaltySpot,
      ballStartXRatio: 0.5,
      defender: null,
    };
  }

  const distanceM = options.forceDistanceM ?? randomShotDistanceM(rng);
  const ballStartXRatio = randomBallStartXRatio(rng);
  const defender = options.disableDefender ? null : placeDefender(distanceM, ballStartXRatio, rng);
  return { kind: 'open', distanceM, ballStartXRatio, defender };
}
