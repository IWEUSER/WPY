import {
  CAM_BEHIND_M,
  CAMERA_FOCAL,
  FIFA,
  YARD_M,
  pickPlayerLook,
  type SkinPalette,
  randomBallStartXRatio,
  randomShotDistanceM,
  worldToScreen,
  type PitchView,
} from './render';
import type { AimPoint } from './types';
import { pickBallTravelSpeed, type BallFlight } from './ballTravel';

/** Minimum gap from the ball to an open-play defender, when the pitch allows it. */
export const DEFENDER_GAP_YARDS = 10;
export const DEFENDER_GAP_M = DEFENDER_GAP_YARDS * YARD_M;

/** Don't plant a defender on the goal line itself. */
const MIN_DEFENDER_Z_M = 2.2;
/** Jog toward the ball — urgent, but a swipe still has time to land. */
export const DEFENDER_CLOSE_SPEED_MPS = 3.85;
/** Slower press when they already start next to a 6-yard kick. */
export const DEFENDER_CLOSE_SPEED_NEAR_MPS = 2.15;
/** Stop this far from the ball on an open-play close-down. */
export const DEFENDER_CLOSE_STOP_GAP_M = 2.7;
export const DEFENDER_CLOSE_STOP_GAP_NEAR_M = 1.4;
/** How far off the ball→goal-centre line a close-range cover must stand. */
const CLOSE_COVER_MIN_OFFSET_M = 1.65;
const CLOSE_COVER_MAX_OFFSET_M = 2.85;
/**
 * Paired press closes almost on the shooting line. Cover holds the far post,
 * not a wide channel off the pitch that never affects the shot.
 */
export const DUAL_PRESS_HOLD_OFFSET_M = 0.28;
export const DUAL_COVER_HOLD_OFFSET_M = 2.05;
/** Cover stays this many metres closer to goal than the press. */
export const DUAL_COVER_STAGGER_M = 1.85;

export type DefenderDuty = 'press' | 'cover';

export interface DefenderPose {
  worldX: number;
  /** Metres from the goal line toward the ball. */
  z: number;
  /** Which post they shade: −1 left, +1 right from the shooter's view. */
  coverSide: -1 | 1;
  /** Press closes nearer the ball; cover holds a deeper, wider lane. */
  duty?: DefenderDuty;
  /** Walk-cycle phase, radians. */
  stride?: number;
  /** Stable skin tone for this chance. */
  skinTone?: string;
  hairColor?: string;
}

export type ChanceKind = 'open' | 'penalty' | 'cross';
export type { BallFlight } from './ballTravel';

export type PracticeChanceId =
  | 'random'
  | 'penalty'
  | 'cross'
  | 'volley'
  | 'header'
  | 'roll'
  | 'bounce';

export const PRACTICE_CHANCES: {
  id: PracticeChanceId;
  label: string;
  detail: string;
}[] = [
  { id: 'random', label: 'Random mix', detail: 'Every chance type, shuffled' },
  { id: 'penalty', label: 'Penalties', detail: 'Spot kicks, no defender' },
  { id: 'cross', label: 'Ball across the box', detail: 'Whipped in from the flank' },
  { id: 'volley', label: 'Volleys', detail: 'High bouncing ball' },
  { id: 'header', label: 'Headers', detail: 'Near the six-yard box' },
  { id: 'roll', label: 'Ground ball', detail: 'Rolling across the turf' },
  { id: 'bounce', label: 'Bouncing ball', detail: 'Standard bounce, not a volley' },
];

export function practiceChanceOptions(id?: PracticeChanceId | null): {
  forceKind?: ChanceKind;
  forceFlight?: BallFlight;
  forcePenalty?: boolean;
  forceDistanceM?: number;
} {
  switch (id) {
    case 'penalty':
      return { forceKind: 'penalty', forcePenalty: true };
    case 'cross':
      return { forceKind: 'cross' };
    case 'volley':
      return { forceKind: 'open', forceFlight: 'volley' };
    case 'header':
      return { forceFlight: 'header', forceDistanceM: FIFA.sixYardDepth + 0.35 };
    case 'roll':
      return { forceKind: 'open', forceFlight: 'roll' };
    case 'bounce':
      return { forceKind: 'open', forceFlight: 'bounce' };
    default:
      return {};
  }
}

