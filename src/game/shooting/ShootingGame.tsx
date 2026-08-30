import { useCallback, useEffect, useRef, useState } from 'react';
import * as audio from './audio';
import { MAX_ARC_ALONG_PATH, MAX_BEND_RATIO, MIN_ARC_ALONG_PATH, DEFAULT_DIFFICULTY } from './constants';
import { cellCenter, computeKeeperDive, computeSwipeCurl, isValidSwipe, resolveShot } from './shotEngine';
import {
  BALL_SCREEN_Y,
  ballRadiusAtGoal,
  ballRadiusNear,
  ballStartPixel,
  createPitchView,
  drawBall,
  drawDefender,
  drawGoal,
  drawKeeper,
  drawPitch,
  drawTrail,
  goalToPixel,
  idleKeeperPose,
  worldToScreen,
  type KeeperPose,
} from './render';
import { drawStadium, DEFAULT_STADIUM, defenderKitFromStadium, type StadiumAppearance } from './stadium';
import { normalizeHex } from './kitPalette';
import {
  ballHasReachedDefender,
  defenderBlocksBall,
  defenderScreenBody,
  shotLineHitsDefender,
  rollChanceSetup,
  type ChanceKind,
  type ChanceSetup,
  type DefenderPose,
} from './chanceSetup';
import type { ShotOutcomeKind, ShotResult, SwipeGesture } from './types';
import StatsBar, { type ShotStats } from './StatsBar';

type Phase = 'idle' | 'dragging' | 'shooting' | 'result';

interface Point {
  x: number;
  y: number;
  t: number;
}

interface AnimState {
  phase: Phase;
  dragStart: Point | null;
  dragPoints: Point[];
  shotStartMs: number;
  result: ShotResult | null;
  ballPixel: { x: number; y: number };
  ballRadius: number;
  ballRotation: number;
  ballTrail: { x: number; y: number }[];
  keeperPose: KeeperPose;
  resultAtMs: number;
  shakeMagnitude: number;
  shakeUntilMs: number;
  /** Horizontal spawn of the idle ball, as a fraction of canvas width. */
  ballStartXRatio: number;
  /** Metres from the ball to the goal line. */
  shotDistanceM: number;
  chanceKind: ChanceKind;
  defender: DefenderPose | null;
}

const RESULT_HOLD_MS = 1500;
const SHAKE_DURATION_MS = 280;
const MAX_DRAG_POINTS = 400;

const OUTCOME_LABEL: Record<ShotOutcomeKind, string> = {
  goal: 'GOAL!',
  saved: 'SAVED',
  post: 'OFF THE WOODWORK',
  wide: 'WIDE',
  over: 'OVER THE BAR',
  blocked: 'BLOCKED',
};

const OUTCOME_COLOR: Record<ShotOutcomeKind, string> = {
  goal: '#4ade80',
  saved: '#f87171',
  post: '#fbbf24',
  wide: '#f87171',
  over: '#f87171',
  blocked: '#fb923c',
};

/** Describes how hard the shot was struck, for on-screen feedback. */
function powerTierLabel(power: number): string {
  if (power >= 1.55) return 'Thunderbolt';
  if (power >= 1.15) return 'Firm strike';
  if (power >= 0.75) return 'Well struck';
  return 'Soft touch';
}

/** Describes the curl in football terms (inswinger/outswinger, which side of
 * the boot), based on which way the shot bent relative to which side of goal
 * it was aimed at. Returns null for a near-straight strike. */
function curlStyleLabel(result: ShotResult): string | null {
  if (Math.abs(result.curl) < 0.15) return null;
  const aimSign = Math.sign(result.aim.x);
  const curlSign = Math.sign(result.curl);
  const bendsTowardCenter = aimSign !== 0 && curlSign !== 0 && aimSign !== curlSign;
  const dir = curlSign > 0 ? 'right' : 'left';
  const boot = bendsTowardCenter ? 'inswinger, inside of the boot' : 'outswinger, outside of the boot';
  return `Curled ${dir} \u2014 ${boot}`;
}

function readDevDistance(): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = new URLSearchParams(window.location.search).get('distance');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function readDevPower(): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = new URLSearchParams(window.location.search).get('power');
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

function readDevPenalty(): boolean {
  if (!import.meta.env.DEV) return false;
  const raw = new URLSearchParams(window.location.search).get('penalty');
  return raw === '1' || raw === 'true';
}

