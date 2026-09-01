import { DIVE_LAYOUT_RAD } from './constants';
import { luminance, mixHex, shadeHex, type DefenderKit } from './kitPalette';
import type { AimPoint } from './types';

/** FIFA markings in metres. Boxes are drawn from these ratios to the goal
 * (7.32 × 2.44), so the 6-yard and 18-yard areas stay in true proportion
 * even when the camera dollies with the ball. */
export const FIFA = {
  goalWidth: 7.32,
  goalHeight: 2.44,
  sixYardWidth: 18.32,
  sixYardDepth: 5.5,
  eighteenYardWidth: 40.32,
  eighteenYardDepth: 16.5,
  penaltySpot: 11,
  penaltyArcRadius: 9.15,
  /** Typical top-flight keeper, ~6'2". */
  keeperHeight: 1.88,
  /** Ready-stance width, fingertips not fully stretched. */
  keeperWidth: 1.4,
  ballDiameter: 0.22,
};

/** Camera sits this many metres behind the ball so the ball's screen Y stays fixed.
 * Kept short so a 6-yard spawn is viewed from ~11 m, not ~20 m — the goal then
 * fills most of the frame the way a real 6-yard look does. */
export const CAM_BEHIND_M = 5.5;
export const HORIZON_Y = 0.1;
/** Ball is always this fraction down the canvas, so the gap from the bottom is constant. */
export const BALL_SCREEN_Y = 0.84;
/** Dimensionless focal length: (metres / depth) × focal = fraction of canvas width.
 * Tuned so a 6-yard shot's goal is ~80% of screen width, a 30-yard shot ~25%. */
export const CAMERA_FOCAL = 1.25;
/** Closest spawn: the 6-yard line. At this distance the 6-yard marking sits on the ball. */
export const MIN_SHOT_DISTANCE_M = FIFA.sixYardDepth;
/** One imperial yard in metres. Spawn range is specified in football yards. */
export const YARD_M = 0.9144;
/** Furthest spawn: 30 yards from the goal line (12 yards outside the 18-yard box). */
export const MAX_SHOT_DISTANCE_YARDS = 30;
export const MAX_SHOT_DISTANCE_M = MAX_SHOT_DISTANCE_YARDS * YARD_M;

/** Layout of the goal plane within the canvas, as fractions of width/height.
 * Static fields that do not change with camera distance. */
export const LAYOUT = {
  ballStartY: BALL_SCREEN_Y,
};

/** Inset from each canvas edge so a random spawn never sits under the HUD. */
export const BALL_SPAWN_X_MARGIN = 0.08;

export function randomBallStartXRatio(rng: () => number = Math.random): number {
  return BALL_SPAWN_X_MARGIN + rng() * (1 - 2 * BALL_SPAWN_X_MARGIN);
}

export function randomShotDistanceM(rng: () => number = Math.random): number {
  return MIN_SHOT_DISTANCE_M + rng() * (MAX_SHOT_DISTANCE_M - MIN_SHOT_DISTANCE_M);
}

export interface GoalFrame {
  halfW: number;
  topY: number;
  botY: number;
  heightPx: number;
}

