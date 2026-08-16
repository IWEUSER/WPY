import { useCallback, useEffect, useRef, useState } from 'react';
import * as audio from './audio';
import { isValidSwipe, resolveShot } from './shotEngine';
import { ballStartPixel, drawBall, drawGoal, drawKeeper, drawPitch, drawTrail, goalToPixel, type KeeperPose } from './render';
import type { AimPoint, ShotOutcomeKind, ShotResult, SwipeGesture } from './types';
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
  keeperPose: KeeperPose;
  resultAtMs: number;
}

const RESULT_HOLD_MS = 1500;
const BASE_BALL_RADIUS_RATIO = 0.028;
const FAR_BALL_RADIUS_RATIO = 0.011;

const OUTCOME_LABEL: Record<ShotOutcomeKind, string> = {
  goal: 'GOAL!',
  saved: 'SAVED',
  post: 'OFF THE WOODWORK',
  wide: 'WIDE',
  over: 'OVER THE BAR',
};

const OUTCOME_COLOR: Record<ShotOutcomeKind, string> = {
  goal: '#4ade80',
  saved: '#f87171',
  post: '#fbbf24',
  wide: '#f87171',
  over: '#f87171',
};

function makeIdleKeeper(): KeeperPose {
  return { pos: { x: 0, y: 0 }, stretch: 0, direction: 0, beaten: false };
}

export default function ShootingGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const [uiPhase, setUiPhase] = useState<Phase>('idle');
  const [resultLabel, setResultLabel] = useState<{ text: string; color: string } | null>(null);
  const [stats, setStats] = useState<ShotStats>({ shots: 0, goals: 0, streak: 0, bestStreak: 0 });
  const [muted, setMuted] = useState(false);

  const animRef = useRef<AnimState>({
    phase: 'idle',
    dragStart: null,
    dragPoints: [],
    shotStartMs: 0,
    result: null,
    ballPixel: { x: 0, y: 0 },
    ballRadius: 0,
    ballRotation: 0,
    keeperPose: makeIdleKeeper(),
    resultAtMs: 0,
  });

  useEffect(() => {
    audio.setMuted(muted);
  }, [muted]);

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
    const start = ballStartPixel(w, h);
    const anim = animRef.current;
    anim.phase = 'idle';
    anim.dragStart = null;
    anim.dragPoints = [];
    anim.result = null;
    anim.ballPixel = start;
    anim.ballRadius = w * BASE_BALL_RADIUS_RATIO;
    anim.ballRotation = 0;
    anim.keeperPose = makeIdleKeeper();
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
    setUiPhase('shooting');
    setResultLabel(null);
    audio.playKick(result.power);
  }, []);

  const finishShot = useCallback((result: ShotResult) => {
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
    setResultLabel({ text: OUTCOME_LABEL[result.outcome], color: OUTCOME_COLOR[result.outcome] });
    setUiPhase('result');
    if (result.outcome === 'goal') audio.playGoal();
    else if (result.outcome === 'saved') audio.playSave();
    else if (result.outcome === 'post') audio.playPost();
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
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        drawPitch(ctx, w, h, now);
        drawGoal(ctx, w, h);

        const anim = animRef.current;

        if (anim.phase === 'idle' || anim.phase === 'dragging') {
          const start = ballStartPixel(w, h);
          anim.ballPixel = start;
          anim.ballRadius = w * BASE_BALL_RADIUS_RATIO;
          drawKeeper(ctx, w, h, anim.keeperPose);
          if (anim.phase === 'dragging' && anim.dragStart) {
            const last = anim.dragPoints[anim.dragPoints.length - 1] ?? anim.dragStart;
            drawTrail(ctx, [
              { x: anim.dragStart.x, y: anim.dragStart.y },
              { x: last.x, y: last.y },
            ]);
          }
          drawBall(ctx, anim.ballPixel.x, anim.ballPixel.y, anim.ballRadius, anim.ballRotation);
        } else if (anim.phase === 'shooting' && anim.result) {
          const result = anim.result;
          const elapsed = now - anim.shotStartMs;
          const t = Math.min(1, elapsed / result.travelTimeMs);
          const eased = t * t * (3 - 2 * t); // smoothstep

          const start = ballStartPixel(w, h);
          const endAim: AimPoint = result.outcome === 'saved' ? result.keeperDive.target : result.aim;
          const end = goalToPixel(endAim, w, h);

          const swerve = (result.aim.x - result.intendedAim.x) * w * 0.18;
          const midX = (start.x + end.x) / 2 + swerve;
          const midY = Math.min(start.y, end.y) - h * 0.05;

          const x = bezier(start.x, midX, end.x, eased);
          const y = bezier(start.y, midY, end.y, eased);

          anim.ballPixel = { x, y };
          anim.ballRadius = lerpNum(w * BASE_BALL_RADIUS_RATIO, w * FAR_BALL_RADIUS_RATIO, eased);
          anim.ballRotation = eased * 18 * (result.power + 0.4);

          const diveStart = result.keeperDive.reactionMs;
          const diveElapsed = Math.max(0, elapsed - diveStart);
          const diveTotal = Math.max(1, result.keeperDive.diveDurationMs - diveStart);
          const diveT = Math.min(1, diveElapsed / diveTotal);
          const diveEased = diveT * diveT * (3 - 2 * diveT);

          anim.keeperPose = {
            pos: { x: result.keeperDive.target.x * diveEased, y: 0 },
            stretch: diveEased,
            direction: result.keeperDive.target.x >= 0 ? 1 : -1,
            beaten: false,
          };

          drawKeeper(ctx, w, h, anim.keeperPose);
          drawBall(ctx, anim.ballPixel.x, anim.ballPixel.y, anim.ballRadius, anim.ballRotation);

          if (t >= 1) {
            anim.phase = 'result';
            anim.resultAtMs = now;
            anim.keeperPose = {
              ...anim.keeperPose,
              beaten: result.outcome === 'goal',
            };
            finishShot(result);
          }
        } else if (anim.phase === 'result' && anim.result) {
          drawKeeper(ctx, w, h, anim.keeperPose);
          drawBall(ctx, anim.ballPixel.x, anim.ballPixel.y, anim.ballRadius, anim.ballRotation);
          if (now - anim.resultAtMs > RESULT_HOLD_MS) {
            resetForNextShot();
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
      if (anim.dragPoints.length > 12) anim.dragPoints.shift();
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
      const gesture: SwipeGesture = { dx, dy, durationMs };

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
          <h1 className="text-lg font-bold tracking-wide sm:text-xl">World Player of the Year</h1>
          <p className="text-xs text-white/50">Swipe the ball to shoot</p>
        </div>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur transition hover:bg-white/20"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      <StatsBar stats={stats} />

      <div ref={containerRef} className="relative min-h-0 flex-1 select-none touch-none">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

        {uiPhase === 'idle' && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[14%] flex justify-center">
            <div className="animate-pulse rounded-full bg-black/40 px-4 py-1.5 text-sm text-white/80 backdrop-blur">
              Swipe up on the ball to shoot ⬆
            </div>
          </div>
        )}

        {resultLabel && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="animate-[pop_0.35s_ease-out] rounded-2xl border-2 bg-black/60 px-8 py-4 text-3xl font-extrabold tracking-wider backdrop-blur-sm sm:text-5xl"
              style={{ color: resultLabel.color, borderColor: resultLabel.color }}
            >
              {resultLabel.text}
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

function bezier(a: number, b: number, c: number, t: number): number {
  const it = 1 - t;
  return it * it * a + 2 * it * t * b + t * t * c;
}
