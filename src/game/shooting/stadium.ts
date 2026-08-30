import {
  crowdSwatch,
  kitFromColor,
  mixHex,
  shadeHex,
  type DefenderKit,
} from './kitPalette';

/** Minimal camera slice the bowl needs — compatible with `PitchView`. */
export interface StadiumView {
  w: number;
  h: number;
  goal: { halfW: number; topY: number; botY: number };
}

export interface StadiumAppearance {
  /** True when the player's club/country is the home side. */
  isHome: boolean;
  /** Majority crowd — the side whose ground this is. */
  homeColor: string;
  homeSecondary?: string;
  /** Visiting pocket of the crowd. */
  awayColor: string;
  awaySecondary?: string;
  /** Defender shirt — always the opponent, not the stadium majority. */
  opponentColor: string;
  opponentSecondary?: string;
  /** 0–1 share of seats given to away fans. */
  awayShare?: number;
}

export const DEFAULT_STADIUM: StadiumAppearance = {
  isHome: true,
  homeColor: '#C8102E',
  awayColor: '#034694',
  opponentColor: '#034694',
  awayShare: 0.2,
};

export function defenderKitFromStadium(stadium: StadiumAppearance): DefenderKit {
  return kitFromColor(stadium.opponentColor);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Bilinear sample of a quad (tl, tr, br, bl). */
function quadPoint(
  tl: { x: number; y: number },
  tr: { x: number; y: number },
  br: { x: number; y: number },
  bl: { x: number; y: number },
  u: number,
  v: number,
): { x: number; y: number } {
  const topX = lerp(tl.x, tr.x, u);
  const topY = lerp(tl.y, tr.y, u);
  const botX = lerp(bl.x, br.x, u);
  const botY = lerp(bl.y, br.y, u);
  return { x: lerp(topX, botX, v), y: lerp(topY, botY, v) };
}

function seatColor(
  rng: () => number,
  home: string,
  homeSecondary: string | undefined,
  away: string,
  awaySecondary: string | undefined,
  awayShare: number,
  u: number,
): string {
  const awayStart = 1 - Math.min(0.42, Math.max(0.14, awayShare));
  const visiting = u > awayStart;
  const primary = visiting ? away : home;
  const secondary = visiting ? awaySecondary : homeSecondary;
  const useSecondary = Boolean(secondary) && rng() < 0.22;
  const base = useSecondary && secondary ? secondary : primary;
  return crowdSwatch(shadeHex(base, (rng() - 0.5) * 0.38));
}

function paintSeats(
  ctx: CanvasRenderingContext2D,
  tl: { x: number; y: number },
  tr: { x: number; y: number },
  br: { x: number; y: number },
  bl: { x: number; y: number },
  rng: () => number,
  stadium: StadiumAppearance,
  rows: number,
  cols: number,
) {
  const awayShare = stadium.awayShare ?? 0.2;
  const height = Math.abs(bl.y - tl.y) + Math.abs(br.y - tr.y);
  const seatH = Math.max(1.4, height / (rows * 2.1));
  const seatW = Math.max(1.6, (Math.abs(tr.x - tl.x) + Math.abs(br.x - bl.x)) / (cols * 2.2));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() > 0.93) continue;
      const u = (c + 0.15 + rng() * 0.7) / cols;
      const v = (r + 0.15 + rng() * 0.7) / rows;
      const p = quadPoint(tl, tr, br, bl, u, v);
      ctx.fillStyle = seatColor(
        rng,
        stadium.homeColor,
        stadium.homeSecondary,
        stadium.awayColor,
        stadium.awaySecondary,
        awayShare,
        u,
      );
      ctx.fillRect(p.x, p.y, seatW, seatH);
    }
  }
}

interface CrowdCache {
  key: string;
  canvas: HTMLCanvasElement;
}

let crowdCache: CrowdCache | null = null;

function crowdLayer(w: number, h: number, view: StadiumView, stadium: StadiumAppearance): HTMLCanvasElement {
  const key = [
    w | 0,
    h | 0,
    stadium.homeColor,
    stadium.homeSecondary ?? '',
    stadium.awayColor,
    stadium.awaySecondary ?? '',
    (stadium.awayShare ?? 0.2).toFixed(2),
    view.goal.botY.toFixed(1),
    view.goal.topY.toFixed(1),
  ].join('|');
  if (crowdCache?.key === key) return crowdCache.canvas;

  const canvas = crowdCache?.canvas && crowdCache.canvas.width === w && crowdCache.canvas.height === h
    ? crowdCache.canvas
    : document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, w, h);
  const rng = mulberry32(hashKey(key));
  const goalLine = view.goal.botY;
  const standBottom = Math.min(h * 0.22, goalLine + h * 0.012);

  const farTl = { x: w * 0.06, y: h * 0.018 };
  const farTr = { x: w * 0.94, y: h * 0.018 };
  const farBr = { x: w * 1.02, y: standBottom };
  const farBl = { x: w * -0.02, y: standBottom };
  paintSeats(ctx, farTl, farTr, farBr, farBl, rng, stadium, 16, 64);

  const leftTl = { x: -w * 0.02, y: standBottom * 0.72 };
  const leftTr = { x: w * 0.18, y: standBottom };
  const leftBr = { x: w * 0.06, y: h * 0.62 };
  const leftBl = { x: -w * 0.04, y: h * 0.56 };
  paintSeats(ctx, leftTl, leftTr, leftBr, leftBl, rng, stadium, 10, 12);

  const rightTl = { x: w * 0.82, y: standBottom };
  const rightTr = { x: w * 1.02, y: standBottom * 0.72 };
  const rightBr = { x: w * 1.04, y: h * 0.56 };
  const rightBl = { x: w * 0.94, y: h * 0.62 };
  paintSeats(ctx, rightTl, rightTr, rightBr, rightBl, rng, stadium, 10, 12);

  crowdCache = { key, canvas };
  return canvas;
}