export interface PitchView {
  distanceM: number;
  camZ: number;
  w: number;
  h: number;
  goal: GoalFrame;
  screenY(worldZ: number): number;
  halfWidthPx(worldHalfM: number, worldZ: number): number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Perspective camera looking at the goal, with the ball pinned at BALL_SCREEN_Y.
 * Pitch-marking depth is linear in world metres so an 18-yard line sits 18/30 of
 * the way from the goal to a 30-yard ball, rather than perspective-compressing
 * the box against the goal and stretching the grass beyond it. Goal size still
 * comes from perspective so a 6-yard spawn fills the frame. */
export function createPitchView(w: number, h: number, distanceM: number): PitchView {
  const d = clamp(distanceM, MIN_SHOT_DISTANCE_M, MAX_SHOT_DISTANCE_M);
  const camZ = d + CAM_BEHIND_M;
  const lift = (BALL_SCREEN_Y - HORIZON_Y) * CAM_BEHIND_M;

  function halfWidthPx(worldHalfM: number, worldZ: number): number {
    const depth = Math.max(0.4, camZ - worldZ);
    return (worldHalfM / depth) * CAMERA_FOCAL * w;
  }

  const halfW = halfWidthPx(FIFA.goalWidth / 2, 0);
  const perspectiveBotY = (HORIZON_Y + lift / Math.max(0.4, camZ)) * h;
  const ballY = BALL_SCREEN_Y * h;
  const heightPx = halfW * 2 * (FIFA.goalHeight / FIFA.goalWidth);
  const goal: GoalFrame = { halfW, topY: perspectiveBotY - heightPx, botY: perspectiveBotY, heightPx };

  function screenY(worldZ: number): number {
    return perspectiveBotY + (ballY - perspectiveBotY) * (worldZ / d);
  }

  return { distanceM: d, camZ, w, h, goal, screenY, halfWidthPx };
}

export function goalToPixel(aim: AimPoint, view: PitchView): { x: number; y: number } {
  const { halfW, topY, botY } = view.goal;
  const x = view.w / 2 + aim.x * halfW;
  const y = botY - aim.y * (botY - topY);
  return { x, y };
}

export function pixelToAim(px: number, py: number, view: PitchView): AimPoint {
  const { halfW, topY, botY } = view.goal;
  const height = Math.max(1, botY - topY);
  return {
    x: (px - view.w / 2) / halfW,
    y: (botY - py) / height,
  };
}

export function ballStartPixel(view: PitchView, xRatio = 0.5): { x: number; y: number } {
  return { x: xRatio * view.w, y: BALL_SCREEN_Y * view.h };
}

/** World X,Z (metres; z = 0 at the goal line) → canvas pixels. Feet / grass. */
export function worldToScreen(view: PitchView, worldX: number, worldZ: number): { x: number; y: number } {
  return {
    x: view.w / 2 + worldX * view.halfWidthPx(1, worldZ),
    y: view.screenY(worldZ),
  };
}

export function screenXToWorldX(view: PitchView, screenX: number, worldZ: number): number {
  const meterPx = view.halfWidthPx(1, worldZ);
  if (meterPx < 1e-6) return 0;
  return (screenX - view.w / 2) / meterPx;
}

export function ballRadiusNear(view: PitchView): number {
  return view.w * 0.028;
}

export function ballRadiusAtGoal(view: PitchView): number {
  return (FIFA.ballDiameter / 2 / (FIFA.goalWidth / 2)) * view.goal.halfW;
}

interface BoxSpec {
  topY: number;
  bottomY: number;
  halfTop: number;
  halfBottom: number;
}

function drawBoxOutline(ctx: CanvasRenderingContext2D, w: number, box: BoxSpec) {
  ctx.beginPath();
  ctx.moveTo(w / 2 - box.halfTop, box.topY);
  ctx.lineTo(w / 2 - box.halfBottom, box.bottomY);
  ctx.lineTo(w / 2 + box.halfBottom, box.bottomY);
  ctx.lineTo(w / 2 + box.halfTop, box.topY);
  ctx.stroke();
}

export function drawPitch(ctx: CanvasRenderingContext2D, view: PitchView, time: number, opts?: { night?: boolean; plain?: boolean }) {
  const { w, h } = view;
  const { halfW, botY } = view.goal;
  const plain = Boolean(opts?.plain);
  /** Playing surface starts at the goal line so the stadium stays visible behind it. */
  const grassTop = plain ? 0 : botY;
  const vanishY = plain ? HORIZON_Y * h : grassTop;
  const night = Boolean(opts?.night);

  ctx.save();
  if (!plain) {
    const halfTop = Math.min(
      w * 0.49,
      Math.max(w * 0.24, view.halfWidthPx(FIFA.eighteenYardWidth / 2, 0) * 1.1),
    );
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, h);
    ctx.lineTo(w / 2 + halfTop, grassTop);
    ctx.lineTo(w / 2 - halfTop, grassTop);
    ctx.closePath();
    ctx.clip();
  }

  const grad = ctx.createLinearGradient(0, grassTop, 0, h);
  if (plain || night) {
    grad.addColorStop(0, '#0f3d1f');
    grad.addColorStop(0.4, '#155a29');
    grad.addColorStop(1, '#1f7a37');
  } else {
    grad.addColorStop(0, '#1a7a32');
    grad.addColorStop(0.4, '#23963c');
    grad.addColorStop(1, '#2db34a');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, grassTop, w, Math.max(0, h - grassTop));

  const stripeCount = 9;
  for (let i = 0; i < stripeCount; i++) {
    const t0 = i / stripeCount;
    const t1 = (i + 1) / stripeCount;
    ctx.beginPath();
    ctx.moveTo(lerp(0, w, t0), h);
    ctx.lineTo(lerp(0, w, t1), h);
    ctx.lineTo(lerp(w * 0.38, w * 0.62, t1), vanishY);
    ctx.lineTo(lerp(w * 0.38, w * 0.62, t0), vanishY);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)';
    ctx.fill();
  }

  const goalLineY = botY;
  const sixBottomY = view.screenY(FIFA.sixYardDepth);
  const eighteenBottomY = view.screenY(FIFA.eighteenYardDepth);

  const penaltyBox: BoxSpec = {
    topY: goalLineY + 1,
    bottomY: eighteenBottomY,
    halfTop: view.halfWidthPx(FIFA.eighteenYardWidth / 2, 0),
    halfBottom: view.halfWidthPx(FIFA.eighteenYardWidth / 2, FIFA.eighteenYardDepth),
  };
  const goalBox: BoxSpec = {
    topY: goalLineY + 1,
    bottomY: sixBottomY,
    halfTop: view.halfWidthPx(FIFA.sixYardWidth / 2, 0),
    halfBottom: view.halfWidthPx(FIFA.sixYardWidth / 2, FIFA.sixYardDepth),
  };

  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(2, halfW * 0.03);
  drawBoxOutline(ctx, w, penaltyBox);
  drawBoxOutline(ctx, w, goalBox);

  const penaltySpotY = view.screenY(FIFA.penaltySpot);
  const halfAtPenalty = view.halfWidthPx(FIFA.eighteenYardWidth / 2, FIFA.penaltySpot);
  const pxPerMeterX = (halfAtPenalty * 2) / FIFA.eighteenYardWidth;
  const pxPerMeterY = Math.abs(view.screenY(FIFA.penaltySpot + 1) - penaltySpotY);
  const arcRadiusX = FIFA.penaltyArcRadius * pxPerMeterX;
  const arcRadiusY = FIFA.penaltyArcRadius * Math.max(pxPerMeterY, pxPerMeterX * 0.35);
  if (eighteenBottomY < h * 1.05) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, penaltyBox.bottomY, w, Math.max(0, h - penaltyBox.bottomY));
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(w / 2, penaltySpotY, arcRadiusX, arcRadiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (view.distanceM > FIFA.penaltySpot + 0.6 && penaltySpotY < h * 0.95) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(w / 2, penaltySpotY, Math.max(2, w * 0.0045), 0, Math.PI * 2);
    ctx.fill();
  }

  const sweepX = ((time / 6000) % 1) * w;
  const sweep = ctx.createRadialGradient(sweepX, grassTop + h * 0.12, 0, sweepX, grassTop + h * 0.12, w * 0.5);
  sweep.addColorStop(0, 'rgba(255,255,255,0.05)');
  sweep.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sweep;
  ctx.fillRect(0, grassTop, w, Math.max(0, h - grassTop));
  ctx.restore();
}