export function parsePracticeChanceId(raw: string | null | undefined): PracticeChanceId | null {
  if (
    raw === 'random'
    || raw === 'penalty'
    || raw === 'cross'
    || raw === 'volley'
    || raw === 'header'
    || raw === 'roll'
    || raw === 'bounce'
  ) {
    return raw;
  }
  return null;
}

export interface ChanceSetup {
  kind: ChanceKind;
  distanceM: number;
  ballStartXRatio: number;
  defender: DefenderPose | null;
  /** All outfield defenders on this chance. Empty on a penalty. */
  defenders?: DefenderPose[];
  flight?: import('./ballTravel').BallFlight;
  travelSpeed?: number;
}

/** Opposition at this strength spawn a second defender on open-play chances. */
export const ELITE_DUAL_DEFENDER_STRENGTH = 86;

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
  palette: SkinPalette = 'any',
  opts?: { wideLane?: boolean },
): DefenderPose {
  const ballWorldX = ballWorldXFromRatio(ballStartXRatio);
  const ballSide: -1 | 1 = ballWorldX >= 0 ? 1 : -1;
  const coverSide: -1 | 1 = opts?.wideLane ? ballSide : rng() < 0.5 ? -1 : 1;
  const maxZ = shotDistanceM - DEFENDER_GAP_M;

  if (maxZ >= MIN_DEFENDER_Z_M) {
    const t = opts?.wideLane ? 0.42 + rng() * 0.32 : 0.12 + rng() * 0.5;
    const z = MIN_DEFENDER_Z_M + t * (maxZ - MIN_DEFENDER_Z_M);
    const offset = opts?.wideLane ? 0.35 + rng() * 0.45 : 0.7 + rng() * 0.95;
    const worldX = clamp(lineToGoalCentreX(ballWorldX, shotDistanceM, z) + coverSide * offset, -7.5, 7.5);
    const look = pickPlayerLook(rng() * 1_000_000, palette);
    return { worldX, z, coverSide, duty: 'press', stride: 0, skinTone: look.skin, hairColor: look.hair };
  }

  const z = clamp(Math.min(shotDistanceM * 0.38, 3.2), 1.55, Math.max(1.55, shotDistanceM - 1.15));
  const offset = CLOSE_COVER_MIN_OFFSET_M + rng() * (CLOSE_COVER_MAX_OFFSET_M - CLOSE_COVER_MIN_OFFSET_M);
  const worldX = clamp(lineToGoalCentreX(ballWorldX, shotDistanceM, z) + coverSide * offset, -3.45, 3.45);
  const look = pickPlayerLook(rng() * 1_000_000, palette);
  return { worldX, z, coverSide, duty: 'press', stride: 0, skinTone: look.skin, hairColor: look.hair };
}

/** In-box start so a header comes across, not in from the touchline. */
export const HEADER_SPAWN_LEFT_MIN = 0.26;
export const HEADER_SPAWN_LEFT_MAX = 0.34;
export const HEADER_SPAWN_RIGHT_MIN = 0.66;
export const HEADER_SPAWN_RIGHT_MAX = 0.74;
/** Some headers are unmarked — the defender is not glued to the shooter. */
export const HEADER_DEFENDER_CHANCE = 0.55;

/** Spawn inside the box on one flank, never hugging the side. */
export function headerStartXRatio(rng: () => number = Math.random): number {
  const left = rng() < 0.5;
  if (left) {
    return HEADER_SPAWN_LEFT_MIN + rng() * (HEADER_SPAWN_LEFT_MAX - HEADER_SPAWN_LEFT_MIN);
  }
  return HEADER_SPAWN_RIGHT_MIN + rng() * (HEADER_SPAWN_RIGHT_MAX - HEADER_SPAWN_RIGHT_MIN);
}

/**
 * Stand on the flank the ball is coming from, well off the shooting line,
 * so they do not immediately screen the goal.
 */
