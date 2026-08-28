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

/** Camera sits this many metres behind the ball so the ball's screen Y stays fixed. */
export const CAM_BEHIND_M = 9;
export const HORIZON_Y = 0.1;
/** Ball is always this fraction down the canvas, so the gap from the bottom is constant. */
export const BALL_SCREEN_Y = 0.84;
/** Dimensionless focal length: (metres / depth) × focal = fraction of canvas width. */
export const CAMERA_FOCAL = 1.12;
export const MIN_SHOT_DISTANCE_M = 11;
export const MAX_SHOT_DISTANCE_M = 20;

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

/** Perspective camera looking at the goal, with the ball pinned at BALL_SCREEN_Y. */
export function createPitchView(w: number, h: number, distanceM: number): PitchView {
  const d = clamp(distanceM, MIN_SHOT_DISTANCE_M, MAX_SHOT_DISTANCE_M);
  const camZ = d + CAM_BEHIND_M;
  const lift = (BALL_SCREEN_Y - HORIZON_Y) * CAM_BEHIND_M;

  function screenY(worldZ: number): number {
    const depth = Math.max(0.4, camZ - worldZ);
    return (HORIZON_Y + lift / depth) * h;
  }

  function halfWidthPx(worldHalfM: number, worldZ: number): number {
    const depth = Math.max(0.4, camZ - worldZ);
    return (worldHalfM / depth) * CAMERA_FOCAL * w;
  }

  const halfW = halfWidthPx(FIFA.goalWidth / 2, 0);
  const botY = screenY(0);
  const heightPx = halfW * 2 * (FIFA.goalHeight / FIFA.goalWidth);
  const goal: GoalFrame = { halfW, topY: botY - heightPx, botY, heightPx };

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
  /** Normalized aim-space position of the keeper's center. */
  pos: AimPoint;
  /** 0 = standing, 1 = fully stretched/dived. */
  stretch: number;
  /** -1 = diving left, 0 = center/no dive, 1 = diving right. */
  direction: number;
  beaten: boolean;
}

/** Figure height is ~7.95×scale (feet at 0, top of head at 6.9+1.05). */
const KEEPER_FIGURE_HEIGHT = 7.95;

function keeperScale(view: PitchView): number {
  return (FIFA.keeperHeight / FIFA.goalHeight) * view.goal.heightPx / KEEPER_FIGURE_HEIGHT;
}

export function drawKeeper(ctx: CanvasRenderingContext2D, view: PitchView, pose: KeeperPose) {
  const { x } = goalToPixel({ x: pose.pos.x, y: 0 }, view);
  const groundY = view.goal.botY;
  const scale = keeperScale(view);

  const shadowStretch = 1 + pose.stretch * 3;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    x + pose.direction * pose.stretch * scale * 2.4,
    groundY + scale * 0.15,
    scale * 1.15 * shadowStretch,
    scale * 0.4,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, groundY);
  const tilt = pose.direction * pose.stretch * 1.05;
  ctx.rotate(tilt);
  const stretchOffset = pose.stretch * pose.direction * scale * 3.2;
  ctx.translate(stretchOffset, -pose.stretch * scale * 1.1);

  const kitLight = pose.beaten ? '#9ca3af' : '#fde047';
  const kitDark = pose.beaten ? '#4b5563' : '#ca8a04';
  const shortsColor = pose.beaten ? '#1f2937' : '#14532d';
  const skinColor = '#dfa878';
  const gloveColor = pose.beaten ? '#4b5563' : '#22c55e';
  const bootColor = '#181818';

  const hipY = -scale * 3.0;
  const shoulderY = -scale * 5.5;
  const headY = -scale * 6.9;
  const legSpread = 0.9 + pose.stretch * 1.5;
  // Resting arm span ≈ 1.4m against a 7.32m goal; dive stretches further.
  const armReach = 2.55 + pose.stretch * 2.8;

  ctx.strokeStyle = bootColor;
  ctx.lineWidth = scale * 0.62;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const kneeX = side * scale * (legSpread * 0.5 + 0.08);
    const kneeY = hipY + scale * (1.5 - pose.stretch * 0.3);
    const footX = side * scale * legSpread;
    ctx.beginPath();
    ctx.moveTo(side * scale * 0.35, hipY - scale * 0.1);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, 0);
    ctx.stroke();
  }
  ctx.fillStyle = bootColor;
  for (const side of [-1, 1]) {
    const footX = side * scale * legSpread;
    ctx.beginPath();
    ctx.ellipse(footX + side * scale * 0.12, 0, scale * 0.38, scale * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = shortsColor;
  ctx.beginPath();
  ctx.ellipse(0, hipY + scale * 0.35, scale * 1.05, scale * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  const torsoGrad = ctx.createLinearGradient(-scale * 1.35, shoulderY, scale * 1.35, hipY);
  torsoGrad.addColorStop(0, kitLight);
  torsoGrad.addColorStop(1, kitDark);
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(-scale * 1.35, shoulderY);
  ctx.quadraticCurveTo(-scale * 1.55, (shoulderY + hipY) / 2, -scale * 0.95, hipY);
  ctx.lineTo(scale * 0.95, hipY);
  ctx.quadraticCurveTo(scale * 1.55, (shoulderY + hipY) / 2, scale * 1.35, shoulderY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = skinColor;
  ctx.lineWidth = scale * 0.48;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const shoulderX = side * scale * 1.3;
    const shoulderPtY = shoulderY + scale * 0.05;
    const elbowX = side * scale * (1.85 + pose.stretch * 1.1);
    const elbowY = shoulderY + scale * (0.35 - pose.stretch * 1.4);
    const handX = side * scale * armReach;
    const handY = shoulderY - scale * (0.3 + pose.stretch * 1.9);
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderPtY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.fillStyle = gloveColor;
    ctx.beginPath();
    ctx.arc(handX, handY, scale * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pose.beaten ? '#1f2937' : '#166534';
    ctx.lineWidth = Math.max(1, scale * 0.1);
    ctx.stroke();
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = scale * 0.48;
  }

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(0, headY, scale * 0.95, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(0, headY - scale * 0.08, scale * 0.95, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();

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
