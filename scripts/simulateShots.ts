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
  SAVE_GRID_ROWS,
} from '../src/game/shooting/constants';
import { FIFA, LAYOUT, randomBallStartXRatio } from '../src/game/shooting/render';
import { aimToSaveCell, computeSwipeCurl, resolveShot, saveChanceForCell } from '../src/game/shooting/shotEngine';
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

console.log('\n--- 16×5 save-grid: centre should be the easiest save, top corners the hardest ---');
const centerCell = saveChanceForCell({ col: 7, row: 2 });
const centerCellR = saveChanceForCell({ col: 8, row: 2 });
const topLeft = saveChanceForCell({ col: 0, row: 4 });
const topRight = saveChanceForCell({ col: 15, row: 4 });
const lowCenter = saveChanceForCell({ col: 7, row: 0 });
const highCenter = saveChanceForCell({ col: 7, row: 4 });
const bottomLeft = saveChanceForCell({ col: 0, row: 0 });
console.log(
  `centre (7,2)=${(centerCell * 100).toFixed(1)}%  centre (8,2)=${(centerCellR * 100).toFixed(1)}%  high-centre=${(highCenter * 100).toFixed(1)}%  low-centre=${(lowCenter * 100).toFixed(1)}%`,
);
console.log(
  `top-left=${(topLeft * 100).toFixed(1)}%  top-right=${(topRight * 100).toFixed(1)}%  bottom-left=${(bottomLeft * 100).toFixed(1)}%`,
);
if (!(centerCell > highCenter && centerCell > lowCenter && centerCell > topLeft)) {
  console.error('FAIL: centre square is not the highest save chance');
  process.exitCode = 1;
}
if (!(topLeft < bottomLeft && topLeft < highCenter && Math.abs(topLeft - topRight) < 1e-9)) {
  console.error('FAIL: top corners are not the lowest save chance');
  process.exitCode = 1;
}

console.log('\nGrid save chance by row (ground→bar), col 0 / 7 / 15:');
for (let row = 0; row < SAVE_GRID_ROWS; row++) {
  const left = saveChanceForCell({ col: 0, row });
  const mid = saveChanceForCell({ col: 7, row });
  const right = saveChanceForCell({ col: 15, row });
  console.log(`  row ${row}: left=${(left * 100).toFixed(0)}%  mid=${(mid * 100).toFixed(0)}%  right=${(right * 100).toFixed(0)}%`);
}

const mapped = aimToSaveCell({ x: 0, y: 0.5 });
console.log(`aim (0, 0.5) maps to col=${mapped.col} row=${mapped.row} (expect ~7-8, ~2)`);
if (mapped.row !== 2 || (mapped.col !== 7 && mapped.col !== 8)) {
  console.error('FAIL: centre aim did not map to a centre cell');
  process.exitCode = 1;
}
const cornerAim = aimToSaveCell({ x: -0.95, y: 0.95 });
console.log(`aim (-0.95, 0.95) maps to col=${cornerAim.col} row=${cornerAim.row} (expect 0, 4)`);
if (cornerAim.col !== 0 || cornerAim.row !== 4) {
  console.error('FAIL: top-left aim did not map to (0, 4)');
  process.exitCode = 1;
}

console.log('\n--- Pitch markings: FIFA 6-yard / 18-yard ratios ---');
const sixToGoal = FIFA.sixYardWidth / FIFA.goalWidth;
const eighteenToGoal = FIFA.eighteenYardWidth / FIFA.goalWidth;
const depthRatio = FIFA.eighteenYardDepth / FIFA.sixYardDepth;
const penaltyRatio = FIFA.penaltySpot / FIFA.eighteenYardDepth;
console.log(`6-yard width / goal = ${sixToGoal.toFixed(3)} (FIFA 2.503)`);
console.log(`18-yard width / goal = ${eighteenToGoal.toFixed(3)} (FIFA 5.508)`);
console.log(`18-yard depth / 6-yard depth = ${depthRatio.toFixed(3)} (FIFA 3.000)`);
console.log(`penalty spot / 18-yard depth = ${penaltyRatio.toFixed(3)} (FIFA 0.667)`);
if (Math.abs(depthRatio - 3) > 1e-9) {
  console.error('FAIL: 18-yard depth is not 3× the 6-yard depth');
  process.exitCode = 1;
}

const h = 844;
const eighteenDepthPx = (LAYOUT.eighteenBottomY - LAYOUT.goalBottomY) * h;
const sixDepthPx = eighteenDepthPx * (FIFA.sixYardDepth / FIFA.eighteenYardDepth);
console.log(
  `layout: goal width=${(LAYOUT.goalHalfWidth * 2 * 100).toFixed(1)}% of canvas, 6-yard depth=${sixDepthPx.toFixed(1)}px, 18-yard depth=${eighteenDepthPx.toFixed(1)}px, ratio=${(eighteenDepthPx / sixDepthPx).toFixed(3)}`,
);
if (Math.abs(eighteenDepthPx / sixDepthPx - 3) > 1e-6) {
  console.error('FAIL: drawn box depths are not 3:1');
  process.exitCode = 1;
}

const xs = Array.from({ length: 200 }, () => randomBallStartXRatio());
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
console.log(`ball spawn x-ratio over 200 samples: min=${minX.toFixed(3)} max=${maxX.toFixed(3)} (expect spread across ~0.08–0.92)`);
if (maxX - minX < 0.5) {
  console.error('FAIL: ball spawn is not spreading across the screen width');
  process.exitCode = 1;
}