export function drawGoal(ctx: CanvasRenderingContext2D, view: PitchView) {
  const { w } = view;
  const { halfW, topY, botY } = view.goal;
  const postW = Math.max(2, halfW * 0.035);

  ctx.save();
  ctx.beginPath();
  ctx.rect(w / 2 - halfW, topY, halfW * 2, botY - topY);
  ctx.clip();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.fillRect(w / 2 - halfW, topY, halfW * 2, botY - topY);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  const netCols = 14;
  const netRows = 3;
  for (let i = 0; i <= netCols; i++) {
    const x = w / 2 - halfW + (i / netCols) * halfW * 2;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, botY + (botY - topY) * 0.35);
    ctx.stroke();
  }
  for (let j = 0; j <= netRows; j++) {
    const y = topY + (j / netRows) * (botY - topY) * 1.35;
    ctx.beginPath();
    ctx.moveTo(w / 2 - halfW, y);
    ctx.lineTo(w / 2 + halfW, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = '#f5f7fa';
  ctx.lineWidth = postW;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(w / 2 - halfW, botY + postW);
  ctx.lineTo(w / 2 - halfW, topY);
  ctx.lineTo(w / 2 + halfW, topY);
  ctx.lineTo(w / 2 + halfW, botY + postW);
  ctx.stroke();

  const goalH = botY - topY;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 16; i++) {
    const x = w / 2 - halfW + (i / 16) * halfW * 2;
    ctx.moveTo(x, topY);
    ctx.lineTo(x, botY);
  }
  for (let j = 1; j < 5; j++) {
    const y = topY + (j / 5) * goalH;
    ctx.moveTo(w / 2 - halfW, y);
    ctx.lineTo(w / 2 + halfW, y);
  }
  ctx.stroke();
}

export interface KeeperPose {
  /** Normalized aim-space position of the keeper's hips. y is height (0 = ground). */
  pos: AimPoint;
  /** 0 = standing, 1 = fully stretched toward the ball. */
  stretch: number;
  /** -1 = diving left, 0 = center/no dive, 1 = diving right. */
  direction: number;
  beaten: boolean;
  /** 0 = standing, 1 = body laid out horizontal. */
  layout: number;
  /** 0 = on the ground, 1 = leaping toward the bar. */
  elevation: number;
  /** Glove aim-space marker: on the dive side of the hips, short of the square on a miss. */
  hand: AimPoint;
  /** Stable skin tone for this chance — not the same beige every time. */
  skinTone: string;
}

/** Collision skeleton stays in these units. Drawing uses 8-head proportions. */
const KEEPER_FIGURE_HEIGHT = 7.95;
const KEEPER_HIP_FROM_FOOT = 3.0;
const KEEPER_SHOULDER_FROM_HIP = 2.5;
const KEEPER_HEAD_FROM_HIP = 3.9;

/** Light through dark — keepers and defenders pick one per chance. */
export const PLAYER_SKIN_TONES = [
  '#f6dec0',
  '#e8b88a',
  '#c68642',
  '#8d5524',
  '#6b3d1f',
] as const;

export type SkinPalette = 'any' | 'africa';

/** Medium through dark brown — African national-team keepers and defenders. */
export const AFRICA_SKIN_TONES = PLAYER_SKIN_TONES.slice(2);

/** Hip→knee share of the hip-to-boot line. Shorts must stay shorter than this. */
export const THIGH_SHARE = 0.42;
/** Shorts drop below the hip and overlap the jersey hem. */
export const SHORTS_HALF_H = 0.7;
/** Jersey is drawn to just above the hip; shorts then cover the lower third. */
export const JERSEY_HEM = 0.12;
export const JERSEY_SHOULDER_INSET = 0.12;
/** Raise the shorts oval so it covers the lower jersey instead of sitting under it. */
export const SHORTS_CENTER = -0.08;

export function pickPlayerSkin(seed: number, palette: SkinPalette = 'any'): string {
  const tones = palette === 'africa' ? AFRICA_SKIN_TONES : PLAYER_SKIN_TONES;
  const i = Math.abs(Math.floor(seed)) % tones.length;
  return tones[i];
}