function readDevDefenderOff(): boolean {
  if (!import.meta.env.DEV) return false;
  const raw = new URLSearchParams(window.location.search).get('defender');
  return raw === 'off' || raw === '0';
}

function readDevAutoblock(): boolean {
  if (!import.meta.env.DEV) return false;
  const raw = new URLSearchParams(window.location.search).get('autoblock');
  return raw === '1' || raw === 'true';
}

function readDevStadium(): StadiumAppearance | null {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(window.location.search);
  const homeParam = q.get('home');
  const homeColorRaw = q.get('homeColor');
  const awayColorRaw = q.get('awayColor');
  if (homeParam == null && !homeColorRaw && !awayColorRaw) return null;
  const isHome = homeParam !== '0' && homeParam !== 'away' && homeParam !== 'false';
  const playerColor = normalizeHex(homeColorRaw, DEFAULT_STADIUM.homeColor);
  const opponentColor = normalizeHex(awayColorRaw, DEFAULT_STADIUM.awayColor);
  return {
    isHome,
    homeColor: isHome ? playerColor : opponentColor,
    awayColor: isHome ? opponentColor : playerColor,
    opponentColor,
    awayShare: 0.2,
  };
}

function nextChance(clubStrength?: number): ChanceSetup {
  const forcePenalty = readDevPenalty();
  const forceDistance = readDevDistance();
  return rollChanceSetup({
    clubStrength,
    forcePenalty,
    forceDistanceM: forcePenalty ? undefined : (forceDistance ?? undefined),
    disableDefender: readDevDefenderOff(),
  });
}

/** DEV-only: ?pose=col,row,save|miss freezes the keeper in that square's motion.
 * Optional &distance=&power= apply thunderbolt range so a close rocket miss
 * shows the flinch rather than a full dive. */
function readDevKeeperPose(): KeeperPose | null {
  if (!import.meta.env.DEV) return null;
  const raw = new URLSearchParams(window.location.search).get('pose');
  if (!raw) return null;
  const [c, r, kind] = raw.split(',');
  const col = Number(c);
  const row = Number(r);
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col > 15 || row < 0 || row > 4) return null;
  const saved = kind !== 'miss';
  const cell = { col, row };
  const square = cellCenter(cell);
  const distanceM = readDevDistance() ?? 18;
  const power = readDevPower() ?? 1;
  const dive = computeKeeperDive(square, cell, saved, DEFAULT_DIFFICULTY, undefined, { power, distanceM });
  return {
    pos: dive.target,
    stretch: dive.stretch,
    direction: dive.direction,
    layout: dive.layout,
    elevation: dive.elevation,
    hand: dive.hand,
    beaten: !saved,
  };
}

function readDevPoseCell(): { col: number; row: number } | null {
  if (!import.meta.env.DEV) return null;
  const raw = new URLSearchParams(window.location.search).get('pose');
  if (!raw) return null;
  const [c, r] = raw.split(',');
  const col = Number(c);
  const row = Number(r);
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col > 15 || row < 0 || row > 4) return null;
  return { col, row };
}

function makeIdleKeeper(): KeeperPose {
  return idleKeeperPose();
}

export interface ShootingGameProps {
  /** Header title override (defaults to the game's name). */
  title?: string;
  /** Header subtitle override (defaults to the swipe hint). */
  subtitle?: string;
  /** Small badge shown under the header, e.g. "Shot 3/10" or "Matchday 12". */
  progressLabel?: string;
  /** Hides the built-in shots/goals/streak stats bar (career screens track their own). */
  hideStatsBar?: boolean;
  /** Hides the back navigation is left to the parent; this only controls the mute button visibility. */
  hideMuteButton?: boolean;
  /** Limits how many shots this session allows before calling onComplete instead of resetting. */
  maxShots?: number;
  /** Fired the instant a shot's outcome is resolved (before the flight animation finishes). */
  onShotResolved?: (result: ShotResult) => void;
  /** Fired once the final shot (per maxShots) has finished its result animation. */
  onComplete?: () => void;
  /** Club strength (≈52–94). Scales how often a chance is a penalty. */
  clubStrength?: number;
  /** Stadium bowl, home/away crowd colours, and opposition defender kit. */
  stadium?: StadiumAppearance;
}

