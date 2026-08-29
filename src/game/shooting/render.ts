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

export function drawPitch(ctx: CanvasRenderingContext2D, view: PitchView, time: number) {
  const { w, h } = view;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0f3d1f');
  grad.addColorStop(0.4, '#155a29');
  grad.addColorStop(1, '#1f7a37');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const { halfW, botY } = view.goal;

  const stripeCount = 9;
  const vanishY = HORIZON_Y * h;
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
  const sweep = ctx.createRadialGradient(sweepX, h * 0.2, 0, sweepX, h * 0.2, w * 0.5);
  sweep.addColorStop(0, 'rgba(255,255,255,0.05)');
  sweep.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, w, h);
}

export function drawGoal(ctx: CanvasRenderingContext2D, view: PitchView) {
  const { w } = view;
  const { halfW, topY, botY } = view.goal;
  const postW = Math.max(2, halfW * 0.035);

  ctx.save();
  ctx.beginPath();
  ctx.rect(w / 2 - halfW, topY, halfW * 2, botY - topY);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  const netCols = 16;
  const netRows = 6;
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
  /** Primary glove in aim space — the square on a save, short of it on a miss. */
  hand: AimPoint;
}

/** Figure height is ~7.95×scale (feet at 0, top of head at 6.9+1.05). */
const KEEPER_FIGURE_HEIGHT = 7.95;
const KEEPER_HIP_FROM_FOOT = 3.0;
const KEEPER_SHOULDER_FROM_HIP = 2.5;
const KEEPER_HEAD_FROM_HIP = 3.9;

function keeperScale(view: PitchView): number {
  return (FIFA.keeperHeight / FIFA.goalHeight) * view.goal.heightPx / KEEPER_FIGURE_HEIGHT;
}

export function idleKeeperPose(): KeeperPose {
  return {
    pos: { x: 0, y: 0.28 },
    stretch: 0,
    direction: 0,
    beaten: false,
    layout: 0,
    elevation: 0,
    hand: { x: 0, y: 0.34 },
  };
}

export function drawKeeper(ctx: CanvasRenderingContext2D, view: PitchView, pose: KeeperPose) {
  const scale = keeperScale(view);
  const hips = goalToPixel(pose.pos, view);
  const handPx = goalToPixel(pose.hand, view);
  const groundY = view.goal.botY;
  const dir = pose.direction;
  const layout = clamp(pose.layout, 0, 1);
  // Counter-clockwise for a screen-right dive so the head stays central
  // and the gloves go to the ball, rather than a standing side-reach.
  const ang = -dir * layout * 1.22;
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const shoulderLocalY = -scale * KEEPER_SHOULDER_FROM_HIP;

  const toWorld = (lx: number, ly: number) => ({
    x: hips.x + lx * cos - ly * sin,
    y: hips.y + lx * sin + ly * cos,
  });

  const shadowW = scale * (1.15 + layout * 2.6);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hips.x, groundY + scale * 0.12, shadowW, scale * 0.34, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fill();
  ctx.restore();

  const kitLight = pose.beaten ? '#9ca3af' : '#fde047';
  const kitDark = pose.beaten ? '#4b5563' : '#ca8a04';
  const shortsColor = pose.beaten ? '#1f2937' : '#14532d';
  const skinColor = '#dfa878';
  const gloveColor = pose.beaten ? '#4b5563' : '#22c55e';
  const bootColor = '#181818';

  ctx.save();
  ctx.translate(hips.x, hips.y);
  ctx.rotate(ang);

  const hipY = 0;
  const shoulderY = shoulderLocalY;
  const headY = -scale * KEEPER_HEAD_FROM_HIP;
  const footY = scale * KEEPER_HIP_FROM_FOOT;
  const diveSide = dir === 0 ? 0 : dir;
  const kick = 0.7 + layout * 1.4 - pose.elevation * 0.25;

  ctx.strokeStyle = bootColor;
  ctx.lineWidth = scale * 0.62;
  ctx.lineCap = 'round';
  for (const side of [-1, 1] as const) {
    const along = diveSide === 0 ? side * kick * 0.55 : side === diveSide ? kick : -kick * 0.35;
    const kneeX = scale * along * 0.55;
    const kneeY = hipY + (footY - hipY) * 0.48 + (layout > 0.4 && side === diveSide ? scale * 0.4 : 0);
    const footX = scale * along;
    const footDrawY = footY * (1 - layout * 0.15);
    ctx.beginPath();
    ctx.moveTo(side * scale * 0.3, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footDrawY);
    ctx.stroke();
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.ellipse(footX + side * scale * 0.1, footDrawY, scale * 0.38, scale * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = shortsColor;
  ctx.beginPath();
  ctx.ellipse(0, hipY + scale * 0.25, scale * 1.05, scale * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  const torsoGrad = ctx.createLinearGradient(-scale * 1.35, shoulderY, scale * 1.35, hipY);
  torsoGrad.addColorStop(0, kitLight);
  torsoGrad.addColorStop(1, kitDark);
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(-scale * 1.3, shoulderY);
  ctx.quadraticCurveTo(-scale * 1.5, (shoulderY + hipY) / 2, -scale * 0.9, hipY);
  ctx.lineTo(scale * 0.9, hipY);
  ctx.quadraticCurveTo(scale * 1.5, (shoulderY + hipY) / 2, scale * 1.3, shoulderY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(0, headY, scale * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(0, headY - scale * 0.08, scale * 0.95, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
  ctx.restore();

  const leftShoulder = toWorld(-scale * 1.3, shoulderLocalY);
  const rightShoulder = toWorld(scale * 1.3, shoulderLocalY);

  const otherHand = goalToPixel(
    {
      x: pose.hand.x - (dir === 0 ? 0.08 : dir * 0.14),
      y: pose.hand.y + (layout > 0.45 ? 0.1 : 0.02) * (pose.beaten ? 1 : 0.4),
    },
    view,
  );

  const drawArm = (shoulder: { x: number; y: number }, glove: { x: number; y: number }) => {
    const mx = (shoulder.x + glove.x) / 2;
    const my = (shoulder.y + glove.y) / 2;
    const dx = glove.x - shoulder.x;
    const dy = glove.y - shoulder.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const elbowX = mx + (-dy / len) * scale * 0.7;
    const elbowY = my + (dx / len) * scale * 0.35;
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = scale * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(glove.x, glove.y);
    ctx.stroke();
    ctx.fillStyle = gloveColor;
    ctx.beginPath();
    ctx.arc(glove.x, glove.y, scale * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pose.beaten ? '#1f2937' : '#166534';
    ctx.lineWidth = Math.max(1, scale * 0.1);
    ctx.stroke();
  };

  if (dir < 0) {
    drawArm(rightShoulder, otherHand);
    drawArm(leftShoulder, handPx);
  } else {
    drawArm(leftShoulder, otherHand);
    drawArm(rightShoulder, handPx);
  }
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
