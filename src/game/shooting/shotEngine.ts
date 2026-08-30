import {
  AIM_X_OVERSHOOT,
  AIM_Y_OVERSHOOT,
  CURL_BOW_SENSITIVITY,
  DEFAULT_DIFFICULTY,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  KEEPER_DIVE_MAX_X,
  KEEPER_STAND_Y,
  PLANTED_SAVE_COL_MAX,
  PLANTED_SAVE_COL_MIN,
  THUNDERBOLT_POWER,
  CLOSE_THUNDERBOLT_M,
  MAX_SWIPE_DISTANCE,
  MAX_TRAVEL_MS,
  MIN_SWIPE_DISTANCE,
  MIN_TRAVEL_MS,
  REFERENCE_SPEED,
  SAVE_CHANCE_CENTER,
  SAVE_CHANCE_TOP_CORNER,
  SAVE_GRID_COLS,
  SAVE_GRID_ROWS,
  WOODWORK_MARGIN,
} from './constants';
import { createPitchView, hipsToPlaceGlovesAt, pixelToAim } from './render';
import type {
  AimPoint,
  KeeperDive,
  SaveCell,
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

export interface SwipePoint {
  x: number;
  y: number;
}

/**
 * Estimates how much "bend" a player put on their swipe by measuring how far
 * the path bows away from the straight line between its start and end point,
 * as a fraction of the swipe's own length - the same lateral motion a real
 * strike with the inside/outside of the boot puts on a ball. The sign is
 * relative to the swipe itself (which way it curves), not to which side of
 * the goal it's aimed at, so the player - not a fixed bias - decides which
 * way the shot bends.
 *
 * Returns a value in [-1, 1]; 0 means a straight, uncurled strike.
 */
export function computeSwipeCurl(points: SwipePoint[]): number {
  if (points.length < 3) return 0;
  const start = points[0];
  const end = points[points.length - 1];
  const lineX = end.x - start.x;
  const lineY = end.y - start.y;
  const lineLen = Math.hypot(lineX, lineY);
  if (lineLen < 1e-3) return 0;

  // Use the single largest perpendicular deviation from the straight
  // start->end line rather than an average across all points: pointer
  // sampling rate varies a lot (a fast real swipe or an automated drag can
  // produce very few intermediate points), and averaging would wash out a
  // clear bow just because it's under-sampled near the straight ends.
  let peakOffset = 0;
  for (const p of points) {
    const vx = p.x - start.x;
    const vy = p.y - start.y;
    // Signed perpendicular distance of p from the start->end line.
    const offset = (lineX * vy - lineY * vx) / lineLen;
    if (Math.abs(offset) > Math.abs(peakOffset)) peakOffset = offset;
  }
  const bowRatio = peakOffset / lineLen;

  return clamp(bowRatio / CURL_BOW_SENSITIVITY, -1, 1);
}

export interface IntendedShot {
  aim: AimPoint;
  power: number;
  curl: number;
}

/** Maps a raw swipe into an intended (noise-free) aim point, a power scalar
 * where ~1.0 represents a well-struck "sweet spot" shot, and the curl the
 * player put on it. When screen-space ball/end/canvas are provided, aim is
 * the ray from the ball toward where the line is pointing on the goal —
 * so drawing slowly onto a corner places the shot there, rather than using
 * swipe length as elevation (which sent soft long draws over the bar). */
export function computeIntendedShot(gesture: SwipeGesture): IntendedShot {
  const distance = Math.hypot(gesture.dx, gesture.dy);
  const speed = gesture.durationMs > 0 ? distance / gesture.durationMs : distance / 16;

  const power = clamp(speed / REFERENCE_SPEED, 0.25, 1.8);

  const aim = screenRayAim(gesture) ?? displacementAim(gesture);

  const rawCurl = clamp(gesture.curl ?? 0, -1, 1);
  const powerDamping = 1 - clamp(power - 1, 0, 0.8) * 0.25;
  const curl = rawCurl * powerDamping * 0.55;

  return { aim, power, curl };
}

function displacementAim(gesture: SwipeGesture): AimPoint {
  const aimX = clamp(gesture.dx / MAX_SWIPE_DISTANCE, -1, 1) * (GOAL_HALF_WIDTH * AIM_X_OVERSHOOT);
  const upward = Math.max(0, gesture.dy);
  const aimY = clamp(upward / MAX_SWIPE_DISTANCE, 0, 1) * (GOAL_HEIGHT * AIM_Y_OVERSHOOT);
  return { x: aimX, y: aimY };
}

function screenRayAim(gesture: SwipeGesture): AimPoint | null {
  const { ballX, ballY, endX, endY, canvasW, canvasH, distanceM } = gesture;
  if (
    ballX === undefined ||
    ballY === undefined ||
    endX === undefined ||
    endY === undefined ||
    canvasW === undefined ||
    canvasH === undefined
  ) {
    return null;
  }

  const view = createPitchView(canvasW, canvasH, distanceM ?? 16.5);
  const { botY, topY } = view.goal;
  const dirX = endX - ballX;
  const dirY = endY - ballY;

  if (dirY >= -1) {
    // Not aiming toward the goal — treat as a ground-level poke in that direction.
    const aim = pixelToAim(endX, botY, view);
    return { x: aim.x, y: 0 };
  }

  if (endY <= botY) {
    // Finger is on the goal-plane image: the line ends where the shot should go.
    const aim = pixelToAim(endX, endY, view);
    return { x: clamp(aim.x, -1.45, 1.45), y: clamp(aim.y, 0, 1.35) };
  }

  // Short swipe still on the pitch: extend the ray to the goal line for X,
  // and lift Y from how steep the swipe is versus the bar.
  const tBot = (botY - ballY) / dirY;
  const xAtBot = ballX + tBot * dirX;
  const aimX = pixelToAim(xAtBot, botY, view).x;

  const up = -dirY / Math.hypot(dirX, dirY);
  const toLine = (ballY - botY) / Math.hypot(xAtBot - ballX, ballY - botY);
  const toBar = (ballY - topY) / Math.hypot(xAtBot - ballX, ballY - topY);
  const span = Math.max(1e-4, toBar - toLine);
  const aimY = clamp((up - toLine) / span, 0, 1.2);
  return { x: clamp(aimX, -1.45, 1.45), y: aimY };
}

/** Total inaccuracy (std-dev, normalized units) applied on top of the intended aim. */
export function computeNoise(power: number, curl: number, difficulty: ShotDifficulty): number {
  const overPenalty = Math.max(0, power - 1) * difficulty.powerNoisePenalty;
  const underPenalty = Math.max(0, 0.45 - power) * difficulty.powerNoisePenalty * 0.7;
  const curlPenalty = Math.abs(curl) * difficulty.curlNoisePenalty;
  return difficulty.baseNoise + overPenalty + underPenalty + curlPenalty;
}

export function computeTravelTimeMs(power: number, distanceM = 16.5): number {
  const powerT = clamp(power / 1.3, 0, 1);
  const base = lerp(MAX_TRAVEL_MS, MIN_TRAVEL_MS, powerT);
  return Math.max(MIN_TRAVEL_MS * 0.7, base * clamp(distanceM / 16.5, 0.45, 1.55));
}

/** True when a piledriver is struck from inside ~16 yards: too fast to dive. */
export function isCloseThunderbolt(power: number, distanceM: number): boolean {
  return power >= THUNDERBOLT_POWER && distanceM <= CLOSE_THUNDERBOLT_M + 1e-6;
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

/** Maps an on-target aim point onto the 16×5 goalmouth grid.
 * Col 0 is the left post, col 15 the right; row 0 is the ground, row 4 the bar. */
export function aimToSaveCell(aim: AimPoint): SaveCell {
  const col = clamp(Math.floor(((aim.x + GOAL_HALF_WIDTH) / (2 * GOAL_HALF_WIDTH)) * SAVE_GRID_COLS), 0, SAVE_GRID_COLS - 1);
  const row = clamp(Math.floor((aim.y / GOAL_HEIGHT) * SAVE_GRID_ROWS), 0, SAVE_GRID_ROWS - 1);
  return { col, row };
}

/**
 * Keeper save probability for a given grid square. Falls off from the centre
 * square (highest) toward the two top corners (lowest), so a shot stuffed
 * down the middle is usually held and a top-corner strike is the keeper's
 * worst look.
 */
export function saveChanceForCell(cell: SaveCell): number {
  const cx = (SAVE_GRID_COLS - 1) / 2;
  const cy = (SAVE_GRID_ROWS - 1) / 2;
  const dx = (cell.col - cx) / cx;
  const dy = (cell.row - cy) / cy;
  // Top of the goal is harder than the ground; weight the upward axis more.
  const upWeight = 1;
  const downWeight = 0.55;
  const vert = dy >= 0 ? dy * upWeight : -dy * downWeight;
  const dist = Math.hypot(dx, vert);
  const t = clamp(dist / Math.hypot(1, upWeight), 0, 1);
  const eased = t * t;
  return lerp(SAVE_CHANCE_CENTER, SAVE_CHANCE_TOP_CORNER, eased);
}

export function saveChanceForAim(aim: AimPoint, power = 1, curl = 0): number {
  const base = saveChanceForCell(aimToSaveCell(aim));
  const powerT = clamp((power - 0.25) / 1.55, 0, 1);
  const powerFactor = lerp(1.06, 0.87, powerT);
  const curlFactor = 1 - Math.abs(curl) * 0.1;
  return clamp(base * powerFactor * curlFactor, 0.06, 0.96);
}

/** Which third of the goal the shot is heading for. */
export function shotSideForAim(aim: AimPoint): -1 | 0 | 1 {
  if (Math.abs(aim.x) < 0.2) return 0;
  return aim.x < 0 ? -1 : 1;
}

/** Real keepers guess before the kick: dive left, stay, or dive right. */
export function samplePenaltyKeeperCommit(rng: RandomSource = defaultRandom): -1 | 0 | 1 {
  const roll = rng();
  if (roll < 0.41) return -1;
  if (roll < 0.82) return 1;
  return 0;
}

/**
 * Penalty save chance after the keeper has already committed. A wrong-way
 * dive or a standing keeper facing a corner is almost always beaten; a
 * centre shot is usually a goal because keepers dive a side more often
 * than they stay.
 */
export function penaltySaveChanceForAim(
  aim: AimPoint,
  commit: -1 | 0 | 1,
  power = 1,
  curl = 0,
): number {
  const side = shotSideForAim(aim);
  const guessed = commit === side;
  if (commit === 0) {
    if (side === 0) return clamp(saveChanceForAim(aim, power, curl), 0.82, 0.96);
    return 0.1;
  }
  if (side === 0 || !guessed) return 0.1;
  return saveChanceForAim(aim, power, curl);
}

/** True only for the three geometric-centre columns (1-based squares 7, 8, 9). */
export function isPlantedSaveCol(col: number): boolean {
  return col >= PLANTED_SAVE_COL_MIN && col <= PLANTED_SAVE_COL_MAX;
}

/**
 * How far across the goal the keeper's hips travel for a 16-wide landing square.
 * Only the three centre columns stay planted. Intensity then ramps to 1 at
 * the posts (columns 0 and 15) for a full-length dive.
 */
export function diveIntensityForCell(cell: SaveCell): number {
  if (isPlantedSaveCol(cell.col)) return 0;
  const distFromCentre = Math.abs(cell.col + 0.5 - SAVE_GRID_COLS / 2);
  return Math.min(1, distFromCentre / (SAVE_GRID_COLS / 2 - 0.5));
}

/** Centre of a 16×5 goalmouth square, in normalized aim space. */
export function cellCenter(cell: SaveCell): AimPoint {
  return {
    x: ((cell.col + 0.5) / SAVE_GRID_COLS) * 2 * GOAL_HALF_WIDTH - GOAL_HALF_WIDTH,
    y: ((cell.row + 0.5) / SAVE_GRID_ROWS) * GOAL_HEIGHT,
  };
}

/**
 * One of 160 end-poses. A save puts the gloves on that square so the keeper
 * obstructs the ball. A miss is the same dive falling short — they still throw
 * themselves unless it is a thunderbolt from 16 yards or closer. Only the
 * three centre columns catch on their feet.
 */
export function computeKeeperDive(
  actualAim: AimPoint,
  saveCell: SaveCell | null,
  saved: boolean,
  difficulty: ShotDifficulty,
  travelTimeMs?: number,
  shot?: { power?: number; distanceM?: number; commitDirection?: -1 | 0 | 1 },
): KeeperDive {
  const ballCell = saveCell ?? aimToSaveCell(actualAim);
  const commit = shot?.commitDirection;
  const guessedWrong = commit != null && commit !== 0 && shotSideForAim(actualAim) !== 0 && commit !== shotSideForAim(actualAim);
  const stayed = commit === 0;
  const poseCell: SaveCell = !saved && guessedWrong
    ? { col: commit === -1 ? 2 : 13, row: ballCell.row }
    : !saved && stayed
      ? { col: 7, row: ballCell.row }
      : ballCell;
  const cell = poseCell;
  const square = cellCenter(cell);
  const planted = isPlantedSaveCol(cell.col) || (stayed && !saved);
  const closeRocket = !saved && isCloseThunderbolt(shot?.power ?? 0, shot?.distanceM ?? Number.POSITIVE_INFINITY);
  const lateral = diveIntensityForCell(cell);
  const direction: -1 | 0 | 1 = stayed && !saved
    ? 0
    : guessedWrong && !saved
      ? (commit === -1 ? -1 : 1)
      : planted || closeRocket ? 0 : square.x < 0 ? -1 : 1;
  const heightT = (cell.row + 0.5) / SAVE_GRID_ROWS;
  const lowT = 1 - heightT;

  const layout = planted || closeRocket
    ? 0.02 + lowT * (saved ? 0.12 : 0.05)
    : saved
      ? clamp(0.48 + lateral * 0.52 + lowT * 0.18, 0.48, 1)
      : clamp(0.42 + lateral * 0.5 + lowT * 0.16, 0.42, 0.92);

  const elevation = heightT;
  const stretch = planted || closeRocket
    ? saved
      ? 0.2 + heightT * 0.55
      : 0.05 + heightT * 0.1
    : saved
      ? 0.45 + lateral * 0.4 + heightT * 0.15
      : 0.32 + lateral * 0.32 + heightT * 0.12;

  const hand: AimPoint = saved
    ? { x: square.x, y: square.y }
    : closeRocket
      ? { x: square.x * 0.12, y: KEEPER_STAND_Y + square.y * 0.08 }
      : {
          x: clamp(square.x * 0.58, -GOAL_HALF_WIDTH, GOAL_HALF_WIDTH),
          y: clamp(square.y * 0.52 + KEEPER_STAND_Y * 0.25, 0, GOAL_HEIGHT),
        };

  const hips = hipsToPlaceGlovesAt(hand, { direction, layout, stretch });
  const bodyX = clamp(hips.x, -KEEPER_DIVE_MAX_X, KEEPER_DIVE_MAX_X);
  const bodyY = clamp(hips.y, 0.06, 0.58);

  const travel = travelTimeMs ?? 500;
  const reactionMs = closeRocket ? travel : Math.min(50, travel * 0.1);
  const diveDurationMs = travel;

  return {
    target: { x: bodyX, y: bodyY },
    hand,
    reactionMs,
    diveDurationMs,
    reach: difficulty.keeperReach,
    direction,
    stretch,
    layout,
    elevation,
  };
}

export interface ResolveShotOptions {
  difficulty?: ShotDifficulty;
  rng?: RandomSource;
  /** When true the keeper commits left / stay / right before the kick. */
  penalty?: boolean;
}

export function resolveShot(gesture: SwipeGesture, options: ResolveShotOptions = {}): ShotResult {
  const difficulty = options.difficulty ?? DEFAULT_DIFFICULTY;
  const rng = options.rng ?? defaultRandom;

  const { aim: intendedAim, power, curl } = computeIntendedShot(gesture);
  const noise = computeNoise(power, curl, difficulty);

  const actualAim: AimPoint = {
    x: intendedAim.x + gaussianRandom(0, noise, rng),
    y: Math.max(0, intendedAim.y + gaussianRandom(0, noise * 0.75, rng)),
  };

  const distanceM = gesture.distanceM ?? 16.5;
  const travelTimeMs = computeTravelTimeMs(power, distanceM);
  const penaltyCommit = options.penalty ? samplePenaltyKeeperCommit(rng) : undefined;
  const shotCtx = { power, distanceM, commitDirection: penaltyCommit };

  if (hitsWoodwork(actualAim)) {
    return {
      outcome: 'post',
      aim: actualAim,
      intendedAim,
      power,
      curl,
      travelTimeMs,
      keeperDive: computeKeeperDive(actualAim, aimToSaveCell(actualAim), false, difficulty, travelTimeMs, shotCtx),
      saveMargin: 0,
      penaltyCommit,
    };
  }

  if (!isOnTarget(actualAim)) {
    return {
      outcome: classifyMiss(actualAim),
      aim: actualAim,
      intendedAim,
      power,
      curl,
      travelTimeMs,
      keeperDive: computeKeeperDive(actualAim, aimToSaveCell(actualAim), false, difficulty, travelTimeMs, shotCtx),
      saveMargin: 0,
      penaltyCommit,
    };
  }

  const saveCell = aimToSaveCell(actualAim);
  const saveRoll = penaltyCommit != null
    ? penaltySaveChanceForAim(actualAim, penaltyCommit, power, curl)
    : saveChanceForAim(actualAim, power, curl);
  const saved = rng() < saveRoll;
  const keeperDive = computeKeeperDive(actualAim, saveCell, saved, difficulty, travelTimeMs, shotCtx);
  const saveMargin = saved ? 1 - keeperDive.layout * 0.2 : 0;

  return {
    outcome: saved ? 'saved' : 'goal',
    aim: actualAim,
    intendedAim,
    power,
    curl,
    travelTimeMs,
    keeperDive,
    saveMargin,
    saveCell,
    penaltyCommit,
  };
}