export function idleKeeperPose(rng: () => number = Math.random, palette: SkinPalette = 'any'): KeeperPose {
  return {
    pos: { x: 0, y: 0.28 },
    stretch: 0,
    direction: 0,
    beaten: false,
    layout: 0,
    elevation: 0,
    hand: { x: 0, y: 0.34 },
    skinTone: pickPlayerSkin(Math.floor(rng() * 1_000_000), palette),
  };
}

/** Canvas radians for a dive: positive dir (right) rotates clockwise, so the
 * head and both arms go toward that post and the legs trail the other way. */
export function keeperDiveAngle(direction: number, layout: number): number {
  if (direction === 0) return 0;
  return direction * clamp(layout, 0, 1) * DIVE_LAYOUT_RAD;
}

interface KeeperLocalPt { x: number; y: number }

/** Stick points in scale-units. Local +Y is the feet when standing; −Y is the
 * head. After `keeperDiveAngle`, a left dive has gloves left of the hips and
 * boots right of them. */
export function keeperLocalPoints(pose: Pick<KeeperPose, 'direction' | 'stretch' | 'layout'>): {
  diving: boolean;
  head: KeeperLocalPt;
  gloveL: KeeperLocalPt;
  gloveR: KeeperLocalPt;
  footL: KeeperLocalPt;
  footR: KeeperLocalPt;
  shoulderL: KeeperLocalPt;
  shoulderR: KeeperLocalPt;
} {
  const stretch = clamp(pose.stretch, 0, 1);
  const diving = pose.direction !== 0 && clamp(pose.layout ?? 1, 0, 1) > 0.12;
  const head: KeeperLocalPt = { x: 0, y: -KEEPER_HEAD_FROM_HIP };
  const shoulderY = -KEEPER_SHOULDER_FROM_HIP;
  if (!diving) {
    const gloveY = shoulderY - (1.0 + stretch * 1.4);
    return {
      diving: false,
      head,
      shoulderL: { x: -1.3, y: shoulderY },
      shoulderR: { x: 1.3, y: shoulderY },
      gloveL: { x: -1.55, y: gloveY },
      gloveR: { x: 1.55, y: gloveY },
      footL: { x: -0.7, y: KEEPER_HIP_FROM_FOOT },
      footR: { x: 0.7, y: KEEPER_HIP_FROM_FOOT },
    };
  }
  const arm = 2.4 + stretch * 2.2;
  return {
    diving: true,
    head,
    shoulderL: { x: -0.7, y: shoulderY },
    shoulderR: { x: 0.7, y: shoulderY },
    gloveL: { x: -0.35, y: head.y - arm },
    gloveR: { x: 0.45, y: head.y - arm + 0.35 },
    footL: { x: -0.5, y: KEEPER_HIP_FROM_FOOT + 0.45 },
    footR: { x: 0.62, y: KEEPER_HIP_FROM_FOOT + 0.9 },
  };
}

function rotateLocalX(lx: number, ly: number, ang: number): number {
  return lx * Math.cos(ang) - ly * Math.sin(ang);
}

const KEEPER_AIM_HEIGHT = FIFA.keeperHeight / FIFA.goalHeight;
const AIM_PER_LOCAL_Y = KEEPER_AIM_HEIGHT / KEEPER_FIGURE_HEIGHT;
const AIM_PER_LOCAL_X = AIM_PER_LOCAL_Y * (2 * FIFA.goalHeight / FIFA.goalWidth);

/** Aim-space offset of a local stick point after the dive rotate. */
export function localToAimOffset(lx: number, ly: number, ang: number): AimPoint {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  return {
    x: (lx * cos - ly * sin) * AIM_PER_LOCAL_X,
    y: -(lx * sin + ly * cos) * AIM_PER_LOCAL_Y,
  };
}

