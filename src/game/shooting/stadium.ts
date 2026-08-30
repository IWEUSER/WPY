import {
  crowdSwatch,
  kitFromScheme,
  luminance,
  mixHex,
  shadeHex,
  type DefenderKit,
  type ShirtPattern,
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
  /** Floodlit evening kick-off. League and group games are daylight. */
  night?: boolean;
  /** Majority crowd — the side whose ground this is. */
  homeColor: string;
  homeSecondary?: string;
  /** Visiting pocket of the crowd. */
  awayColor: string;
  awaySecondary?: string;
  /** Defender shirt — always the opponent, not the stadium majority. */
  opponentColor: string;
  opponentSecondary?: string;
  opponentShorts?: string;
  opponentPattern?: ShirtPattern;
  /** 0–1 share of seats given to away fans. */
  awayShare?: number;
}

export const DEFAULT_STADIUM: StadiumAppearance = {
  isHome: true,
  night: false,
  homeColor: '#C8102E',
  awayColor: '#034694',
  opponentColor: '#034694',
  awayShare: 0.2,
};

export function defenderKitFromStadium(stadium: StadiumAppearance): DefenderKit {
  return kitFromScheme({
    primary: stadium.opponentColor,
    secondary: stadium.opponentSecondary,
    shorts: stadium.opponentShorts,
    pattern: stadium.opponentPattern,
  });
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

const SKIN_TONES = ['#f3d2b5', '#e0ac7b', '#c68642', '#8d5524', '#5c3317'];
const HAIR_TONES = ['#1c1917', '#292524', '#44403c', '#0c0a09', '#78350f', '#a8a29e'];
const JACKET_TONES = ['#1c1917', '#292524', '#44403c', '#0f172a', '#3f3f46'];

function shirtColor(
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
  const useSecondary = Boolean(secondary) && rng() < 0.42;
  const base = useSecondary && secondary ? secondary : primary;
  // Keep pale kits pale so dark heads read; only lift true black shirts.
  const worn = luminance(base) < 0.1 ? mixHex(base, '#6b7280', 0.32) : base;
  return shadeHex(worn, (rng() - 0.5) * 0.2);
}

function hoardingHeight(view: StadiumView): number {
  return Math.max(4, view.h * 0.012);
}

/** Bottom of the packed stand — sits on the advertising boards at the goal line. */
export function standBottomY(view: StadiumView): number {
  return view.goal.botY - hoardingHeight(view);
}

/** Head/torso cell size in CSS pixels so close-up crowds read as people, not a wall. */
export function crowdCellSize(standHeightPx: number): { rowH: number; colW: number } {
  const rowH = Math.min(11, Math.max(3.2, standHeightPx / 42));
  const colW = Math.min(9, Math.max(2.8, rowH * 0.82));
  return { rowH, colW };
}

function fillQuad(
  ctx: CanvasRenderingContext2D,
  tl: { x: number; y: number },
  tr: { x: number; y: number },
  br: { x: number; y: number },
  bl: { x: number; y: number },
  fill: string,
) {
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function paintPackedFans(
  ctx: CanvasRenderingContext2D,
  tl: { x: number; y: number },
  tr: { x: number; y: number },
  br: { x: number; y: number },
  bl: { x: number; y: number },
  rng: () => number,
  stadium: StadiumAppearance,
  viewW: number,
) {
  const awayShare = stadium.awayShare ?? 0.2;
  const minX = Math.min(tl.x, tr.x, br.x, bl.x);
  const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
  const minY = Math.min(tl.y, tr.y, br.y, bl.y);
  const maxY = Math.max(tl.y, tr.y, br.y, bl.y);
  const standH = Math.max(8, maxY - minY);
  const { rowH, colW } = crowdCellSize(standH);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.clip();

  let row = 0;
  for (let y = minY; y < maxY + rowH; y += rowH) {
    const aisle = row % 9 === 8;
    const stagger = (row & 1) ? colW * 0.48 : 0;
    row += 1;
    if (aisle) {
      ctx.fillStyle = 'rgba(15,23,42,0.28)';
      ctx.fillRect(minX, y + rowH * 0.15, maxX - minX, rowH * 0.7);
      continue;
    }
    for (let x = minX - colW; x < maxX + colW; x += colW) {
      if (rng() > 0.985) continue;
      const px = x + stagger + (rng() - 0.5) * colW * 0.28;
      const py = y + (rng() - 0.5) * rowH * 0.18;
      const u = Math.max(0, Math.min(1, px / Math.max(1, viewW)));
      const torsoW = colW * (0.72 + rng() * 0.22);
      const torsoH = rowH * 0.58;
      ctx.fillStyle = shirtColor(
        rng,
        stadium.homeColor,
        stadium.homeSecondary,
        stadium.awayColor,
        stadium.awaySecondary,
        awayShare,
        u,
      );
      ctx.fillRect(px, py + rowH * 0.38, torsoW, torsoH);
      if (rng() < 0.2) {
        ctx.fillStyle = JACKET_TONES[(rng() * JACKET_TONES.length) | 0];
        ctx.fillRect(px, py + rowH * 0.42, torsoW, torsoH * 0.62);
      }
      const headW = colW * 0.42;
      const headH = rowH * 0.4;
      const hx = px + torsoW * 0.28;
      const hy = py + rowH * 0.08;
      ctx.fillStyle = HAIR_TONES[(rng() * HAIR_TONES.length) | 0];
      ctx.fillRect(hx, hy, headW, headH);
      ctx.fillStyle = SKIN_TONES[(rng() * SKIN_TONES.length) | 0];
      ctx.fillRect(hx + headW * 0.12, hy + headH * 0.38, headW * 0.76, headH * 0.55);
    }
  }
  ctx.restore();
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
    stadium.night ? 'n' : 'd',
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
  const standBottom = standBottomY(view);
  const standTop = Math.min(h * 0.028, standBottom * 0.12);

  const terrace = crowdSwatch(mixHex(stadium.homeColor, stadium.night ? '#111827' : '#3f3f46', 0.62));
  const farTl = { x: w * -0.02, y: standTop };
  const farTr = { x: w * 1.02, y: standTop };
  const farBr = { x: w * 1.06, y: standBottom };
  const farBl = { x: w * -0.06, y: standBottom };
  fillQuad(ctx, farTl, farTr, farBr, farBl, terrace);
  paintPackedFans(ctx, farTl, farTr, farBr, farBl, rng, stadium, w);

  const leftTl = { x: -w * 0.05, y: standTop };
  const leftTr = { x: w * 0.22, y: standTop + (standBottom - standTop) * 0.42 };
  const leftBr = { x: w * 0.14, y: Math.min(h * 0.58, standBottom + h * 0.14) };
  const leftBl = { x: -w * 0.06, y: Math.min(h * 0.52, standBottom + h * 0.1) };
  fillQuad(ctx, leftTl, leftTr, leftBr, leftBl, terrace);
  paintPackedFans(ctx, leftTl, leftTr, leftBr, leftBl, rng, stadium, w);

  const rightTl = { x: w * 0.78, y: standTop + (standBottom - standTop) * 0.42 };
  const rightTr = { x: w * 1.05, y: standTop };
  const rightBr = { x: w * 1.06, y: Math.min(h * 0.52, standBottom + h * 0.1) };
  const rightBl = { x: w * 0.86, y: Math.min(h * 0.58, standBottom + h * 0.14) };
  fillQuad(ctx, rightTl, rightTr, rightBr, rightBl, mixHex(terrace, crowdSwatch(stadium.awayColor), 0.35));
  paintPackedFans(ctx, rightTl, rightTr, rightBr, rightBl, rng, stadium, w);

  crowdCache = { key, canvas };
  return canvas;
}

function drawRoof(ctx: CanvasRenderingContext2D, w: number, h: number, night: boolean) {
  // Keep the canopy as a thin lid at the top of the frame so a 6-yard camera
  // does not paint a dark void over the terrace behind the net.
  const lip = h * 0.038;
  if (night) {
    ctx.fillStyle = '#0b0f18';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, lip);
    ctx.quadraticCurveTo(w * 0.5, h * 0.055, 0, lip);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  } else {
    ctx.strokeStyle = 'rgba(71,85,105,0.4)';
  }
  ctx.lineWidth = Math.max(2, w * 0.006);
  ctx.beginPath();
  ctx.moveTo(w * 0.04, h * 0.028);
  ctx.quadraticCurveTo(w * 0.5, h * 0.05, w * 0.96, h * 0.028);
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
  const thickness = hoardingHeight(view);
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

function drawBowlStructure(ctx: CanvasRenderingContext2D, w: number, h: number, standBottom: number, night: boolean) {
  const concrete = ctx.createLinearGradient(0, 0, 0, standBottom);
  if (night) {
    concrete.addColorStop(0, '#1f2937');
    concrete.addColorStop(1, '#111827');
  } else {
    concrete.addColorStop(0, '#9aa7b8');
    concrete.addColorStop(1, '#6b7789');
  }
  ctx.fillStyle = concrete;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.02);
  ctx.lineTo(w, h * 0.02);
  ctx.lineTo(w, standBottom);
  ctx.lineTo(0, standBottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = night ? '#0f172a' : '#7b8796';
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
 * Stadium bowl behind the goal. League and group games are daylight;
 * European club ties and international knockouts are floodlit nights.
 */
export function drawStadium(
  ctx: CanvasRenderingContext2D,
  view: StadiumView,
  time: number,
  stadium: StadiumAppearance = DEFAULT_STADIUM,
) {
  const { w, h } = view;
  const standBottom = standBottomY(view);
  const night = Boolean(stadium.night);

  const sky = ctx.createLinearGradient(0, 0, 0, standBottom + h * 0.1);
  if (night) {
    sky.addColorStop(0, '#070b16');
    sky.addColorStop(0.45, '#152038');
    sky.addColorStop(1, '#243044');
  } else {
    sky.addColorStop(0, '#2f86d4');
    sky.addColorStop(0.4, '#7ec4f0');
    sky.addColorStop(1, '#f6d9a0');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, standBottom + h * 0.04);
  ctx.fillStyle = night ? '#0b1220' : '#8a97a8';
  ctx.fillRect(0, standBottom, w, Math.max(0, h - standBottom));

  drawBowlStructure(ctx, w, h, standBottom, night);

  drawRoof(ctx, w, h, night);

  const crowd = crowdLayer(w, h, view, stadium);
  ctx.drawImage(crowd, 0, 0, w, h);

  if (night) {
    const lampY = Math.max(h * 0.055, view.goal.topY - h * 0.06);
    const lampScale = Math.max(8, view.goal.halfW * 0.12);
    drawFloodlight(ctx, w / 2 - view.goal.halfW * 1.42, lampY, time, lampScale);
    drawFloodlight(ctx, w / 2 + view.goal.halfW * 1.42, lampY, time, lampScale);

    const wash = ctx.createRadialGradient(w / 2, view.goal.botY, 0, w / 2, view.goal.botY, w * 0.55);
    wash.addColorStop(0, 'rgba(255,244,210,0.07)');
    wash.addColorStop(1, 'rgba(255,244,210,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, standBottom + h * 0.08);
  } else {
    const sun = ctx.createRadialGradient(w * 0.78, h * 0.05, 0, w * 0.78, h * 0.05, w * 0.42);
    sun.addColorStop(0, 'rgba(255,252,220,0.55)');
    sun.addColorStop(0.18, 'rgba(255,236,170,0.22)');
    sun.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, standBottom + h * 0.1);
  }

  drawHoardings(ctx, view, stadium);
}
