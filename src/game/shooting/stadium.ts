import {
  kitFromScheme,
  luminance,
  mixHex,
  shadeHex,
  type DefenderKit,
  type ShirtPattern,
} from './kitPalette';
import {
  BERNABEU_CAPACITY,
  type ClubGround,
  type StandTiers,
} from './grounds';

/** Minimal camera slice the bowl needs — compatible with `PitchView`. */
export interface StadiumView {
  w: number;
  h: number;
  goal: { halfW: number; topY: number; botY: number };
}

/**
 * Coarse bowl size, derived from capacity. Prefer `capacity` + `standTiers`
 * on the appearance; this remains for `?scale=` shortcuts and occupancy.
 */
export type StadiumScale = 'elite' | 'strong' | 'local';

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
  /** Coarse shortcut when capacity/tiers are omitted (`?scale=`). */
  scale?: StadiumScale;
  /** Seats — stand height is proportional to this. Camp Nou is the ceiling. */
  capacity?: number;
  /** How many decks are stacked behind the goal (1–5). */
  standTiers?: StandTiers;
  unique?: 'camp-nou';
  groundName?: string;
}

export function stadiumScaleFromCapacity(capacity: number): StadiumScale {
  if (capacity >= 70_000) return 'elite';
  if (capacity >= 40_000) return 'strong';
  return 'local';
}

/** @deprecated Use capacity/tiers. Kept for `?scale=` and older tests. */
export function stadiumScaleFromTier(tier: number | undefined): StadiumScale {
  if (tier === 1) return 'elite';
  if (tier === 2) return 'strong';
  return 'local';
}

export function profileFromScale(scale: StadiumScale): ClubGround {
  if (scale === 'elite') {
    return { name: 'Camp Nou', capacity: 105_000, tiers: 5, unique: 'camp-nou' };
  }
  if (scale === 'strong') return { name: 'Allianz Arena', capacity: 75_000, tiers: 3 };
  return { name: 'Municipal Stadium', capacity: 28_000, tiers: 2 };
}

export function profileFromAppearance(stadium: StadiumAppearance): ClubGround {
  if (stadium.capacity != null && stadium.standTiers != null) {
    return {
      name: stadium.groundName ?? 'Stadium',
      capacity: stadium.capacity,
      tiers: stadium.standTiers,
      unique: stadium.unique,
    };
  }
  return profileFromScale(stadium.scale ?? 'elite');
}