export function placeHeaderDefender(
  shotDistanceM: number,
  ballStartXRatio: number,
  rng: () => number = Math.random,
  palette: SkinPalette = 'any',
): DefenderPose {
  const ballWorldX = ballWorldXFromRatio(ballStartXRatio);
  const incomingSide: -1 | 1 = ballWorldX >= 0 ? 1 : -1;
  const z = clamp(shotDistanceM * 0.44, 2.05, Math.max(2.05, shotDistanceM - 1.55));
  const offset = 1.85 + rng() * 0.9;
  const worldX = clamp(ballWorldX + incomingSide * offset, -5.8, 5.8);
  const look = pickPlayerLook(rng() * 1_000_000, palette);
  return { worldX, z, coverSide: incomingSide, duty: 'press', stride: 0, skinTone: look.skin, hairColor: look.hair };
}

export interface DefenderCloseOpts {
  duty?: DefenderDuty;
  /** Two-defender looks hold their lanes instead of collapsing onto the shooting line. */
  paired?: boolean;
  /** Header: hold the incoming flank instead of collapsing onto the shooting line. */
  header?: boolean;
}

/** Point they rush — a few metres in front of the ball, on their own lane. */
export function defenderCloseTarget(
  shotDistanceM: number,
  ballStartXRatio: number,
  coverSide: -1 | 1,
  opts?: DefenderCloseOpts,
): { worldX: number; z: number } {
  const ballWorldX = ballWorldXFromRatio(ballStartXRatio);
  const near = !canKeepTenYardGap(shotDistanceM);
  const paired = Boolean(opts?.paired || opts?.duty === 'cover');
  const duty: DefenderDuty = opts?.duty ?? 'press';
  const pressStop = near ? DEFENDER_CLOSE_STOP_GAP_NEAR_M : DEFENDER_CLOSE_STOP_GAP_M;
  const pressZ = clamp(shotDistanceM - pressStop, 1.35, shotDistanceM - 0.9);
  const farPostX = (FIFA.goalWidth / 2) * coverSide * 0.9;
  if (opts?.header) {
    const incoming: -1 | 1 = ballWorldX >= 0 ? 1 : -1;
    const z = clamp(shotDistanceM - 1.55, 1.85, shotDistanceM - 1.15);
    return { worldX: clamp(ballWorldX + incoming * 1.75, -5.8, 5.8), z };
  }
  if (!paired) {
    const lineX = lineToGoalCentreX(ballWorldX, shotDistanceM, pressZ);
    const offset = near ? 0.72 : 0.16;
    return { worldX: clamp(lineX + coverSide * offset, -7.5, 7.5), z: pressZ };
  }
  if (duty === 'cover') {
    const z = clamp(pressZ - DUAL_COVER_STAGGER_M, MIN_DEFENDER_Z_M, Math.max(MIN_DEFENDER_Z_M, pressZ - 1.15));
    return { worldX: clamp(farPostX, -FIFA.goalWidth / 2, FIFA.goalWidth / 2), z };
  }
  const lineX = lineToGoalCentreX(ballWorldX, shotDistanceM, pressZ);
  const offset = near ? 0.22 : DUAL_PRESS_HOLD_OFFSET_M;
  return { worldX: clamp(lineX + coverSide * offset, -7.5, 7.5), z: pressZ };
}

/**
 * Mid-table keeps the current jog. Strong clubs and high-rank nations (their
 * FIFA rank already maps onto this strength) close down faster.
 */
