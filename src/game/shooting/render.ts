import type { AimPoint } from './types';

/** FIFA markings in metres. Boxes are drawn from these ratios to the goal
 * (7.32 × 2.44), so the 6-yard and 18-yard areas stay in true proportion
 * even when the pitch is scaled to show more grass. */
export const FIFA = {
  goalWidth: 7.32,
  goalHeight: 2.44,
  sixYardWidth: 18.32,
  sixYardDepth: 5.5,
  eighteenYardWidth: 40.32,
  eighteenYardDepth: 16.5,
  penaltySpot: 11,
  penaltyArcRadius: 9.15,
};

/** Layout of the goal plane within the canvas, as fractions of width/height.
 * The goal is smaller than the old close-up framing so more of the pitch is
 * visible; box widths/depths are derived from FIFA ratios, not fudge factors. */
export const LAYOUT = {
  /** Goal half-width as a fraction of canvas width. Small enough that the
   * 6-yard box sits clearly inside the frame with grass on both sides. */
  goalHalfWidth: 0.145,
  goalBottomY: 0.195,
  eighteenBottomY: 0.58,
  ballStartY: 0.84,
  /** Near (camera-side) edge of the 18-yard box vs its far (goal-line) edge. */
  perspectiveFlare: 1.22,
};

/** Inset from each canvas edge so a random spawn never sits under the HUD. */
export const BALL_SPAWN_X_MARGIN = 0.08;

export function randomBallStartXRatio(rng: () => number = Math.random): number {
  return BALL_SPAWN_X_MARGIN + rng() * (1 - 2 * BALL_SPAWN_X_MARGIN);
}

export interface GoalFrame {
  halfW: number;
  topY: number;
  botY: number;
  heightPx: number;
}

/** Pixel rect of the goal, always 7.32:2.44 regardless of canvas aspect. */
export function goalFrame(w: number, h: number): GoalFrame {
  const halfW = LAYOUT.goalHalfWidth * w;
  const botY = LAYOUT.goalBottomY * h;
  const heightPx = halfW * 2 * (FIFA.goalHeight / FIFA.goalWidth);
  return { halfW, topY: botY - heightPx, botY, heightPx };
}

export function goalToPixel(aim: AimPoint, w: number, h: number): { x: number; y: number } {
  const { halfW, topY, botY } = goalFrame(w, h);
  const x = w / 2 + aim.x * halfW;
  const y = botY - aim.y * (botY - topY);
  return { x, y };
}

export function ballStartPixel(w: number, h: number, xRatio = 0.5): { x: number; y: number } {
  return { x: xRatio * w, y: LAYOUT.ballStartY * h };
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

export function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0f3d1f');
  grad.addColorStop(0.4, '#155a29');
  grad.addColorStop(1, '#1f7a37');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const { halfW, topY, botY } = goalFrame(w, h);

  // Mowed-grass stripes converging toward the goal for a sense of perspective.
  const stripeCount = 9;
  const vanishY = topY - h * 0.12;
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
  const eighteenBottomY = LAYOUT.eighteenBottomY * h;
  const eighteenDepth = Math.max(1, eighteenBottomY - goalLineY);
  const sixDepth = eighteenDepth * (FIFA.sixYardDepth / FIFA.eighteenYardDepth);
  const penaltyDepth = eighteenDepth * (FIFA.penaltySpot / FIFA.eighteenYardDepth);
  const flare = LAYOUT.perspectiveFlare;

  const eighteenHalfTop = halfW * (FIFA.eighteenYardWidth / FIFA.goalWidth);
  const eighteenHalfBottom = eighteenHalfTop * flare;
  const sixHalfTop = halfW * (FIFA.sixYardWidth / FIFA.goalWidth);
  const sixT = FIFA.sixYardDepth / FIFA.eighteenYardDepth;
  const sixHalfBottom = sixHalfTop * (1 + (flare - 1) * sixT);

  // 18-yard penalty box. Width is 40.32m vs the 7.32m goal, so the sides run
  // off-screen on a portrait view — we're standing inside the box looking in.
  const penaltyBox: BoxSpec = {
    topY: goalLineY + h * 0.004,
    bottomY: eighteenBottomY,
    halfTop: eighteenHalfTop,
    halfBottom: eighteenHalfBottom,
  };
  // 6-yard box (goal area): 18.32m wide, 5.5m deep — one third of the 18-yard depth.
  const goalBox: BoxSpec = {
    topY: goalLineY + h * 0.004,
    bottomY: goalLineY + sixDepth,
    halfTop: sixHalfTop,
    halfBottom: sixHalfBottom,
  };

  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(2.5, w * 0.005);
  drawBoxOutline(ctx, w, penaltyBox);
  drawBoxOutline(ctx, w, goalBox);

  // Penalty arc: 9.15m radius around the spot (11m from the goal line),
  // clipped so only the "D" outside the 18-yard box is visible.
  const penaltySpotY = goalLineY + penaltyDepth;
  const pxPerMeterY = eighteenDepth / FIFA.eighteenYardDepth;
  const halfAtPenalty = lerp(eighteenHalfTop, eighteenHalfBottom, FIFA.penaltySpot / FIFA.eighteenYardDepth);
  const pxPerMeterX = (halfAtPenalty * 2) / FIFA.eighteenYardWidth;
  const arcRadiusX = FIFA.penaltyArcRadius * pxPerMeterX;
  const arcRadiusY = FIFA.penaltyArcRadius * pxPerMeterY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, penaltyBox.bottomY, w, Math.max(0, h - penaltyBox.bottomY));
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(w / 2, penaltySpotY, arcRadiusX, arcRadiusY, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(w / 2, penaltySpotY, Math.max(2, w * 0.0045), 0, Math.PI * 2);
  ctx.fill();

  // Subtle vignette + a faint animated light sweep for atmosphere.
  const sweepX = ((time / 6000) % 1) * w;
  const sweep = ctx.createRadialGradient(sweepX, h * 0.2, 0, sweepX, h * 0.2, w * 0.5);
  sweep.addColorStop(0, 'rgba(255,255,255,0.05)');
  sweep.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sweep;
  ctx.fillRect(0, 0, w, h);
}