export default function ShootingGame({
  title,
  subtitle,
  progressLabel,
  hideStatsBar = false,
  hideMuteButton = false,
  maxShots,
  onShotResolved,
  onComplete,
  clubStrength,
  stadium,
}: ShootingGameProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const [uiPhase, setUiPhase] = useState<Phase>('idle');
  const [resultLabel, setResultLabel] = useState<{ text: string; color: string; detail: string | null } | null>(null);
  const [stats, setStats] = useState<ShotStats>({ shots: 0, goals: 0, streak: 0, bestStreak: 0 });
  const [muted, setMuted] = useState(false);

  const [initialChance] = useState(() => nextChance(clubStrength));
  const [ballHintX, setBallHintX] = useState(initialChance.ballStartXRatio);
  const [chanceKind, setChanceKind] = useState<ChanceKind>(initialChance.kind);

  const shotsTakenRef = useRef(0);
  const maxShotsRef = useRef(maxShots);
  maxShotsRef.current = maxShots;
  const onShotResolvedRef = useRef(onShotResolved);
  onShotResolvedRef.current = onShotResolved;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const clubStrengthRef = useRef(clubStrength);
  clubStrengthRef.current = clubStrength;
  const stadiumRef = useRef<StadiumAppearance>(stadium ?? readDevStadium() ?? DEFAULT_STADIUM);
  stadiumRef.current = stadium ?? readDevStadium() ?? DEFAULT_STADIUM;

  const animRef = useRef<AnimState>({
    phase: 'idle',
    dragStart: null,
    dragPoints: [],
    shotStartMs: 0,
    result: null,
    ballPixel: { x: 0, y: 0 },
    ballRadius: 0,
    ballRotation: 0,
    ballTrail: [],
    keeperPose: makeIdleKeeper(),
    resultAtMs: 0,
    shakeMagnitude: 0,
    shakeUntilMs: 0,
    ballStartXRatio: initialChance.ballStartXRatio,
    shotDistanceM: initialChance.distanceM,
    chanceKind: initialChance.kind,
    defender: initialChance.defender,
  });

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    setBallHintX(animRef.current.ballStartXRatio);
    setChanceKind(animRef.current.chanceKind);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __shootingAnim: () => AnimState }).__shootingAnim = () => animRef.current;
  }, []);

  // Keep canvas sized to its container (handles rotation/resizing responsively).
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const resetForNextShot = useCallback(() => {
    const { w, h } = sizeRef.current;
    const chance = nextChance(clubStrengthRef.current);
    const view = createPitchView(w, h, chance.distanceM);
    const start = ballStartPixel(view, chance.ballStartXRatio);
    const anim = animRef.current;
    anim.phase = 'idle';
    anim.dragStart = null;
    anim.dragPoints = [];
    anim.result = null;
    anim.ballStartXRatio = chance.ballStartXRatio;
    anim.shotDistanceM = chance.distanceM;
    anim.chanceKind = chance.kind;
    anim.defender = chance.defender;
    anim.ballPixel = start;
    anim.ballRadius = ballRadiusNear(view);
    anim.ballRotation = 0;
    anim.ballTrail = [];
    anim.keeperPose = makeIdleKeeper();
    anim.shakeMagnitude = 0;
    anim.shakeUntilMs = 0;
    setBallHintX(chance.ballStartXRatio);
    setChanceKind(chance.kind);
    setUiPhase('idle');
    setResultLabel(null);
  }, []);

  const launchShot = useCallback((gesture: SwipeGesture) => {
    const anim = animRef.current;
    const result = resolveShot(gesture);
    anim.result = result;
    anim.phase = 'shooting';
    anim.shotStartMs = performance.now();
    anim.ballRotation = 0;
    anim.ballTrail = [];
    setUiPhase('shooting');
    setResultLabel(null);
    audio.playKick(result.power);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const shootThrough = () => {
      const anim = animRef.current;
      if (anim.phase !== 'idle' || !anim.defender) return false;
      const { w, h } = sizeRef.current;
      if (w < 10 || h < 10) return false;
      const view = createPitchView(w, h, anim.shotDistanceM);
      const start = ballStartPixel(view, anim.ballStartXRatio);
      const feet = worldToScreen(view, anim.defender.worldX, anim.defender.z);
      const endX = start.x + (feet.x - start.x) * 1.45;
      const endY = start.y + (feet.y - start.y) * 1.45;
      launchShot({
        dx: endX - start.x,
        dy: start.y - endY,
        durationMs: 200,
        curl: 0,
        ballX: start.x,
        ballY: start.y,
        endX,
        endY,
        canvasW: w,
        canvasH: h,
        distanceM: anim.shotDistanceM,
      });
      return true;
    };
    (window as unknown as { __shootThroughDefender: () => boolean }).__shootThroughDefender = shootThrough;
    if (!readDevAutoblock()) return;
    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      if (shootThrough() || attempts >= 8) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [launchShot]);

  const finishShot = useCallback((result: ShotResult) => {
    shotsTakenRef.current += 1;
    onShotResolvedRef.current?.(result);
    setStats((prev) => {
      const goals = prev.goals + (result.outcome === 'goal' ? 1 : 0);
      const streak = result.outcome === 'goal' ? prev.streak + 1 : 0;
      return {
        shots: prev.shots + 1,
        goals,
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
      };
    });
    const detailParts = [powerTierLabel(result.power), curlStyleLabel(result)].filter(Boolean) as string[];
    setResultLabel({
      text: OUTCOME_LABEL[result.outcome],
      color: OUTCOME_COLOR[result.outcome],
      detail: detailParts.length > 0 ? detailParts.join(' \u00b7 ') : null,
    });
    setUiPhase('result');
    if (result.outcome === 'goal') {
      audio.playGoal();
      if (result.power > 1.15) {
        const anim = animRef.current;
        anim.shakeMagnitude = Math.min(14, (result.power - 1) * 14);
        anim.shakeUntilMs = performance.now() + SHAKE_DURATION_MS;
      }
    } else if (result.outcome === 'saved') audio.playSave();
    else if (result.outcome === 'post') audio.playPost();
    else if (result.outcome === 'blocked') audio.playBlock();
    else audio.playMiss();
  }, []);

  // Main animation loop.
  useEffect(() => {
    let raf = 0;

    const tick = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const { w, h, dpr } = sizeRef.current;
      if (canvas && ctx && w > 0 && h > 0) {
        const anim = animRef.current;

        let shakeX = 0;
        let shakeY = 0;
        if (anim.shakeUntilMs > now) {
          const remaining = (anim.shakeUntilMs - now) / SHAKE_DURATION_MS;
          const mag = anim.shakeMagnitude * remaining;
          shakeX = (Math.random() * 2 - 1) * mag;
          shakeY = (Math.random() * 2 - 1) * mag;
        }
        ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);
        ctx.clearRect(-shakeX - 4, -shakeY - 4, w + 8, h + 8);
        const view = createPitchView(w, h, anim.shotDistanceM);
        const look = stadiumRef.current;
        const defenderKit = defenderKitFromStadium(look);
        drawStadium(ctx, view, now, look);
        drawPitch(ctx, view, now);
        drawGoal(ctx, view);

        if (anim.phase === 'idle' || anim.phase === 'dragging') {
          const start = ballStartPixel(view, anim.ballStartXRatio);
          anim.ballPixel = start;
          anim.ballRadius = ballRadiusNear(view);
          const devPose = readDevKeeperPose();
          const devCell = readDevPoseCell();
          drawKeeper(ctx, view, devPose ?? anim.keeperPose);
          if (anim.defender) drawDefender(ctx, view, anim.defender.worldX, anim.defender.z, defenderKit);
          if (anim.phase === 'dragging' && anim.dragStart && anim.dragPoints.length > 1) {
            // Show the actual curved path being swiped, not just a straight
            // line - this is the live feedback for how much bend/curl the
            // current swipe is imparting.
            drawTrail(ctx, anim.dragPoints);
          }
          if (devPose && devCell) {
            const atSquare = goalToPixel(cellCenter(devCell), view);
            drawBall(ctx, atSquare.x, atSquare.y, ballRadiusAtGoal(view), 0);
          } else {
            drawBall(ctx, anim.ballPixel.x, anim.ballPixel.y, anim.ballRadius, anim.ballRotation);
          }
        } else if (anim.phase === 'shooting' && anim.result) {
          const result = anim.result;
          const elapsed = now - anim.shotStartMs;
          const t = Math.min(1, elapsed / result.travelTimeMs);
          const eased = t * t * (3 - 2 * t); // smoothstep

          const start = ballStartPixel(view, anim.ballStartXRatio);
          // The ball always flies to where it truly ends up - never redirect
          // its visual path toward the keeper - so what you see is always
          // consistent with the outcome (no more "that went in" saves).
          const end = goalToPixel(result.aim, view);

          const powerT = clamp((result.power - 0.25) / (1.8 - 0.25), 0, 1);
          const pathLen = Math.hypot(end.x - start.x, end.y - start.y);
          const arcHeight = lerpNum(MAX_ARC_ALONG_PATH, MIN_ARC_ALONG_PATH, powerT) * pathLen;
          const bend = result.curl * w * MAX_BEND_RATIO;

          // Gentle banana: a little early bow, then settle into the aimed
          // point so the shot does not whip sideways at the end.
          const c1x = lerpNum(start.x, end.x, 0.38) + bend;
          const c1y = lerpNum(start.y, end.y, 0.38) - arcHeight;
          const c2x = lerpNum(start.x, end.x, 0.78) + bend * 0.2;
          const c2y = lerpNum(start.y, end.y, 0.78) - arcHeight * 0.22;

          const x = cubicBezier(start.x, c1x, c2x, end.x, eased);
          const y = cubicBezier(start.y, c1y, c2y, end.y, eased);

          anim.ballPixel = { x, y };
          anim.ballRadius = lerpNum(ballRadiusNear(view), ballRadiusAtGoal(view), eased);
          const spinDir = result.curl !== 0 ? Math.sign(result.curl) : 1;
          anim.ballRotation = eased * spinDir * (10 + 14 * powerT);

          anim.ballTrail.push({ x, y });
          const trailLen = Math.round(lerpNum(5, 18, powerT));
          while (anim.ballTrail.length > trailLen) anim.ballTrail.shift();

          const saved = result.outcome === 'saved';
          // Dive with the shot, whether they hold it or not, so a thunderbolt
          // still produces a throw — they just don't get there on a miss.
          const diveEased = t * t * (3 - 2 * t);

          // Pose is the square's save or miss motion, interpolated from idle.
          const dive = result.keeperDive;
          const idleY = 0.28;
          anim.keeperPose = {
            pos: {
              x: dive.target.x * diveEased,
              y: idleY + (dive.target.y - idleY) * diveEased,
            },
            stretch: dive.stretch * diveEased,
            direction: dive.direction,
            layout: dive.layout * diveEased,
            elevation: dive.elevation * diveEased,
            hand: {
              x: dive.hand.x * diveEased,
              y: idleY + (dive.hand.y - idleY) * diveEased,
            },
            beaten: false,
          };

          drawTrail(ctx, anim.ballTrail);
          drawKeeper(ctx, view, anim.keeperPose);
          if (anim.defender) drawDefender(ctx, view, anim.defender.worldX, anim.defender.z, defenderKit);
          drawBall(ctx, anim.ballPixel.x, anim.ballPixel.y, anim.ballRadius, anim.ballRotation);

          if (
            anim.defender
            && eased > 0.06
            && ballHasReachedDefender(view, anim.defender, anim.ballPixel, anim.ballRadius)
            && (
              shotLineHitsDefender(anim.shotDistanceM, anim.ballStartXRatio, result.aim, anim.defender)
              || defenderBlocksBall(view, anim.defender, anim.ballPixel, anim.ballRadius)
            )
          ) {
            const body = defenderScreenBody(view, anim.defender);
            anim.ballPixel = { x: body.torsoX, y: body.torsoY };
            const blocked: ShotResult = { ...result, outcome: 'blocked' };
            anim.result = blocked;
            anim.phase = 'result';
            anim.resultAtMs = now;
            finishShot(blocked);
          } else if (t >= 1) {
            anim.phase = 'result';
            anim.resultAtMs = now;
            anim.keeperPose = {
              pos: dive.target,
              stretch: dive.stretch,
              direction: dive.direction,
              layout: dive.layout,
              elevation: dive.elevation,
              hand: dive.hand,
              beaten: !saved,
            };
            finishShot(result);
          }
        } else if (anim.phase === 'result' && anim.result) {
          drawKeeper(ctx, view, anim.keeperPose);
          if (anim.defender) drawDefender(ctx, view, anim.defender.worldX, anim.defender.z, defenderKit);
          drawBall(ctx, anim.ballPixel.x, anim.ballPixel.y, anim.ballRadius, anim.ballRotation);
          if (now - anim.resultAtMs > RESULT_HOLD_MS) {
            const limit = maxShotsRef.current;
            if (limit !== undefined && shotsTakenRef.current >= limit) {
              onCompleteRef.current?.();
            } else {
              resetForNextShot();
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [finishShot, resetForNextShot]);

  // Pointer (mouse + touch) swipe handling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPoint = (e: PointerEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() };
    };

    const onPointerDown = (e: PointerEvent) => {
      const anim = animRef.current;
      if (anim.phase !== 'idle') return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const p = getPoint(e);
      anim.dragStart = p;
      anim.dragPoints = [p];
      anim.phase = 'dragging';
      setUiPhase('dragging');
    };

    const onPointerMove = (e: PointerEvent) => {
      const anim = animRef.current;
      if (anim.phase !== 'dragging' || !anim.dragStart) return;
      e.preventDefault();
      const p = getPoint(e);
      anim.dragPoints.push(p);
      // Keep the whole gesture (not just the last few points) so the curl -
      // how much the swipe bows away from a straight line - can be measured
      // over the full swing, not just its tail end.
      if (anim.dragPoints.length > MAX_DRAG_POINTS) anim.dragPoints.shift();
    };

    const onPointerUp = (e: PointerEvent) => {
      const anim = animRef.current;
      if (anim.phase !== 'dragging' || !anim.dragStart) return;
      e.preventDefault();
      const end = getPoint(e);
      const start = anim.dragStart;

      const dx = end.x - start.x;
      const dy = start.y - end.y; // screen-up is positive
      const durationMs = Math.max(16, end.t - start.t);
      const curl = computeSwipeCurl(anim.dragPoints);
      const { w, h } = sizeRef.current;
      const view = createPitchView(w, h, anim.shotDistanceM);
      const ball = ballStartPixel(view, anim.ballStartXRatio);
      const gesture: SwipeGesture = {
        dx,
        dy,
        durationMs,
        curl,
        ballX: ball.x,
        ballY: ball.y,
        endX: end.x,
        endY: end.y,
        canvasW: w,
        canvasH: h,
        distanceM: anim.shotDistanceM,
      };

      anim.dragStart = null;
      anim.dragPoints = [];

      if (isValidSwipe(gesture)) {
        launchShot(gesture);
      } else {
        anim.phase = 'idle';
        setUiPhase('idle');
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [launchShot]);

  return (
    <div className="relative flex h-full w-full flex-col">
      <header className="z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-white">
        <div>
          <h1 className="text-lg font-bold tracking-wide sm:text-xl">{title ?? 'World Player of the Year'}</h1>
          <p className="text-xs text-white/50">{subtitle ?? 'Swipe the ball to shoot'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {progressLabel && (
              <p className="inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white/80">
                {progressLabel}
              </p>
            )}
            {chanceKind === 'penalty' && (
              <p className="inline-block rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-amber-200">
                Penalty · no defender
              </p>
            )}
          </div>
        </div>
        {!hideMuteButton && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        )}
      </header>

      {!hideStatsBar && <StatsBar stats={stats} />}

      <div ref={containerRef} className="relative min-h-0 flex-1 select-none touch-none">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

        {uiPhase === 'idle' && (
          <div
            className="pointer-events-none absolute whitespace-nowrap"
            style={{
              left: `${Math.min(0.82, Math.max(0.18, ballHintX)) * 100}%`,
              top: `${(BALL_SCREEN_Y + 0.04) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="animate-pulse rounded-full bg-black/40 px-4 py-1.5 text-sm text-white/80 backdrop-blur">
              Swipe up on the ball to shoot ⬆
            </div>
          </div>
        )}

        {resultLabel && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="animate-[pop_0.35s_ease-out] flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-black/60 px-8 py-4 text-3xl font-extrabold tracking-wider backdrop-blur-sm sm:text-5xl"
              style={{ color: resultLabel.color, borderColor: resultLabel.color }}
            >
              {resultLabel.text}
              {resultLabel.detail && (
                <span className="text-xs font-medium tracking-wide text-white/80 sm:text-sm">{resultLabel.detail}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pop {
          0% { transform: scale(0.7); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cubicBezier(a: number, b: number, c: number, d: number, t: number): number {
  const it = 1 - t;
  return it * it * it * a + 3 * it * it * t * b + 3 * it * t * t * c + t * t * t * d;
}