export function oppositionCloseSpeedScale(opponentStrength = 70): number {
  const t = clamp((opponentStrength - 52) / 42, 0, 1);
  return lerp(1.18, 1.6, t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function defenderCloseSpeedMps(shotDistanceM: number, opponentStrength = 70): number {
  const base = canKeepTenYardGap(shotDistanceM) ? DEFENDER_CLOSE_SPEED_MPS : DEFENDER_CLOSE_SPEED_NEAR_MPS;
  return base * oppositionCloseSpeedScale(opponentStrength);
}

/** Step the defender toward the ball. dt is seconds; large frames are capped. */
export function advanceDefender(
  defender: DefenderPose,
  shotDistanceM: number,
  ballStartXRatio: number,
  dtSeconds: number,
  opponentStrength = 70,
  paired = false,
  header = false,
): DefenderPose {
  const target = defenderCloseTarget(shotDistanceM, ballStartXRatio, defender.coverSide, {
    duty: defender.duty ?? 'press',
    paired: paired || defender.duty === 'cover',
    header,
  });
  const dx = target.worldX - defender.worldX;
  const dz = target.z - defender.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.025) {
    return { ...defender, worldX: target.worldX, z: target.z };
  }
  const speed = defenderCloseSpeedMps(shotDistanceM, opponentStrength);
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
  /** Opposition quality. Scales close-down speed and can add a second defender. */
  opponentStrength?: number;
  rng?: () => number;
  forcePenalty?: boolean;
  forceDistanceM?: number;
  disableDefender?: boolean;
  skinPalette?: SkinPalette;
  allowPenalties?: boolean;
  forceDualDefenders?: boolean;
  forceKind?: ChanceKind;
  forceFlight?: BallFlight;
}

export function chanceDefenders(setup: Pick<ChanceSetup, 'defender' | 'defenders'>): DefenderPose[] {
  if (setup.defenders && setup.defenders.length > 0) return setup.defenders;
  return setup.defender ? [setup.defender] : [];
}

const SCOREABLE_AIMS: AimPoint[] = [
  { x: -0.92, y: 0.12 },
  { x: 0.92, y: 0.12 },
  { x: -0.72, y: 0.55 },
  { x: 0.72, y: 0.55 },
  { x: -0.88, y: 0.88 },
  { x: 0.88, y: 0.88 },
  { x: -0.45, y: 1.08 },
  { x: 0.45, y: 1.08 },
  { x: 0, y: 1.14 },
];

const OUTSIDE_AIMS: AimPoint[] = SCOREABLE_AIMS.filter((aim) => Math.abs(aim.x) >= 0.72);

/** True when at least one in-goal or lofted aim misses every defender. */
export function chanceIsScoreable(
  distanceM: number,
  ballStartXRatio: number,
  defenders: DefenderPose[],
): boolean {
  if (defenders.length === 0) return true;
  return SCOREABLE_AIMS.some((aim) =>
    !defenders.some((defender) => shotLineHitsDefender(distanceM, ballStartXRatio, aim, defender)),
  );
}

/** True when a near-post or far-post aim misses every defender — a curl-around lane. */
export function chanceHasOutsideLane(
  distanceM: number,
  ballStartXRatio: number,
  defenders: DefenderPose[],
): boolean {
  if (defenders.length === 0) return true;
  return OUTSIDE_AIMS.some((aim) =>
    !defenders.some((defender) => shotLineHitsDefender(distanceM, ballStartXRatio, aim, defender)),
  );
}

/**
 * Opposite-side cover for elite chances. Staggered closer to goal and held
 * wide so a pair never becomes a central wall. Nudged wider if the first
 * try closes every shooting lane; omitted rather than create an unwinnable look.
 */
export function placeCoverDefender(
  first: DefenderPose,
  shotDistanceM: number,
  ballStartXRatio: number,
  rng: () => number = Math.random,
  palette: SkinPalette = 'any',
): DefenderPose | null {
  if (!canKeepTenYardGap(shotDistanceM)) return null;
  const coverSide: -1 | 1 = first.coverSide === 1 ? -1 : 1;
  const z = clamp(
    first.z - DUAL_COVER_STAGGER_M,
    MIN_DEFENDER_Z_M,
    Math.max(MIN_DEFENDER_Z_M, first.z - 1.15),
  );
  const farPost = (FIFA.goalWidth / 2) * coverSide;
  const tryOffset = (t: number): DefenderPose => {
    const look = pickPlayerLook(rng() * 1_000_000, palette);
    return {
      worldX: clamp(farPost * t, -FIFA.goalWidth / 2, FIFA.goalWidth / 2),
      z,
      coverSide,
      duty: 'cover',
      stride: 0,
      skinTone: look.skin,
      hairColor: look.hair,
    };
  };
  const candidates = [
    tryOffset(0.82 + rng() * 0.1),
    tryOffset(0.92),
    tryOffset(0.72),
  ];
  for (const cover of candidates) {
    const pack = [first, cover];
    if (
      chanceIsScoreable(shotDistanceM, ballStartXRatio, pack)
      && chanceHasOutsideLane(shotDistanceM, ballStartXRatio, pack)
    ) {
      return cover;
    }
  }
  return null;
}

export function rollChanceSetup(options: RollChanceOptions = {}): ChanceSetup {
  const rng = options.rng ?? Math.random;
  const clubStrength = options.clubStrength ?? 70;
  const opponentStrength = options.opponentStrength ?? 70;
  const allowPenalties = options.allowPenalties !== false;
  const takePenalty = allowPenalties && (Boolean(options.forcePenalty) || (
    options.forceDistanceM === undefined && rollIsPenalty(clubStrength, rng)
  ));

  if (takePenalty) {
    return {
      kind: 'penalty',
      distanceM: FIFA.penaltySpot,
      ballStartXRatio: 0.5,
      defender: null,
      defenders: [],
      flight: 'roll',
      travelSpeed: 0,
    };
  }

  const CROSS_CHANCE = 0.26;
  const wantCross = options.forceKind === 'cross' || (
    options.forceKind !== 'open'
    && options.forceDistanceM === undefined
    && rng() < CROSS_CHANCE
  );
  if (wantCross) {
    const left = rng() < 0.5;
    const distanceM = FIFA.sixYardDepth + rng() * 4.2;
    const flight = pickBallFlight(distanceM, options.forceFlight, rng);
    const ballStartXRatio = flight === 'header'
      ? headerStartXRatio(rng)
      : left ? 0.08 + rng() * 0.12 : 0.80 + rng() * 0.12;
    const first = options.disableDefender || (flight === 'header' && rng() >= HEADER_DEFENDER_CHANCE)
      ? null
      : flight === 'header'
        ? placeHeaderDefender(distanceM, ballStartXRatio, rng, options.skinPalette ?? 'any')
        : placeDefender(distanceM, ballStartXRatio, rng, options.skinPalette ?? 'any');
    return {
      kind: 'cross',
      distanceM,
      ballStartXRatio,
      defender: first,
      defenders: first ? [first] : [],
      flight,
      travelSpeed: pickBallTravelSpeed('cross', flight, opponentStrength, rng),
    };
  }

  const distanceM = options.forceDistanceM ?? randomShotDistanceM(rng);
  const flight = pickBallFlight(distanceM, options.forceFlight, rng);
  const ballStartXRatio = flight === 'header' ? headerStartXRatio(rng) : randomBallStartXRatio(rng);
  const wantCover = Boolean(
    !options.disableDefender
    && flight !== 'header'
    && (options.forceDualDefenders || opponentStrength >= ELITE_DUAL_DEFENDER_STRENGTH),
  );
  const first = options.disableDefender || (flight === 'header' && rng() >= HEADER_DEFENDER_CHANCE)
    ? null
    : flight === 'header'
      ? placeHeaderDefender(distanceM, ballStartXRatio, rng, options.skinPalette ?? 'any')
      : placeDefender(distanceM, ballStartXRatio, rng, options.skinPalette ?? 'any', { wideLane: wantCover });
  const cover = wantCover && first
    ? placeCoverDefender(first, distanceM, ballStartXRatio, rng, options.skinPalette ?? 'any')
    : null;
  const defenders = first ? (cover ? [first, cover] : [first]) : [];
  return {
    kind: 'open',
    distanceM,
    ballStartXRatio,
    defender: first,
    defenders,
    flight,
    travelSpeed: pickBallTravelSpeed('open', flight, opponentStrength, rng),
  };
}

/** Headers only near the 6-yard line. Ground chances rotate roll vs bounce. */
export function headerDistanceOk(distanceM: number): boolean {
  return distanceM <= FIFA.sixYardDepth + 1.8;
}

export function pickBallFlight(
  distanceM: number,
  force?: BallFlight,
  rng: () => number = Math.random,
): BallFlight {
  if (force) {
    if (force === 'header' && !headerDistanceOk(distanceM)) return 'volley';
    return force;
  }
  if (headerDistanceOk(distanceM) && rng() < 0.16) return 'header';
  if (rng() < 0.22) return 'volley';
  return rng() < 0.5 ? 'bounce' : 'roll';
}