export const DEFAULT_STADIUM: StadiumAppearance = {
  isHome: true,
  night: false,
  homeColor: '#C8102E',
  awayColor: '#034694',
  opponentColor: '#034694',
  awayShare: 0.2,
  scale: 'elite',
  capacity: 105_000,
  standTiers: 5,
  unique: 'camp-nou',
  groundName: 'Camp Nou',
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

const SKIN_TONES = ['#e8c4a0', '#c68642', '#8d5524', '#5c3317', '#d4a574'];
const HAIR_TONES = ['#1c1917', '#0c0a09', '#292524', '#1a120c', '#44403c'];
const JACKET_TONES = ['#1c1917', '#292524', '#111827', '#1e3a5f', '#3f3f46', '#0f172a'];
const CIVILIAN_TONES = ['#1e3a5f', '#111827', '#365314', '#7f1d1d', '#374151', '#1f2937'];

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

export interface StadiumLayout {
  top: number;
  bottom: number;
  aisleEvery: number;
  occupancy: number;
  roof: boolean;
  scale: StadiumScale;
  tiers: StandTiers;
  capacity: number;
  unique?: 'camp-nou';
  decks: { top: number; bottom: number }[];
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/**
 * Stand height from capacity. Bernabéu is the tallest ordinary bowl;
 * Camp Nou is uniquely taller. Unlisted municipals stay below the table.
 */
export function standTopFrac(capacity: number, unique?: 'camp-nou'): number {
  if (unique === 'camp-nou') return 0.012;
  const minCap = 18_000;
  const t = clamp01((capacity - minCap) / (BERNABEU_CAPACITY - minCap));
  return lerp(0.48, 0.055, t ** 0.9);
}

/**
 * Even seating rings with a thinner concrete walkway between each pair.
 * Walkways stay well below deck height so they read as separators, not extra
 * tiers. The goal sits in front of the lower bowl — it must not split a ring.
 */
export function deckWalkwayPx(standHeight: number, tiers: number): number {
  if (tiers <= 1) return 0;
  return Math.max(8, Math.min(16, standHeight * 0.038));
}

function deckBands(
  top: number,
  bottom: number,
  tiers: number,
): { top: number; bottom: number }[] {
  const height = Math.max(8, bottom - top);
  if (tiers <= 1) return [{ top, bottom }];
  const gap = deckWalkwayPx(height, tiers);
  const evenUsable = height - gap * (tiers - 1);
  const evenH = evenUsable / tiers;
  const decks: { top: number; bottom: number }[] = [];
  let y = top;
  for (let i = 0; i < tiers; i++) {
    const deckBot = i === tiers - 1 ? bottom : y + evenH;
    decks.push({ top: y, bottom: deckBot });
    y = deckBot + gap;
  }
  return decks;
}

function isStadiumScale(spec: StadiumScale | ClubGround): spec is StadiumScale {
  return spec === 'elite' || spec === 'strong' || spec === 'local';
}

/** Terrace height, deck count, and roof from the home club's ground. */
export function stadiumLayout(
  view: StadiumView,
  spec: StadiumScale | ClubGround = 'elite',
): StadiumLayout {
  const ground = isStadiumScale(spec) ? profileFromScale(spec) : spec;
  const bottom = standBottomY(view);
  const topFrac = standTopFrac(ground.capacity, ground.unique);
  const top = Math.min(bottom - 24, Math.max(2, bottom * topFrac));
  const scale = stadiumScaleFromCapacity(ground.capacity);
  const roof = ground.unique === 'camp-nou' || ground.tiers >= 3 || ground.capacity >= 40_000;
  const t = clamp01((ground.capacity - 18_000) / (BERNABEU_CAPACITY - 18_000));
  return {
    top,
    bottom,
    aisleEvery: ground.tiers === 1 ? 22 : 0,
    occupancy: lerp(0.8, 0.995, ground.unique === 'camp-nou' ? 1 : t),
    roof,
    scale,
    tiers: ground.tiers,
    capacity: ground.capacity,
    unique: ground.unique,
    decks: deckBands(top, bottom, ground.tiers),
  };
}

/** Head/torso cell size in CSS pixels so close-up crowds read as people, not a wall. */
export function crowdCellSize(standHeightPx: number): { rowH: number; colW: number } {
  const rowH = Math.min(11, Math.max(3.2, standHeightPx / 42));
  const colW = Math.min(9, Math.max(2.8, rowH * 0.82));
  return { rowH, colW };
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
  layout: StadiumLayout,
) {
  const minX = Math.min(tl.x, tr.x, br.x, bl.x);
  const maxX = Math.max(tl.x, tr.x, br.x, bl.x);
  const minY = Math.min(tl.y, tr.y, br.y, bl.y);
  const maxY = Math.max(tl.y, tr.y, br.y, bl.y);
  const standH = Math.max(8, layout.bottom - layout.top);
  const { rowH: rawRow, colW: rawCol } = crowdCellSize(standH);
  const rowH = Math.max(3, Math.round(rawRow));
  const colW = Math.max(3, Math.round(rawCol));
  const paleHome = luminance(stadium.homeColor) > 0.72;
  const paleAway = luminance(stadium.awayColor) > 0.72;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  ctx.clip();

  let row = 0;
  for (let y = Math.floor(minY); y < maxY + rowH; y += rowH) {
    const aisle = layout.aisleEvery > 0 && row > 0 && row % layout.aisleEvery === layout.aisleEvery - 1;
    const stagger = (row & 1) ? Math.round(colW * 0.5) : 0;
    row += 1;
    if (aisle) {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(Math.floor(minX), y, Math.ceil(maxX - minX), Math.max(2, Math.round(rowH * 0.55)));
      continue;
    }
    for (let x = Math.floor(minX) - colW; x < maxX + colW; x += colW) {
      if (rng() > layout.occupancy) continue;
      const jitterX = Math.round((rng() - 0.5) * colW * 0.35);
      const jitterY = Math.round((rng() - 0.5) * rowH * 0.55);
      const px = x + stagger + jitterX;
      const py = y + jitterY;
      const u = Math.max(0, Math.min(1, (px + colW / 2) / Math.max(1, viewW)));
      const visiting = u > 1 - Math.min(0.42, Math.max(0.14, stadium.awayShare ?? 0.2));
      const paleSection = visiting ? paleAway : paleHome;

      const jacket = rng() < (paleSection ? 0.52 : 0.22);
      const civilian = !jacket && rng() < 0.18;
      ctx.fillStyle = jacket
        ? JACKET_TONES[(rng() * JACKET_TONES.length) | 0]
        : civilian
          ? CIVILIAN_TONES[(rng() * CIVILIAN_TONES.length) | 0]
          : shirtColor(
              rng,
              stadium.homeColor,
              stadium.homeSecondary,
              stadium.awayColor,
              stadium.awaySecondary,
              stadium.awayShare ?? 0.2,
              u,
            );
      // Shirt fills the cell first so dark hair never draws a full-width stripe.
      ctx.fillRect(px, py, colW - 1, rowH);

      const headH = Math.max(1, Math.round(rowH * 0.34));
      const headW = Math.max(1, Math.round(colW * 0.48));
      ctx.fillStyle = HAIR_TONES[(rng() * HAIR_TONES.length) | 0];
      ctx.fillRect(px + Math.round((colW - headW) / 2), py, headW, headH);

      const faceW = Math.max(1, Math.round(colW * 0.32));
      const faceH = Math.max(1, Math.round(rowH * 0.18));
      ctx.fillStyle = SKIN_TONES[(rng() * SKIN_TONES.length) | 0];
      ctx.fillRect(px + Math.round((colW - faceW) / 2), py + Math.max(1, Math.round(headH * 0.45)), faceW, faceH);
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
  const profile = profileFromAppearance(stadium);
  const key = [
    w | 0,
    h | 0,
    stadium.homeColor,
    stadium.homeSecondary ?? '',
    stadium.awayColor,
    stadium.awaySecondary ?? '',
    (stadium.awayShare ?? 0.2).toFixed(2),
    stadium.night ? 'n' : 'd',
    String(profile.capacity),
    String(profile.tiers),
    profile.unique ?? '',
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
  const layout = stadiumLayout(view, profile);
  const night = Boolean(stadium.night);
  const fasciaFill = night ? '#0b1220' : '#334155';

  ctx.fillStyle = fasciaFill;
  ctx.fillRect(0, layout.top, w, Math.max(1, layout.bottom - layout.top));

  const step = layout.decks.length > 1 ? Math.max(5, Math.round(w * 0.01)) : 0;
  const walkway = night ? '#1e293b' : '#64748b';
  const walkwayEdge = night ? '#475569' : '#94a3b8';

  for (let i = 0; i < layout.decks.length; i++) {
    const deck = layout.decks[i];
    const inset = (layout.decks.length - 1 - i) * step;
    const deckW = Math.max(1, w - inset * 2);
    // Alternate kit-wash vs charcoal so 3 / 4 / 5 rings count as colour blocks.
    const deckTint = i % 2 === 0
      ? mixHex(stadium.homeColor, night ? '#1e293b' : '#334155', 0.52)
      : mixHex(stadium.homeColor, night ? '#020617' : '#0f172a', 0.82);
    ctx.fillStyle = deckTint;
    ctx.fillRect(inset, deck.top, deckW, Math.max(1, deck.bottom - deck.top));
    paintPackedFans(
      ctx,
      { x: inset, y: deck.top },
      { x: inset + deckW, y: deck.top },
      { x: inset + deckW, y: deck.bottom },
      { x: inset, y: deck.bottom },
      rng,
      stadium,
      w,
      layout,
    );
    if (i < layout.decks.length - 1) {
      const next = layout.decks[i + 1];
      const nextInset = (layout.decks.length - 1 - (i + 1)) * step;
      const gapTop = deck.bottom;
      const gapH = Math.max(1, next.top - deck.bottom);
      const gapX = nextInset;
      const gapW = Math.max(1, w - nextInset * 2);
      ctx.fillStyle = walkway;
      ctx.fillRect(gapX, gapTop, gapW, gapH);
      const lip = Math.max(1, Math.min(2, Math.round(gapH * 0.22)));
      ctx.fillStyle = walkwayEdge;
      ctx.fillRect(gapX, next.top - lip, gapW, lip);
    }
  }

  crowdCache = { key, canvas };
  return canvas;
}

function drawRoof(ctx: CanvasRenderingContext2D, w: number, h: number, night: boolean, standTop: number, campNou: boolean) {
  // Keep the canopy as a thin lid above the terrace so a 6-yard camera
  // does not paint a dark void over the crowd behind the net.
  const lip = Math.min(h * (campNou ? 0.052 : 0.038), standTop * (campNou ? 1.05 : 0.85));
  if (night) {
    ctx.fillStyle = '#0b0f18';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, lip);
    ctx.quadraticCurveTo(w * 0.5, Math.min(h * (campNou ? 0.07 : 0.055), standTop), 0, lip);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  } else {
    ctx.strokeStyle = 'rgba(71,85,105,0.4)';
  }
  ctx.lineWidth = Math.max(2, w * (campNou ? 0.008 : 0.006));
  ctx.beginPath();
  ctx.moveTo(w * 0.04, Math.max(h * 0.02, lip * 0.7));
  ctx.quadraticCurveTo(w * 0.5, Math.min(h * (campNou ? 0.062 : 0.05), standTop * 0.9), w * 0.96, Math.max(h * 0.02, lip * 0.7));
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

function drawBowlStructure(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  standTop: number,
  standBottom: number,
  night: boolean,
) {
  const concrete = ctx.createLinearGradient(0, standTop, 0, standBottom);
  if (night) {
    concrete.addColorStop(0, '#1f2937');
    concrete.addColorStop(1, '#111827');
  } else {
    concrete.addColorStop(0, '#9aa7b8');
    concrete.addColorStop(1, '#6b7789');
  }
  ctx.fillStyle = concrete;
  ctx.beginPath();
  ctx.moveTo(0, standTop);
  ctx.lineTo(w, standTop);
  ctx.lineTo(w, standBottom);
  ctx.lineTo(0, standBottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = night ? '#0f172a' : '#7b8796';
  ctx.beginPath();
  ctx.moveTo(0, standTop + (standBottom - standTop) * 0.55);
  ctx.lineTo(w * 0.2, standBottom);
  ctx.lineTo(0, Math.min(h * 0.48, standBottom + h * 0.12));
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, standTop + (standBottom - standTop) * 0.55);
  ctx.lineTo(w * 0.8, standBottom);
  ctx.lineTo(w, Math.min(h * 0.48, standBottom + h * 0.12));
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
  const layout = stadiumLayout(view, profileFromAppearance(stadium));
  const night = Boolean(stadium.night);

  const sky = ctx.createLinearGradient(0, 0, 0, layout.bottom + h * 0.1);
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
  ctx.fillRect(0, 0, w, layout.bottom + h * 0.04);
  ctx.fillStyle = night ? '#0b1220' : '#8a97a8';
  ctx.fillRect(0, layout.bottom, w, Math.max(0, h - layout.bottom));

  drawBowlStructure(ctx, w, h, layout.top, layout.bottom, night);

  if (layout.roof) {
    drawRoof(ctx, w, h, night, layout.top, layout.unique === 'camp-nou');
  }

  const crowd = crowdLayer(w, h, view, stadium);
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(crowd, 0, 0, w, h);
  ctx.imageSmoothingEnabled = prevSmooth;

  if (night) {
    const lampY = layout.roof
      ? Math.max(h * 0.055, Math.min(layout.top + 8, view.goal.topY - h * 0.06))
      : layout.top + 6;
    const lampScale = Math.max(8, view.goal.halfW * 0.12);
    drawFloodlight(ctx, w / 2 - view.goal.halfW * 1.42, lampY, time, lampScale);
    drawFloodlight(ctx, w / 2 + view.goal.halfW * 1.42, lampY, time, lampScale);

    const wash = ctx.createRadialGradient(w / 2, view.goal.botY, 0, w / 2, view.goal.botY, w * 0.55);
    wash.addColorStop(0, 'rgba(255,244,210,0.07)');
    wash.addColorStop(1, 'rgba(255,244,210,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, layout.bottom + h * 0.08);
  } else {
    const sun = ctx.createRadialGradient(w * 0.78, h * 0.05, 0, w * 0.78, h * 0.05, w * 0.42);
    sun.addColorStop(0, 'rgba(255,252,220,0.55)');
    sun.addColorStop(0.18, 'rgba(255,236,170,0.22)');
    sun.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, layout.bottom + h * 0.1);
  }

  drawHoardings(ctx, view, stadium);
}
