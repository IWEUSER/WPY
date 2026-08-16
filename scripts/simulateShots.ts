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
import { computeSwipeCurl, resolveShot } from '../src/game/shooting/shotEngine';
import type { SwipeGesture } from '../src/game/shooting/types';

/** Back-solves a swipe gesture that produces a given intended aim + power
 * (and optionally curl), so test cases can be expressed in terms that matter
 * for balance instead of raw pixels. */
function gestureFor(aimX: number, aimY: number, power: number, curl = 0): SwipeGesture {
  const dx = (aimX / (GOAL_HALF_WIDTH * AIM_X_OVERSHOOT)) * MAX_SWIPE_DISTANCE;
  const dy = (aimY / (GOAL_HEIGHT * AIM_Y_OVERSHOOT)) * MAX_SWIPE_DISTANCE;
  const distance = Math.hypot(dx, dy);
  const speed = power * REFERENCE_SPEED;
  const durationMs = distance / speed;
  return { dx, dy, durationMs, curl };
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

console.log('\n--- Curl: harder for the keeper to read a swerving shot ---');
tally('Top-right corner, ideal power, no curl', repeat(() => gestureFor(0.82, 0.85, 1.0, 0), N));
tally('Top-right corner, ideal power, heavy curl', repeat(() => gestureFor(0.82, 0.85, 1.0, 0.9), N));
tally('Center, ideal power, no curl', repeat(() => gestureFor(0, 0.5, 1.0, 0), N));
tally('Center, ideal power, heavy curl', repeat(() => gestureFor(0, 0.5, 1.0, 0.9), N));

console.log('\n--- Power: weak vs ideal vs thunderbolt, otherwise identical shot ---');
tally('Top-right corner, weak (0.35x)', repeat(() => gestureFor(0.7, 0.7, 0.35), N));
tally('Top-right corner, ideal (1.0x)', repeat(() => gestureFor(0.7, 0.7, 1.0), N));
tally('Top-right corner, thunderbolt (1.75x)', repeat(() => gestureFor(0.7, 0.7, 1.75), N));

console.log('\n--- computeSwipeCurl sign sanity check (path bow -> curl sign) ---');
function bowedPath(bowPx: number): { x: number; y: number }[] {
  // A swipe straight up (screen-space y decreasing) that bows sideways by
  // `bowPx` at its midpoint - mimics a curved finger swipe.
  const points: { x: number; y: number }[] = [];
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bow = Math.sin(t * Math.PI) * bowPx;
    points.push({ x: bow, y: 200 - t * 200 });
  }
  return points;
}
console.log('bow right (+30px):', computeSwipeCurl(bowedPath(30)).toFixed(3), '(expect > 0)');
console.log('bow left  (-30px):', computeSwipeCurl(bowedPath(-30)).toFixed(3), '(expect < 0)');
console.log('straight  (0px):  ', computeSwipeCurl(bowedPath(0)).toFixed(3), '(expect ~0)');