export function drawGoal(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { halfW, topY, botY } = goalFrame(w, h);
  const postW = Math.max(3, w * 0.011);

  // Net (behind the frame).
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

  // Frame.
  ctx.strokeStyle = '#f5f7fa';
  ctx.lineWidth = postW;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(w / 2 - halfW, botY + postW);
  ctx.lineTo(w / 2 - halfW, topY);
  ctx.lineTo(w / 2 + halfW, topY);
  ctx.lineTo(w / 2 + halfW, botY + postW);
  ctx.stroke();

  // Faint 16×5 save-grid guides so the corners vs centre read on the goal.
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

/** Scale factor for the keeper figure, derived from the goal's own height so
 * the keeper always reads as human-sized against the goal, on any screen
 * aspect ratio - rather than an independent (and easily mismatched) fraction
 * of screen width. */
function keeperScale(w: number, h: number): number {
  return goalFrame(w, h).heightPx * 0.12;
}

export function drawKeeper(ctx: CanvasRenderingContext2D, w: number, h: number, pose: KeeperPose) {
  const { x } = goalToPixel({ x: pose.pos.x, y: 0 }, w, h);
  // The keeper's feet rest exactly on the goal line - the actual "ground" of
  // the goal mouth - so the idle stance never looks like it's floating.
  const groundY = goalFrame(w, h).botY;
  const scale = keeperScale(w, h);

  // Ground contact shadow, anchored to the pitch itself (not to the diving
  // body), which keeps the keeper visually grounded even mid-dive.
  const shadowStretch = 1 + pose.stretch * 3;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(
    x + pose.direction * pose.stretch * scale * 3.2,
    groundY + scale * 0.15,
    scale * 1.5 * shadowStretch,
    scale * 0.5,
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
  const stretchOffset = pose.stretch * pose.direction * scale * 4.2;
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
  // A goalkeeper's ready stance is already wide-legged and wide-armed, well
  // clear of the torso, so the limbs read as distinct shapes rather than
  // merging into the body silhouette at small render sizes.
  const legSpread = 1.5 + pose.stretch * 1.6;
  const armReach = 3.2 + pose.stretch * 3.6;

  // Legs (hip -> knee -> boot), splaying apart as the dive stretches out.
  ctx.strokeStyle = bootColor;
  ctx.lineWidth = scale * 0.8;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const kneeX = side * scale * (legSpread * 0.55 + 0.1);
    const kneeY = hipY + scale * (1.5 - pose.stretch * 0.3);
    const footX = side * scale * legSpread;
    ctx.beginPath();
    ctx.moveTo(side * scale * 0.5, hipY - scale * 0.1);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, 0);
    ctx.stroke();
  }
  ctx.fillStyle = bootColor;
  for (const side of [-1, 1]) {
    const footX = side * scale * legSpread;
    ctx.beginPath();
    ctx.ellipse(footX + side * scale * 0.15, 0, scale * 0.48, scale * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shorts.
  ctx.fillStyle = shortsColor;
  ctx.beginPath();
  ctx.ellipse(0, hipY + scale * 0.4, scale * 1.5, scale * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso / jersey - a rounded, shoulders-wider-than-waist shape with a
  // simple light-to-dark gradient for some volume.
  const torsoGrad = ctx.createLinearGradient(-scale * 1.9, shoulderY, scale * 1.9, hipY);
  torsoGrad.addColorStop(0, kitLight);
  torsoGrad.addColorStop(1, kitDark);
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(-scale * 1.9, shoulderY);
  ctx.quadraticCurveTo(-scale * 2.2, (shoulderY + hipY) / 2, -scale * 1.3, hipY);
  ctx.lineTo(scale * 1.3, hipY);
  ctx.quadraticCurveTo(scale * 2.2, (shoulderY + hipY) / 2, scale * 1.9, shoulderY);
  ctx.closePath();
  ctx.fill();

  // Arms (shoulder -> elbow -> gloved hand). Even at rest the keeper holds
  // hands up and out, ready to react - reaching further still with dive
  // stretch - so the arms are always clearly separated from the torso, with
  // a visible elbow bend rather than collapsing into a stub under the glove.
  ctx.strokeStyle = skinColor;
  ctx.lineWidth = scale * 0.58;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const shoulderX = side * scale * 1.85;
    const shoulderPtY = shoulderY + scale * 0.05;
    const elbowX = side * scale * (2.5 + pose.stretch * 1.3);
    const elbowY = shoulderY + scale * (0.4 - pose.stretch * 1.5);
    const handX = side * scale * armReach;
    const handY = shoulderY - scale * (0.35 + pose.stretch * 2.1);
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderPtY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
    ctx.fillStyle = gloveColor;
    ctx.beginPath();
    ctx.arc(handX, handY, scale * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pose.beaten ? '#1f2937' : '#166534';
    ctx.lineWidth = Math.max(1, scale * 0.12);
    ctx.stroke();
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = scale * 0.58;
  }

  // Neck + head.
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(0, headY, scale * 1.05, 0, Math.PI * 2);
  ctx.fill();
  // A soft hair/cap shadow across the top of the head for a touch of form.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(0, headY - scale * 0.1, scale * 1.05, Math.PI * 0.95, Math.PI * 2.05);
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