function drawRoof(ctx: CanvasRenderingContext2D, w: number, h: number, standBottom: number) {
  ctx.fillStyle = '#0b0f18';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h * 0.04);
  ctx.quadraticCurveTo(w * 0.5, h * 0.09, 0, h * 0.04);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = Math.max(2, w * 0.006);
  ctx.beginPath();
  ctx.moveTo(w * 0.04, h * 0.038);
  ctx.quadraticCurveTo(w * 0.5, standBottom * 0.22, w * 0.96, h * 0.038);
  ctx.stroke();
}

function drawFloodlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  scale: number,
) {
  const pulse = 0.82 + 0.18 * Math.sin(time / 380 + x);
  const r = scale * 2.8;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
  glow.addColorStop(0, `rgba(255,249,220,${0.55 * pulse})`);
  glow.addColorStop(0.35, `rgba(255,244,200,${0.18 * pulse})`);
  glow.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c1917';
  ctx.fillRect(x - scale * 0.22, y - scale * 1.8, scale * 0.44, scale * 2.1);
  ctx.fillStyle = '#f5f0d8';
  ctx.beginPath();
  ctx.ellipse(x, y - scale * 0.15, scale * 0.85, scale * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawHoardings(
  ctx: CanvasRenderingContext2D,
  view: StadiumView,
  stadium: StadiumAppearance,
) {
  const { w } = view;
  const y = view.goal.botY;
  const thickness = Math.max(4, view.h * 0.012);
  const left = w * 0.04;
  const right = w * 0.96;
  ctx.fillStyle = '#111827';
  ctx.fillRect(left, y - thickness, right - left, thickness);

  const segments = 14;
  for (let i = 0; i < segments; i++) {
    const x0 = lerp(left, right, i / segments);
    const x1 = lerp(left, right, (i + 1) / segments);
    const homeBand = i % 3 !== 2;
    ctx.fillStyle = homeBand
      ? mixHex(stadium.homeColor, '#111827', 0.15)
      : mixHex(stadium.awayColor, '#111827', 0.2);
    ctx.fillRect(x0 + 1, y - thickness + 1, Math.max(1, x1 - x0 - 2), thickness - 2);
  }
}

function drawBowlStructure(ctx: CanvasRenderingContext2D, w: number, h: number, standBottom: number) {
  const concrete = ctx.createLinearGradient(0, 0, 0, standBottom);
  concrete.addColorStop(0, '#1f2937');
  concrete.addColorStop(1, '#111827');
  ctx.fillStyle = concrete;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.02);
  ctx.lineTo(w, h * 0.02);
  ctx.lineTo(w, standBottom);
  ctx.lineTo(0, standBottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(0, standBottom * 0.55);
  ctx.lineTo(w * 0.2, standBottom);
  ctx.lineTo(0, h * 0.48);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, standBottom * 0.55);
  ctx.lineTo(w * 0.8, standBottom);
  ctx.lineTo(w, h * 0.48);
  ctx.closePath();
  ctx.fill();
}

/**
 * Night-time bowl behind the goal: sky, stands, kit-coloured crowd, roof,
 * floodlights. Drawn before the grass so the pitch sits in front.
 */
export function drawStadium(
  ctx: CanvasRenderingContext2D,
  view: StadiumView,
  time: number,
  stadium: StadiumAppearance = DEFAULT_STADIUM,
) {
  const { w, h } = view;
  const standBottom = Math.min(h * 0.22, view.goal.botY + h * 0.012);

  const sky = ctx.createLinearGradient(0, 0, 0, standBottom + h * 0.1);
  sky.addColorStop(0, '#070b16');
  sky.addColorStop(0.45, '#152038');
  sky.addColorStop(1, '#243044');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, standBottom + h * 0.04);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, standBottom, w, Math.max(0, h - standBottom));

  drawBowlStructure(ctx, w, h, standBottom);

  const crowd = crowdLayer(w, h, view, stadium);
  ctx.drawImage(crowd, 0, 0, w, h);

  drawRoof(ctx, w, h, standBottom);

  const lampY = Math.max(h * 0.055, view.goal.topY - h * 0.06);
  const lampScale = Math.max(8, view.goal.halfW * 0.12);
  drawFloodlight(ctx, w / 2 - view.goal.halfW * 1.42, lampY, time, lampScale);
  drawFloodlight(ctx, w / 2 + view.goal.halfW * 1.42, lampY, time, lampScale);

  const wash = ctx.createRadialGradient(w / 2, view.goal.botY, 0, w / 2, view.goal.botY, w * 0.55);
  wash.addColorStop(0, 'rgba(255,244,210,0.07)');
  wash.addColorStop(1, 'rgba(255,244,210,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, standBottom + h * 0.08);

  drawHoardings(ctx, view, stadium);
}