/** Midpoint of the two gloves relative to the hips, in aim space. */
export function gloveAimOffset(pose: Pick<KeeperPose, 'direction' | 'layout' | 'stretch'>): AimPoint {
  const ang = keeperDiveAngle(pose.direction, pose.layout);
  const pts = keeperLocalPoints(pose);
  const a = localToAimOffset(pts.gloveL.x, pts.gloveL.y, ang);
  const b = localToAimOffset(pts.gloveR.x, pts.gloveR.y, ang);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Hip position that puts the gloves on `glove` after the dive rotate. */
export function hipsToPlaceGlovesAt(
  glove: AimPoint,
  pose: Pick<KeeperPose, 'direction' | 'layout' | 'stretch'>,
): AimPoint {
  const off = gloveAimOffset(pose);
  return { x: glove.x - off.x, y: glove.y - off.y };
}

/** Aim-space x of hips, the furthest glove, and the furthest boot after rotate.
 * Units of the limb offsets are scale-units (not aim), so only the order of
 * glove / hip / foot is meaningful — that order is the dive silhouette. */
export function keeperSilhouetteX(pose: KeeperPose): { hip: number; glove: number; foot: number } {
  const ang = keeperDiveAngle(pose.direction, pose.layout);
  const pts = keeperLocalPoints(pose);
  const hip = pose.pos.x;
  const g1 = hip + rotateLocalX(pts.gloveL.x, pts.gloveL.y, ang);
  const g2 = hip + rotateLocalX(pts.gloveR.x, pts.gloveR.y, ang);
  const f1 = hip + rotateLocalX(pts.footL.x, pts.footL.y, ang);
  const f2 = hip + rotateLocalX(pts.footR.x, pts.footR.y, ang);
  if (pose.direction < 0) {
    return { hip, glove: Math.min(g1, g2), foot: Math.max(f1, f2) };
  }
  if (pose.direction > 0) {
    return { hip, glove: Math.max(g1, g2), foot: Math.min(f1, f2) };
  }
  return { hip, glove: (g1 + g2) / 2, foot: (f1 + f2) / 2 };
}

type FigPt = { x: number; y: number };

function hairColorForSkin(skin: string): string {
  const lum = luminance(skin);
  if (lum > 0.72) return '#3a2418';
  if (lum > 0.5) return '#2a1810';
  if (lum > 0.32) return '#1a100c';
  return '#0e0906';
}

/** Tapered 3D-ish limb: two end caps plus a trapezoid, filled with a highlight. */
function fillCapsule(
  ctx: CanvasRenderingContext2D,
  a: FigPt,
  ra: number,
  b: FigPt,
  rb: number,
  color: string,
  caps: { start?: boolean; end?: boolean } = {},
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const light = mixHex(color, '#fff6ea', 0.22);
  const dark = shadeHex(color, -0.2);
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(Math.atan2(dy, dx));
  const grad = ctx.createLinearGradient(0, -Math.max(ra, rb), 0, Math.max(ra, rb));
  grad.addColorStop(0, light);
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -ra);
  ctx.lineTo(len, -rb);
  ctx.lineTo(len, rb);
  ctx.lineTo(0, ra);
  ctx.closePath();
  ctx.fill();
  if (caps.start !== false) {
    ctx.beginPath();
    ctx.arc(0, 0, ra, 0, Math.PI * 2);
    ctx.fill();
  }
  if (caps.end !== false) {
    ctx.beginPath();
    ctx.arc(len, 0, rb, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Front-facing athletic head. `H` is one head-height. `(x, y)` is the skull centre.
 * Hair stays on the cranium so the face is always visible.
 */
function drawAthleteHead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  H: number,
  skin: string,
) {
  const hx = H * 0.5;
  const hy = H * 0.56;
  const hair = hairColorForSkin(skin);
  const shade = shadeHex(skin, -0.22);
  const light = mixHex(skin, '#fff3e8', 0.28);
  const lip = mixHex(shadeHex(skin, -0.3), '#6a3a32', 0.4);

  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(x - hx * 0.98, y + hy * 0.12, H * 0.07, H * 0.12, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + hx * 0.98, y + hy * 0.12, H * 0.07, H * 0.12, -0.18, 0, Math.PI * 2);
  ctx.fill();

  const skull = ctx.createRadialGradient(x - hx * 0.25, y - hy * 0.28, H * 0.06, x, y + hy * 0.1, hx * 1.35);
  skull.addColorStop(0, light);
  skull.addColorStop(0.55, skin);
  skull.addColorStop(1, shade);

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(x - hx * 0.92, y + hy * 0.08);
    ctx.bezierCurveTo(x - hx * 1.05, y - hy * 0.35, x - hx * 0.55, y - hy, x, y - hy);
    ctx.bezierCurveTo(x + hx * 0.55, y - hy, x + hx * 1.05, y - hy * 0.35, x + hx * 0.92, y + hy * 0.08);
    ctx.quadraticCurveTo(x + hx * 0.82, y + hy * 0.55, x + hx * 0.38, y + hy * 0.92);
    ctx.quadraticCurveTo(x, y + hy * 1.05, x - hx * 0.38, y + hy * 0.92);
    ctx.quadraticCurveTo(x - hx * 0.82, y + hy * 0.55, x - hx * 0.92, y + hy * 0.08);
    ctx.closePath();
  };
  trace();
  ctx.fillStyle = skull;
  ctx.fill();

  ctx.save();
  trace();
  ctx.clip();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(x, y - hy * 0.22, hx * 1.02, hy * 0.58, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - hx, y - hy * 0.08);
  ctx.quadraticCurveTo(x, y + hy * 0.02, x + hx, y - hy * 0.08);
  ctx.lineTo(x + hx * 0.7, y - hy);
  ctx.lineTo(x - hx * 0.7, y - hy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.ellipse(x - hx * 0.2, y - hy * 0.42, hx * 0.35, hy * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (H < 5) return;

  const eyeY = y + hy * 0.08;
  const eyeDx = hx * 0.38;
  for (const side of [-1, 1]) {
    const ex = x + side * eyeDx;
    ctx.fillStyle = '#f4ebe3';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, Math.max(1.1, H * 0.075), Math.max(0.85, H * 0.05), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2018';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + H * 0.006, Math.max(0.9, H * 0.048), Math.max(0.9, H * 0.048), 0, 0, Math.PI * 2);
    ctx.fill();
    if (H >= 11) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(ex - H * 0.018, eyeY - H * 0.012, H * 0.012, H * 0.01, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = hair;
    ctx.lineWidth = Math.max(1, H * 0.055);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ex - H * 0.1, eyeY - H * 0.1);
    ctx.quadraticCurveTo(ex, eyeY - H * 0.14, ex + H * 0.1, eyeY - H * 0.1);
    ctx.stroke();
  }

  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(x - H * 0.02, eyeY + H * 0.06);
  ctx.lineTo(x + H * 0.04, eyeY + H * 0.22);
  ctx.lineTo(x - H * 0.03, eyeY + H * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(x + H * 0.012, eyeY + H * 0.2, H * 0.035, H * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(0.8, H * 0.035);
  ctx.beginPath();
  ctx.moveTo(x - H * 0.05, eyeY + H * 0.2);
  ctx.lineTo(x + H * 0.055, eyeY + H * 0.22);
  ctx.stroke();

  ctx.strokeStyle = lip;
  ctx.lineWidth = Math.max(1, H * 0.055);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - H * 0.085, y + hy * 0.52);
  ctx.quadraticCurveTo(x, y + hy * 0.56, x + H * 0.085, y + hy * 0.52);
  ctx.stroke();
}

function traceJersey(ctx: CanvasRenderingContext2D, H: number, collarY: number, hemY: number) {
  const neck = H * 0.24;
  const shoulderX = H * 0.72;
  const shoulderY = collarY + H * 0.52;
  const sleeveHemX = H * 0.66;
  const sleeveHemY = collarY + H * 0.88;
  const armpitX = H * 0.5;
  const armpitY = collarY + H * 1.02;
  const hemX = H * 0.5;
  ctx.beginPath();
  ctx.moveTo(-neck, collarY + H * 0.08);
  ctx.quadraticCurveTo(0, collarY + H * 0.18, neck, collarY + H * 0.08);
  ctx.quadraticCurveTo(H * 0.4, collarY + H * 0.16, shoulderX, shoulderY);
  ctx.quadraticCurveTo(shoulderX + H * 0.05, sleeveHemY - H * 0.08, sleeveHemX, sleeveHemY);
  ctx.lineTo(armpitX, armpitY);
  ctx.quadraticCurveTo(hemX + H * 0.04, (armpitY + hemY) * 0.55, hemX, hemY);
  ctx.lineTo(-hemX, hemY);
  ctx.quadraticCurveTo(-hemX - H * 0.04, (armpitY + hemY) * 0.55, -armpitX, armpitY);
  ctx.lineTo(-sleeveHemX, sleeveHemY);
  ctx.quadraticCurveTo(-shoulderX - H * 0.05, sleeveHemY - H * 0.08, -shoulderX, shoulderY);
  ctx.quadraticCurveTo(-H * 0.4, collarY + H * 0.16, -neck, collarY + H * 0.08);
  ctx.closePath();
}

function traceShorts(ctx: CanvasRenderingContext2D, H: number) {
  const top = -H * 0.1;
  const bot = H * 0.88;
  const topW = H * 0.5;
  const botW = H * 0.56;
  ctx.beginPath();
  ctx.moveTo(-topW, top);
  ctx.lineTo(topW, top);
  ctx.lineTo(botW, bot);
  ctx.lineTo(-botW, bot);
  ctx.closePath();
}

function drawGlove(
  ctx: CanvasRenderingContext2D,
  p: FigPt,
  H: number,
  color: string,
  line: string,
  side: number,
) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(side * -0.2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, H * 0.26, H * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.ellipse(i * H * 0.09, -H * 0.28, H * 0.075, H * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, H * 0.045);
  ctx.beginPath();
  ctx.ellipse(0, 0, H * 0.26, H * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

interface HumanoidStyle {
  skin: string;
  shirt: string;
  shirtDark: string;
  shorts: string;
  socks: string;
  boot: string;
  stripe?: string;
  pattern?: DefenderKit['pattern'];
  glove?: string;
  gloveLine?: string;
}

/**
 * One 8-head footballer, hips at the origin, +Y toward the feet.
 * `H` is the height of the head. Arms hang by the sides unless `hands` is set
 * (keeper gloves). Collision stick-points are intentionally not used here.
 */
function drawHumanoid(
  ctx: CanvasRenderingContext2D,
  H: number,
  style: HumanoidStyle,
  stride = 0,
  hands?: { left: FigPt; right: FigPt },
  stance: 'walk' | 'ready' = 'walk',
) {
  const skin = style.skin;
  const skinHi = mixHex(skin, '#fff3e8', 0.18);
  const walk = Math.sin(stride);
  const collarY = -H * 2.72;
  const hemY = -H * 0.08;
  const head = { x: 0, y: -H * 3.22 };
  const footY = H * 4;
  const stanceW = stance === 'ready' ? 0.52 : 0.36;
  const footL = { x: -H * stanceW + walk * H * 0.28, y: footY };
  const footR = { x: H * stanceW - walk * H * 0.28, y: footY };
  const hipL = { x: -H * 0.28, y: H * 0.06 };
  const hipR = { x: H * 0.28, y: H * 0.06 };
  const kneeL = {
    x: hipL.x * 0.45 + footL.x * 0.55,
    y: H * (stance === 'ready' ? 1.88 : 2.02),
  };
  const kneeR = {
    x: hipR.x * 0.45 + footR.x * 0.55,
    y: H * (stance === 'ready' ? 1.88 : 2.02),
  };
  const sleeveL = { x: -H * 0.58, y: collarY + H * 0.82 };
  const sleeveR = { x: H * 0.58, y: collarY + H * 0.82 };
  const handL = hands?.left ?? {
    x: -H * 0.52 - walk * H * 0.1,
    y: H * 0.18 + Math.max(0, -walk) * H * 0.04,
  };
  const handR = hands?.right ?? {
    x: H * 0.52 + walk * H * 0.1,
    y: H * 0.18 + Math.max(0, walk) * H * 0.04,
  };
  const elbowL = {
    x: (sleeveL.x + handL.x) * 0.5 - (hands ? 0 : H * 0.14),
    y: (sleeveL.y + handL.y) * 0.58,
  };
  const elbowR = {
    x: (sleeveR.x + handR.x) * 0.5 + (hands ? 0 : H * 0.14),
    y: (sleeveR.y + handR.y) * 0.58,
  };

  const drawLeg = (hip: FigPt, knee: FigPt, foot: FigPt) => {
    fillCapsule(ctx, hip, H * 0.26, knee, H * 0.2, skin);
    fillCapsule(ctx, { x: hip.x + H * 0.05, y: hip.y }, H * 0.09, { x: knee.x + H * 0.03, y: knee.y }, H * 0.06, skinHi);
    fillCapsule(ctx, knee, H * 0.2, foot, H * 0.14, style.socks);
    const cuff = luminance(style.socks) < 0.55
      ? mixHex(style.socks, '#f8fafc', 0.45)
      : shadeHex(style.socks, -0.25);
    ctx.fillStyle = cuff;
    ctx.beginPath();
    ctx.ellipse(knee.x, knee.y, H * 0.26, H * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.boot;
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y, H * 0.32, H * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(foot.x + H * 0.08, foot.y + H * 0.04, H * 0.22, H * 0.1, 0.15, 0, Math.PI * 2);
    ctx.fill();
  };

  drawLeg(hipL, kneeL, footL);
  drawLeg(hipR, kneeR, footR);

  const shortsGrad = ctx.createLinearGradient(-H * 0.4, -H * 0.2, H * 0.5, H * 0.9);
  shortsGrad.addColorStop(0, mixHex(style.shorts, '#ffffff', 0.14));
  shortsGrad.addColorStop(1, shadeHex(style.shorts, luminance(style.shorts) > 0.7 ? -0.14 : -0.2));
  traceShorts(ctx, H);
  ctx.fillStyle = shortsGrad;
  ctx.fill();
  ctx.strokeStyle = shadeHex(style.shorts, luminance(style.shorts) > 0.7 ? -0.22 : 0.1);
  ctx.lineWidth = Math.max(0.7, H * 0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -H * 0.04);
  ctx.lineTo(0, H * 0.78);
  ctx.stroke();

  const torsoGrad = ctx.createLinearGradient(-H * 0.5, collarY, H * 0.6, hemY);
  torsoGrad.addColorStop(0, mixHex(style.shirt, '#ffffff', 0.2));
  torsoGrad.addColorStop(0.4, style.shirt);
  torsoGrad.addColorStop(1, style.shirtDark);
  traceJersey(ctx, H, collarY, hemY);
  ctx.fillStyle = torsoGrad;
  ctx.fill();

  if (style.stripe && style.pattern && style.pattern !== 'solid') {
    ctx.save();
    traceJersey(ctx, H, collarY, hemY);
    ctx.clip();
    if (style.pattern === 'vertical') {
      const stripeW = Math.max(2, H * 0.28);
      for (let x = -H * 1.4, i = 0; x < H * 1.4; x += stripeW, i++) {
        if (i % 2 === 0) continue;
        ctx.fillStyle = style.stripe;
        ctx.fillRect(x, collarY - H * 0.2, stripeW, (hemY - collarY) + H * 0.5);
      }
    } else {
      const hoopH = Math.max(2.2, H * 0.26);
      for (let y = collarY, i = 0; y < hemY + H * 0.2; y += hoopH, i++) {
        if (i % 2 === 0) continue;
        ctx.fillStyle = style.stripe;
        ctx.fillRect(-H * 1.4, y, H * 2.8, hoopH);
      }
    }
    ctx.restore();
  }

  ctx.fillStyle = shadeHex(style.shirt, -0.14);
  ctx.beginPath();
  ctx.ellipse(0, collarY + H * 0.16, H * 0.22, H * 0.09, 0, 0, Math.PI);
  ctx.fill();

  fillCapsule(ctx, sleeveL, H * 0.14, elbowL, H * 0.125, skin, { start: false });
  fillCapsule(ctx, elbowL, H * 0.125, handL, H * 0.1, skin);
  fillCapsule(ctx, sleeveR, H * 0.14, elbowR, H * 0.125, skin, { start: false });
  fillCapsule(ctx, elbowR, H * 0.125, handR, H * 0.1, skin);

  if (style.glove) {
    drawGlove(ctx, handL, H, style.glove, style.gloveLine ?? shadeHex(style.glove, -0.35), -1);
    drawGlove(ctx, handR, H, style.glove, style.gloveLine ?? shadeHex(style.glove, -0.35), 1);
  } else {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(handL.x, handL.y, H * 0.11, H * 0.14, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(handR.x, handR.y, H * 0.11, H * 0.14, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = shadeHex(skin, -0.14);
  ctx.beginPath();
  ctx.ellipse(0, collarY + H * 0.14, H * 0.24, H * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-H * 0.2, collarY + H * 0.02);
  ctx.lineTo(H * 0.2, collarY + H * 0.02);
  ctx.lineTo(H * 0.16, head.y + H * 0.48);
  ctx.lineTo(-H * 0.16, head.y + H * 0.48);
  ctx.closePath();
  ctx.fill();
  const neckGrad = ctx.createLinearGradient(-H * 0.1, collarY, H * 0.12, head.y);
  neckGrad.addColorStop(0, shadeHex(skin, -0.1));
  neckGrad.addColorStop(1, skinHi);
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(-H * 0.18, collarY + H * 0.02);
  ctx.lineTo(H * 0.18, collarY + H * 0.02);
  ctx.lineTo(H * 0.155, head.y + H * 0.44);
  ctx.lineTo(-H * 0.155, head.y + H * 0.44);
  ctx.closePath();
  ctx.fill();

  drawAthleteHead(ctx, head.x, head.y, H, skin);
}

export function drawKeeper(ctx: CanvasRenderingContext2D, view: PitchView, pose: KeeperPose) {
  const H = (FIFA.keeperHeight / FIFA.goalHeight) * view.goal.heightPx / 8;
  const hips = goalToPixel(pose.pos, view);
  const groundY = view.goal.botY;
  const dir = pose.direction;
  const layout = clamp(pose.layout, 0, 1);
  const ang = keeperDiveAngle(dir, layout);

  const shadowW = H * (1.15 + layout * 2.4);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hips.x, groundY + H * 0.1, shadowW, H * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fill();
  ctx.restore();

  const handPx = goalToPixel(pose.hand, view);
  const wx = handPx.x - hips.x;
  const wy = handPx.y - hips.y;
  const cosA = Math.cos(ang);
  const sinA = Math.sin(ang);
  const localHx = wx * cosA + wy * sinA;
  const localHy = -wx * sinA + wy * cosA;
  const gloveL = { x: localHx - H * 0.32, y: localHy };
  const gloveR = { x: localHx + H * 0.36, y: localHy + H * 0.18 };

  ctx.save();
  ctx.translate(hips.x, hips.y);
  ctx.rotate(ang);
  drawHumanoid(
    ctx,
    H,
    {
      skin: pose.skinTone || PLAYER_SKIN_TONES[1],
      shirt: pose.beaten ? '#9ca3af' : '#fde047',
      shirtDark: pose.beaten ? '#4b5563' : '#ca8a04',
      shorts: pose.beaten ? '#1f2937' : '#14532d',
      socks: pose.beaten ? '#374151' : '#166534',
      boot: '#181818',
      glove: pose.beaten ? '#4b5563' : '#22c55e',
      gloveLine: pose.beaten ? '#1f2937' : '#166534',
    },
    0,
    { left: gloveL, right: gloveR },
    'ready',
  );
  ctx.restore();
}

/** Standing outfield defender in opposition kit, scaled by their world depth. */
export function drawDefender(
  ctx: CanvasRenderingContext2D,
  view: PitchView,
  worldX: number,
  worldZ: number,
  kit?: DefenderKit,
  stride = 0,
  skinTone?: string,
) {
  const meterPx = view.halfWidthPx(1, worldZ);
  const feet = worldToScreen(view, worldX, worldZ);
  const heightM = 1.82;
  const H = (heightM * meterPx) / 8;
  const hips = { x: feet.x, y: feet.y - 4 * H };

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(feet.x, feet.y + H * 0.08, H * 0.85, H * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(hips.x, hips.y);
  drawHumanoid(
    ctx,
    H,
    {
      skin: skinTone ?? PLAYER_SKIN_TONES[2],
      shirt: kit?.shirt ?? '#1d4ed8',
      shirtDark: kit?.shirtDark ?? '#1e3a8a',
      shorts: kit?.shorts ?? '#f8fafc',
      socks: kit?.socks ?? kit?.shorts ?? '#1e1e1e',
      boot: '#1a1a1a',
      stripe: kit?.stripe,
      pattern: kit?.pattern ?? 'solid',
    },
    stride,
    undefined,
    'walk',
  );
  ctx.restore();
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.ellipse(0, radius * 0.85, radius * 1.05, radius * 0.32, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fill();

  ctx.rotate(rotation);
  const ballGrad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.1, 0, 0, radius);
  ballGrad.addColorStop(0, '#ffffff');
  ballGrad.addColorStop(1, '#c9cdd3');
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = ballGrad;
  ctx.fill();

  ctx.strokeStyle = '#20232a';
  ctx.lineWidth = Math.max(1, radius * 0.09);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.5, -radius * 0.35);
  ctx.lineTo(radius * 0.5, -radius * 0.35);
  ctx.lineTo(radius * 0.62, radius * 0.25);
  ctx.lineTo(0, radius * 0.75);
  ctx.lineTo(-radius * 0.62, radius * 0.25);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.98, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}

export function drawTrail(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[]) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
