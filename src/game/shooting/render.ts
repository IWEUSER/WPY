import type { AimPoint } from './types';

/** Layout of the goal plane within the canvas, as fractions of width/height. */
export const LAYOUT = {
  goalTopY: 0.15,
  goalBottomY: 0.36,
  goalHalfWidth: 0.27,
  ballStartY: 0.88,
  keeperGroundY: 0.335,
};

export function goalToPixel(aim: AimPoint, w: number, h: number): { x: number; y: number } {
  const x = w / 2 + aim.x * (LAYOUT.goalHalfWidth * w);
  const y = LAYOUT.goalBottomY * h - aim.y * ((LAYOUT.goalBottomY - LAYOUT.goalTopY) * h);
  return { x, y };
}

export function ballStartPixel(w: number, h: number): { x: number; y: number } {
  return { x: w / 2, y: LAYOUT.ballStartY * h };
}

export function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0f3d1f');
  grad.addColorStop(0.4, '#155a29');
  grad.addColorStop(1, '#1f7a37');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Mowed-grass stripes converging toward the goal for a sense of perspective.
  const stripeCount = 9;
  const vanishY = LAYOUT.goalTopY * h - h * 0.12;
  for (let i = 0; i < stripeCount; i++) {
    const t0 = i / stripeCount;
    const t1 = (i + 1) / stripeCount;
    ctx.beginPath();
    ctx.moveTo(lerp(0, w, t0), h);
    ctx.lineTo(lerp(0, w, t1), h);
    ctx.lineTo(lerp(w * 0.32, w * 0.68, t1), vanishY);
    ctx.lineTo(lerp(w * 0.32, w * 0.68, t0), vanishY);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)';
    ctx.fill();
  }

  // Penalty box.
  const boxTop = LAYOUT.goalBottomY * h + h * 0.02;
  const boxHalfTop = w * 0.34;
  const boxHalfBottom = w * 0.46;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.beginPath();
  ctx.moveTo(w / 2 - boxHalfTop, boxTop);
  ctx.lineTo(w / 2 - boxHalfBottom, h * 0.995);
  ctx.moveTo(w / 2 + boxHalfTop, boxTop);
  ctx.lineTo(w / 2 + boxHalfBottom, h * 0.995);
  ctx.moveTo(w / 2 - boxHalfTop, boxTop);
  ctx.lineTo(w / 2 + boxHalfTop, boxTop);
  ctx.stroke();

  // Penalty arc + spot.
  ctx.beginPath();
  ctx.ellipse(w / 2, boxTop + h * 0.02, w * 0.12, h * 0.02, 0, 0, Math.PI * 2);
  ctx.stroke();

  const spot = ballStartPixel(w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(spot.x, spot.y - h * 0.02, Math.max(2, w * 0.004), 0, Math.PI * 2);
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
  const topY = LAYOUT.goalTopY * h;
  const botY = LAYOUT.goalBottomY * h;
  const halfW = LAYOUT.goalHalfWidth * w;
  const postW = Math.max(3, w * 0.009);

  // Net (behind the frame).
  ctx.save();
  ctx.beginPath();
  ctx.rect(w / 2 - halfW, topY, halfW * 2, botY - topY);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  const netCols = 14;
  const netRows = 8;
  for (let i = 0; i <= netCols; i++) {
    const x = w / 2 - halfW + (i / netCols) * halfW * 2;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, botY + (botY - topY) * 0.3);
    ctx.stroke();
  }
  for (let j = 0; j <= netRows; j++) {
    const y = topY + (j / netRows) * (botY - topY) * 1.3;
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

  // Zone guide lines (very faint, purely a visual/aiming aid).
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - halfW / 3, topY);
  ctx.lineTo(w / 2 - halfW / 3, botY);
  ctx.moveTo(w / 2 + halfW / 3, topY);
  ctx.lineTo(w / 2 + halfW / 3, botY);
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

export function drawKeeper(ctx: CanvasRenderingContext2D, w: number, h: number, pose: KeeperPose) {
  const { x } = goalToPixel({ x: pose.pos.x, y: 0 }, w, h);
  const scale = w * 0.012;
  const groundY = LAYOUT.keeperGroundY * h;

  ctx.save();
  ctx.translate(x, groundY);
  const tilt = pose.direction * pose.stretch * 0.95;
  ctx.rotate(tilt);
  const stretchOffset = pose.stretch * pose.direction * scale * 5;
  ctx.translate(stretchOffset, -pose.stretch * scale * 1.5);

  ctx.fillStyle = pose.beaten ? '#374151' : '#facc15';
  // Torso
  ctx.beginPath();
  ctx.ellipse(0, -scale * 3, scale * 2.1, scale * 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#e8b48a';
  ctx.beginPath();
  ctx.arc(0, -scale * 6.1, scale * 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Arms (stretched out more when diving)
  ctx.strokeStyle = pose.beaten ? '#374151' : '#facc15';
  ctx.lineWidth = scale * 1.1;
  ctx.lineCap = 'round';
  const armSpread = 2 + pose.stretch * 3.4;
  ctx.beginPath();
  ctx.moveTo(-scale * 0.6, -scale * 4);
  ctx.lineTo(-scale * armSpread, -scale * (4 - pose.stretch * 2));
  ctx.moveTo(scale * 0.6, -scale * 4);
  ctx.lineTo(scale * armSpread, -scale * (4 - pose.stretch * 2));
  ctx.stroke();
  // Legs
  ctx.beginPath();
  ctx.moveTo(-scale * 0.8, -scale * 0.6);
  ctx.lineTo(-scale * (1.2 + pose.stretch * 1.5), scale * 0.6);
  ctx.moveTo(scale * 0.8, -scale * 0.6);
  ctx.lineTo(scale * (1.2 + pose.stretch * 1.5), scale * 0.6);
  ctx.stroke();

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
