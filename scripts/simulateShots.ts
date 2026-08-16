/**
 * Dev-only balance tool: simulates many shots against the shot engine to sanity
 * check that outcomes are appropriately random (i.e. not ~100% or ~0% goals).
 * Run with: npm run simulate
 */
import {
  AIM_X_OVERSHOOT,
  AIM_Y_OVERSHOOT,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  MAX_SWIPE_DISTANCE,
  REFERENCE_SPEED,
} from '../src/game/shooting/constants';
import { resolveShot } from '../src/game/shooting/shotEngine';
import type { SwipeGesture } from '../src/game/shooting/types';

/** Back-solves a swipe gesture that produces a given intended aim + power,
 * so test cases can be expressed in terms that matter for balance instead
 * of raw pixels. */
function gestureFor(aimX: number, aimY: number, power: number): SwipeGesture {
  const dx = (aimX / (GOAL_HALF_WIDTH * AIM_X_OVERSHOOT)) * MAX_SWIPE_DISTANCE;
  const dy = (aimY / (GOAL_HEIGHT * AIM_Y_OVERSHOOT)) * MAX_SWIPE_DISTANCE;
  const distance = Math.hypot(dx, dy);
  const speed = power * REFERENCE_SPEED;
  const durationMs = distance / speed;
  return { dx, dy, durationMs };
}

function tally(label: string, gestures: SwipeGesture[]) {
  const counts: Record<string, number> = { goal: 0, saved: 0, post: 0, wide: 0, over: 0 };
  for (const g of gestures) {
    const result = resolveShot(g);
    counts[result.outcome]++;
  }
  const total = gestures.length;
  const pct = (n: number) => ((n / total) * 100).toFixed(1) + '%';
  console.log(
    `${label.padEnd(34)} goal=${pct(counts.goal)} saved=${pct(counts.saved)} post=${pct(counts.post)} wide=${pct(counts.wide)} over=${pct(counts.over)}`,
  );
}

const N = 20000;
function repeat(fn: () => SwipeGesture, n: number): SwipeGesture[] {
  return Array.from({ length: n }, fn);
}

tally('Top-left corner, ideal power', repeat(() => gestureFor(-0.82, 0.85, 1.0), N));
tally('Top-right corner, ideal power', repeat(() => gestureFor(0.82, 0.85, 1.0), N));
tally('Bottom corner, ideal power', repeat(() => gestureFor(-0.8, 0.15, 1.0), N));
tally('Center, low, ideal power', repeat(() => gestureFor(0, 0.15, 1.0), N));
tally('Center, high, ideal power', repeat(() => gestureFor(0, 0.85, 1.0), N));
tally('Top corner, overpowered (1.6x)', repeat(() => gestureFor(0.82, 0.85, 1.6), N));
tally('Top corner, underpowered (0.4x)', repeat(() => gestureFor(0.82, 0.85, 0.4), N));
tally('Just inside the post, ideal power', repeat(() => gestureFor(0.95, 0.5, 1.0), N));
tally('Weak tentative shot, center', repeat(() => gestureFor(0.05, 0.2, 0.35), N));
tally('Panic-mashed max swipe', repeat(() => gestureFor(1.0, 1.0, 1.8), N));

tally(
  'Broad random swipes',
  repeat(() => {
    const dx = (Math.random() - 0.5) * 2 * 240;
    const dy = 40 + Math.random() * 240;
    const durationMs = 100 + Math.random() * 250;
    return { dx, dy, durationMs };
  }, N),
);
