/**
 * Dev-only balance tool: simulates many shots against the shot engine to sanity
 * check that outcomes are appropriately random (i.e. not ~100% or ~0% goals).
 * Run with: npm run simulate
 */
import { CLOSE_THUNDERBOLT_M, CLOSE_THUNDERBOLT_YARDS, DEFAULT_DIFFICULTY, KEEPER_DIVE_MAX_X, MIN_TRAVEL_MS, PLANTED_SAVE_COL_MAX, PLANTED_SAVE_COL_MIN, REFERENCE_SPEED, SAVE_GRID_COLS, SAVE_GRID_ROWS } from '../src/game/shooting/constants';
import {
  BALL_SCREEN_Y,
  FIFA,
  MAX_SHOT_DISTANCE_M,
  MAX_SHOT_DISTANCE_YARDS,
  MIN_SHOT_DISTANCE_M,
  YARD_M,
  ballStartPixel,
  createPitchView,
  goalToPixel,
  keeperSilhouetteX,
  randomBallStartXRatio,
  randomShotDistanceM,
  worldToScreen,
  PLAYER_SKIN_TONES,
  type KeeperPose,
} from '../src/game/shooting/render';
import {
  DEFENDER_CLOSE_SPEED_MPS,
  DEFENDER_CLOSE_STOP_GAP_M,
  DEFENDER_GAP_M,
  advanceDefender,
  ballWorldXFromRatio,
  canKeepTenYardGap,
  defenderBlocksBall,
  defenderCloseTarget,
  defenderDistanceFromBallM,
  defenderOffsetFromShootingLineM,
  expectedChancesPerLeagueSeason,
  expectedPenaltiesPerSeason,
  penaltyChanceProbability,
  placeDefender,
  rollChanceSetup,
  shotLineHitsDefender,
} from '../src/game/shooting/chanceSetup';
import {
  aimToSaveCell,
  cellCenter,
  computeIntendedShot,
  computeKeeperDive,
  computeSwipeCurl,
  computeTravelTimeMs,
  diveIntensityForCell,
  isCloseThunderbolt,
  isPlantedSaveCol,
  resolveShot,
  saveChanceForCell,
} from '../src/game/shooting/shotEngine';
import type { SwipeGesture } from '../src/game/shooting/types';

const SIM_W = 390;
const SIM_H = 844;
const SIM_DISTANCE = 16.5;

/** Builds a swipe whose screen-space end sits on the requested aim point. */
function gestureFor(aimX: number, aimY: number, power: number, curl = 0, distanceM = SIM_DISTANCE): SwipeGesture {
  const view = createPitchView(SIM_W, SIM_H, distanceM);
  const ball = ballStartPixel(view, 0.5);
  const end = goalToPixel({ x: aimX, y: aimY }, view);
  const dx = end.x - ball.x;
  const dy = ball.y - end.y;
  const distance = Math.hypot(dx, dy);
  const speed = power * REFERENCE_SPEED;
  const durationMs = distance / speed;
  return {
    dx,
    dy,
    durationMs,
    curl,
    ballX: ball.x,
    ballY: ball.y,
    endX: end.x,
    endY: end.y,
    canvasW: SIM_W,
    canvasH: SIM_H,
    distanceM,
  };
}

function tally(label: string, gestures: SwipeGesture[]) {
  const counts: Record<string, number> = { goal: 0, saved: 0, post: 0, wide: 0, over: 0, blocked: 0 };
  for (const g of gestures) {
    const result = resolveShot(g);
    counts[result.outcome]++;
  }
  const total = gestures.length;
  const pct = (n: number) => ((n / total) * 100).toFixed(1) + '%';
  console.log(
    `${label.padEnd(34)} goal=${pct(counts.goal)} saved=${pct(counts.saved)} post=${pct(counts.post)} wide=${pct(counts.wide)} over=${pct(counts.over)} blocked=${pct(counts.blocked)}`,
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

const near = createPitchView(SIM_W, SIM_H, MIN_SHOT_DISTANCE_M);
const far = createPitchView(SIM_W, SIM_H, MAX_SHOT_DISTANCE_M);
const nearGoalFrac = (near.goal.halfW * 2) / SIM_W;
const farGoalFrac = (far.goal.halfW * 2) / SIM_W;
console.log(
  `camera: ${MIN_SHOT_DISTANCE_M}m goal=${(nearGoalFrac * 100).toFixed(1)}% of width, ${MAX_SHOT_DISTANCE_M}m goal=${(farGoalFrac * 100).toFixed(1)}%`,
);
if (!(nearGoalFrac > farGoalFrac * 1.15)) {
  console.error('FAIL: closer shots should show a clearly larger goal');
  process.exitCode = 1;
}
const ballNearY = ballStartPixel(near, 0.5).y / SIM_H;
const ballFarY = ballStartPixel(far, 0.5).y / SIM_H;
console.log(`ball screen Y at ${MIN_SHOT_DISTANCE_M}m=${ballNearY.toFixed(3)} at ${MAX_SHOT_DISTANCE_M}m=${ballFarY.toFixed(3)} (expect ${BALL_SCREEN_Y})`);
if (Math.abs(ballNearY - BALL_SCREEN_Y) > 1e-6 || Math.abs(ballFarY - BALL_SCREEN_Y) > 1e-6) {
  console.error('FAIL: ball screen Y must stay fixed when distance changes');
  process.exitCode = 1;
}

const sixDrawn = (near.halfWidthPx(FIFA.sixYardWidth / 2, 0) * 2) / (near.goal.halfW * 2);
console.log(`drawn 6-yard/goal width at goal line=${sixDrawn.toFixed(3)} (expect ${sixToGoal.toFixed(3)})`);
if (Math.abs(sixDrawn - sixToGoal) > 1e-6) {
  console.error('FAIL: 6-yard width is not FIFA-proportioned to the goal');
  process.exitCode = 1;
}

const sixYardAtClose = near.screenY(FIFA.sixYardDepth) / SIM_H;
console.log(
  `at ${MIN_SHOT_DISTANCE_M}m: 6-yard line Y=${sixYardAtClose.toFixed(3)} ball Y=${BALL_SCREEN_Y.toFixed(3)} (must sit on the ball)`,
);
if (Math.abs(sixYardAtClose - BALL_SCREEN_Y) > 0.02) {
  console.error('FAIL: on the 6-yard line the marking should sit at the ball');
  process.exitCode = 1;
}
if (!(nearGoalFrac > 0.55)) {
  console.error('FAIL: a 6-yard spawn should make the goal look close (more than half the screen wide)');
  process.exitCode = 1;
}

const farSixY = far.screenY(FIFA.sixYardDepth) / SIM_H;
const farGoalY = far.goal.botY / SIM_H;
const farBallY = BALL_SCREEN_Y;
const far18Y = far.screenY(FIFA.eighteenYardDepth) / SIM_H;
const t18 = (far18Y - farGoalY) / (farBallY - farGoalY);
const expectedT18 = FIFA.eighteenYardDepth / MAX_SHOT_DISTANCE_M;
const farYards = MAX_SHOT_DISTANCE_M / YARD_M;
console.log(
  `at ${MAX_SHOT_DISTANCE_M.toFixed(2)}m (${farYards.toFixed(1)} yards): 6-yard Y=${farSixY.toFixed(3)} 18-yard Y=${far18Y.toFixed(3)} goal Y=${farGoalY.toFixed(3)} ball Y=${farBallY.toFixed(3)}`,
);
console.log(`18-yard is ${(t18 * 100).toFixed(1)}% of the goal-to-ball gap (expect ${(expectedT18 * 100).toFixed(1)}% = 18/30 yards)`);
if (Math.abs(MAX_SHOT_DISTANCE_YARDS - 30) > 1e-9 || Math.abs(farYards - 30) > 0.05) {
  console.error('FAIL: furthest spawn is not 30 yards from the goal line');
  process.exitCode = 1;
}
if (Math.abs(t18 - expectedT18) > 0.03) {
  console.error('FAIL: 18-yard line is not 18/30 of the way from the goal to a 30-yard ball');
  process.exitCode = 1;
}
if (!(nearGoalFrac / farGoalFrac > 2)) {
  console.error('FAIL: 6-yard vs 30-yard goal size ratio should be clearly larger than 2×');
  process.exitCode = 1;
}

const keeperH = FIFA.keeperHeight / FIFA.goalHeight;
console.log(`keeper height / goal = ${keeperH.toFixed(3)} (6'2" / 8' = 0.770)`);
const keeperW = FIFA.keeperWidth / FIFA.goalWidth;
console.log(`keeper ready width / goal = ${keeperW.toFixed(3)} (1.4m / 7.32m = 0.191)`);

const distances = Array.from({ length: 80 }, () => randomShotDistanceM());
const dMin = Math.min(...distances);
const dMax = Math.max(...distances);
console.log(`shot distance samples: min=${dMin.toFixed(1)}m max=${dMax.toFixed(1)}m`);
if (dMax - dMin < 12) {
  console.error('FAIL: shot distance is not spanning 6-yard to 30 yards');
  process.exitCode = 1;
}
if (dMin < MIN_SHOT_DISTANCE_M - 0.05 || dMax > MAX_SHOT_DISTANCE_M + 0.05) {
  console.error('FAIL: shot distance samples escaped the 6-yard to 30-yard range');
  process.exitCode = 1;
}

const aimed = computeIntendedShot(gestureFor(-0.82, 0.85, 1.0));
console.log(`aim recovery top-left: x=${aimed.aim.x.toFixed(3)} y=${aimed.aim.y.toFixed(3)} (expect ~-0.82, 0.85)`);
if (Math.abs(aimed.aim.x - -0.82) > 0.08 || Math.abs(aimed.aim.y - 0.85) > 0.08) {
  console.error('FAIL: drawing onto a corner did not aim at that corner');
  process.exitCode = 1;
}
const softLow = computeIntendedShot(gestureFor(0.2, 0.12, 0.35));
console.log(`soft low placement: y=${softLow.aim.y.toFixed(3)} (must stay under the bar)`);
if (softLow.aim.y > 0.45) {
  console.error('FAIL: a soft touch aimed low is still going high/over');
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

console.log('\n--- Keeper dive: 160 square-specific save/miss motions ---');
const midIntensity = diveIntensityForCell({ col: 7, row: 2 });
const midIntensityR = diveIntensityForCell({ col: 8, row: 2 });
const col6 = diveIntensityForCell({ col: 6, row: 2 });
const col5 = diveIntensityForCell({ col: 5, row: 2 });
const outerL = diveIntensityForCell({ col: 0, row: 4 });
const outerR = diveIntensityForCell({ col: 15, row: 4 });
const col13 = diveIntensityForCell({ col: 13, row: 2 });
const col14 = diveIntensityForCell({ col: 14, row: 2 });
console.log(
  `intensity: planted6=${col6} planted7=${midIntensity} planted8=${midIntensityR} col5=${col5.toFixed(2)} col13=${col13.toFixed(2)} col14=${col14.toFixed(2)} col0=${outerL} col15=${outerR}`,
);
for (const col of [6, 7, 8]) {
  if (diveIntensityForCell({ col, row: 2 }) !== 0 || !isPlantedSaveCol(col)) {
    console.error(`FAIL: column ${col} must be a standing catch (1-based square ${col + 1})`);
    process.exitCode = 1;
  }
}
if (col5 === 0 || col13 === 0 || col14 === 0) {
  console.error('FAIL: columns 5, 13 and 14 must dive — standing is only for the three centre squares');
  process.exitCode = 1;
}
if (PLANTED_SAVE_COL_MIN !== 6 || PLANTED_SAVE_COL_MAX !== 8) {
  console.error('FAIL: planted band must be the three centre columns 6–8 (1-based 7–9)');
  process.exitCode = 1;
}

const poseKey = (d: ReturnType<typeof computeKeeperDive>) =>
  [d.target.x, d.target.y, d.hand.x, d.hand.y, d.layout, d.stretch, d.elevation, d.direction].map((n) => n.toFixed(4)).join(',');
const keys = new Set<string>();
for (let col = 0; col < SAVE_GRID_COLS; col++) {
  for (let row = 0; row < SAVE_GRID_ROWS; row++) {
    const square = cellCenter({ col, row });
    for (const saved of [true, false]) {
      keys.add(poseKey(computeKeeperDive(square, { col, row }, saved, DEFAULT_DIFFICULTY)));
    }
  }
}
console.log(`unique save/miss poses: ${keys.size} (expect 160)`);
if (keys.size !== 160) {
  console.error('FAIL: expected 160 distinct square motions (80 squares × save/miss)');
  process.exitCode = 1;
}

function poseFromDive(d: ReturnType<typeof computeKeeperDive>, beaten = false): KeeperPose {
  return {
    pos: d.target,
    stretch: d.stretch,
    direction: d.direction,
    layout: d.layout,
    elevation: d.elevation,
    hand: d.hand,
    beaten,
    skinTone: PLAYER_SKIN_TONES[1],
  };
}

const stand = computeKeeperDive({ x: 0.02, y: 0.5 }, { col: 8, row: 2 }, true, DEFAULT_DIFFICULTY);
const saveLeft = computeKeeperDive({ x: -0.92, y: 0.9 }, { col: 0, row: 4 }, true, DEFAULT_DIFFICULTY);
const saveRight = computeKeeperDive({ x: 0.92, y: 0.9 }, { col: 15, row: 4 }, true, DEFAULT_DIFFICULTY);
const missLeft = computeKeeperDive({ x: -0.92, y: 0.9 }, { col: 0, row: 4 }, false, DEFAULT_DIFFICULTY);
const missRight = computeKeeperDive({ x: 0.92, y: 0.9 }, { col: 15, row: 4 }, false, DEFAULT_DIFFICULTY);
const lowSave = computeKeeperDive({ x: -0.92, y: 0.1 }, { col: 0, row: 0 }, true, DEFAULT_DIFFICULTY);
const nudge = computeKeeperDive({ x: -0.35, y: 0.4 }, { col: 5, row: 1 }, true, DEFAULT_DIFFICULTY);
const save13 = computeKeeperDive({ x: 0.69, y: 0.5 }, { col: 13, row: 2 }, true, DEFAULT_DIFFICULTY, 320);
const save14 = computeKeeperDive({ x: 0.81, y: 0.5 }, { col: 14, row: 2 }, true, DEFAULT_DIFFICULTY, 320);
const sq13 = cellCenter({ col: 13, row: 2 });
const sq14 = cellCenter({ col: 14, row: 2 });
const sq0 = cellCenter({ col: 0, row: 4 });
const leftSil = keeperSilhouetteX(poseFromDive(saveLeft));
const rightSil = keeperSilhouetteX(poseFromDive(saveRight));
console.log(
  `stand: dir=${stand.direction} hips=${stand.target.x.toFixed(3)} layout=${stand.layout.toFixed(2)}`,
);
console.log(
  `save top-left: dir=${saveLeft.direction} hips=${saveLeft.target.x.toFixed(3)} hand=(${saveLeft.hand.x.toFixed(2)},${saveLeft.hand.y.toFixed(2)}) layout=${saveLeft.layout.toFixed(2)} elev=${saveLeft.elevation.toFixed(2)}`,
);
console.log(
  `left silhouette: glove=${leftSil.glove.toFixed(2)} hip=${leftSil.hip.toFixed(2)} foot=${leftSil.foot.toFixed(2)} (arms left, legs trail right)`,
);
console.log(
  `right silhouette: glove=${rightSil.glove.toFixed(2)} hip=${rightSil.hip.toFixed(2)} foot=${rightSil.foot.toFixed(2)} (arms right, legs trail left)`,
);
console.log(
  `col13 save: dir=${save13.direction} layout=${save13.layout.toFixed(2)} hand=(${save13.hand.x.toFixed(2)},${save13.hand.y.toFixed(2)}) square=(${sq13.x.toFixed(2)},${sq13.y.toFixed(2)}) duration=${save13.diveDurationMs} travel=320`,
);
console.log(
  `col14 save: dir=${save14.direction} layout=${save14.layout.toFixed(2)} hand=(${save14.hand.x.toFixed(2)},${save14.hand.y.toFixed(2)}) square=(${sq14.x.toFixed(2)},${sq14.y.toFixed(2)})`,
);
console.log(
  `miss top-left: hand=(${missLeft.hand.x.toFixed(2)},${missLeft.hand.y.toFixed(2)}) layout=${missLeft.layout.toFixed(2)}`,
);
console.log(
  `low save: hips.y=${lowSave.target.y.toFixed(2)} layout=${lowSave.layout.toFixed(2)} (must sprawl on the ground)`,
);
if (stand.direction !== 0 || stand.layout > 0.25) {
  console.error('FAIL: a centre-square save must stay planted, not dive');
  process.exitCode = 1;
}
if (saveLeft.direction !== -1 || missRight.direction !== 1 || save13.direction !== 1 || save14.direction !== 1) {
  console.error('FAIL: keeper dived the wrong way');
  process.exitCode = 1;
}
if (Math.abs(saveLeft.target.x) > KEEPER_DIVE_MAX_X + 1e-9 || Math.abs(missRight.target.x) > KEEPER_DIVE_MAX_X + 1e-9) {
  console.error('FAIL: dive hips went past the allowed in-post range');
  process.exitCode = 1;
}
if (Math.hypot(saveLeft.hand.x - sq0.x, saveLeft.hand.y - sq0.y) > 0.02) {
  console.error('FAIL: a corner save must put the glove on that square');
  process.exitCode = 1;
}
if (Math.hypot(save13.hand.x - sq13.x, save13.hand.y - sq13.y) > 0.02 || Math.hypot(save14.hand.x - sq14.x, save14.hand.y - sq14.y) > 0.02) {
  console.error('FAIL: a save at square 13 or 14 must put the gloves on that square, not stand in the middle');
  process.exitCode = 1;
}
if (save13.layout < 0.45 || save14.layout < 0.45) {
  console.error('FAIL: a save at square 13 or 14 must be a dive, not an upright catch');
  process.exitCode = 1;
}
if (save13.diveDurationMs > 320 + 1e-6) {
  console.error('FAIL: a save dive must finish by the time the ball arrives');
  process.exitCode = 1;
}
if (Math.abs(missLeft.hand.x) >= Math.abs(saveLeft.hand.x) - 0.05) {
  console.error('FAIL: a corner miss must fall short of the save reach');
  process.exitCode = 1;
}
if (!(leftSil.glove < leftSil.hip - 0.4 && leftSil.hip < leftSil.foot - 0.4)) {
  console.error('FAIL: a left full-stretch dive must have both arms left of the hips and legs trailing right');
  process.exitCode = 1;
}
if (!(rightSil.glove > rightSil.hip + 0.4 && rightSil.hip > rightSil.foot + 0.4)) {
  console.error('FAIL: a right full-stretch dive must have both arms right of the hips and legs trailing left');
  process.exitCode = 1;
}
if (saveLeft.layout < 0.55 || saveLeft.elevation < 0.8) {
  console.error('FAIL: a top-corner save should be a leaping full-length dive, not a side reach');
  process.exitCode = 1;
}
if (lowSave.layout < 0.7 || lowSave.target.y > 0.2) {
  console.error('FAIL: a low corner save should sprawl near the ground');
  process.exitCode = 1;
}
if (!(missRight.stretch < saveLeft.stretch)) {
  console.error('FAIL: a beaten outer dive should stretch less than a save');
  process.exitCode = 1;
}
if (nudge.direction === 0 || nudge.layout >= saveLeft.layout) {
  console.error('FAIL: a near-centre square should dive, but less than an outer square');
  process.exitCode = 1;
}

let uncoveredSave = 0;
let standingOffCentreSave = 0;
for (let col = 0; col < SAVE_GRID_COLS; col++) {
  for (let row = 0; row < SAVE_GRID_ROWS; row++) {
    const square = cellCenter({ col, row });
    const d = computeKeeperDive(square, { col, row }, true, DEFAULT_DIFFICULTY, 400);
    if (Math.hypot(d.hand.x - square.x, d.hand.y - square.y) > 0.02) uncoveredSave++;
    if (!isPlantedSaveCol(col) && (d.direction === 0 || d.layout < 0.45)) standingOffCentreSave++;
    if (d.diveDurationMs > 400 + 1e-6) uncoveredSave++;
  }
}
console.log(`save coverage: uncovered=${uncoveredSave} standing-off-centre=${standingOffCentreSave} (expect 0, 0)`);
if (uncoveredSave > 0) {
  console.error('FAIL: a save must put the gloves on that square by the time the ball arrives');
  process.exitCode = 1;
}
if (standingOffCentreSave > 0) {
  console.error('FAIL: only the three centre columns may catch without diving');
  process.exitCode = 1;
}

let wrongWay = 0;
let pastPost = 0;
let handPastPost = 0;
const DIVE_N = 4000;
for (let i = 0; i < DIVE_N; i++) {
  const g = gestureFor((Math.random() * 2 - 1) * 0.95, 0.15 + Math.random() * 0.8, 0.6 + Math.random() * 0.8);
  const result = resolveShot(g);
  const dive = result.keeperDive;
  if (Math.abs(dive.target.x) > KEEPER_DIVE_MAX_X + 1e-6) pastPost++;
  if (Math.abs(dive.hand.x) > 1 + 1e-6) handPastPost++;
  if (Math.abs(result.aim.x) > 0.04 && dive.direction !== 0 && Math.sign(dive.direction) !== Math.sign(result.aim.x)) {
    wrongWay++;
  }
}
console.log(`random on-goal dives: wrong-way=${wrongWay}/${DIVE_N} hips-past-post=${pastPost}/${DIVE_N} glove-past-post=${handPastPost}/${DIVE_N}`);
if (wrongWay > 0) {
  console.error('FAIL: keeper dived the wrong way on at least one shot');
  process.exitCode = 1;
}
if (pastPost > 0 || handPastPost > 0) {
  console.error('FAIL: keeper dive went past the post');
  process.exitCode = 1;
}

console.log('\n--- Thunderbolt: dive from range, flinch only inside 16 yards ---');
const boltTravel = computeTravelTimeMs(1.75, 16.5);
console.log(`thunderbolt travel at 16.5m: ${boltTravel.toFixed(0)}ms (must stay positive and at least a frame)`);
if (!(boltTravel >= MIN_TRAVEL_MS * 0.7 - 1e-6) || boltTravel > 1080) {
  console.error('FAIL: thunderbolt travel time escaped a readable range (was previously able to go negative)');
  process.exitCode = 1;
}
const farM = 25 * YARD_M;
const closeM = 10 * YARD_M;
const farBolt = computeKeeperDive(sq13, { col: 13, row: 2 }, false, DEFAULT_DIFFICULTY, 400, { power: 1.75, distanceM: farM });
const closeBolt = computeKeeperDive(sq13, { col: 13, row: 2 }, false, DEFAULT_DIFFICULTY, 200, { power: 1.75, distanceM: closeM });
const farSave = computeKeeperDive(sq13, { col: 13, row: 2 }, true, DEFAULT_DIFFICULTY, 400, { power: 1.75, distanceM: farM });
console.log(
  `25-yard thunderbolt miss: dir=${farBolt.direction} layout=${farBolt.layout.toFixed(2)} (must dive)`,
);
console.log(
  `10-yard thunderbolt miss: dir=${closeBolt.direction} layout=${closeBolt.layout.toFixed(2)} (must barely move)`,
);
console.log(
  `25-yard thunderbolt save: layout=${farSave.layout.toFixed(2)} hand=(${farSave.hand.x.toFixed(2)},${farSave.hand.y.toFixed(2)})`,
);
if (!isCloseThunderbolt(1.75, closeM) || isCloseThunderbolt(1.75, farM) || isCloseThunderbolt(1.0, closeM)) {
  console.error('FAIL: close-thunderbolt gate should be high power AND 16 yards or less');
  process.exitCode = 1;
}
if (CLOSE_THUNDERBOLT_YARDS !== 16 || Math.abs(CLOSE_THUNDERBOLT_M - 16 * YARD_M) > 1e-6) {
  console.error('FAIL: close thunderbolt range must be 16 yards');
  process.exitCode = 1;
}
if (farBolt.direction !== 1 || farBolt.layout < 0.4) {
  console.error('FAIL: a thunderbolt from 25 yards must still produce a dive, even if it is a goal');
  process.exitCode = 1;
}
if (closeBolt.layout > 0.18 || Math.abs(closeBolt.target.x) > 0.12) {
  console.error('FAIL: a thunderbolt from 10 yards is too fast — the keeper should only flinch');
  process.exitCode = 1;
}
if (Math.hypot(farSave.hand.x - sq13.x, farSave.hand.y - sq13.y) > 0.02) {
  console.error('FAIL: a saved thunderbolt from range must still cover the ball');
  process.exitCode = 1;
}
let standingFarBolt = 0;
for (let i = 0; i < 80; i++) {
  const g = gestureFor((Math.random() * 0.6 + 0.35) * (Math.random() < 0.5 ? -1 : 1), 0.3 + Math.random() * 0.5, 1.75, 0, farM);
  const result = resolveShot(g, { rng: () => 0.99 });
  if (result.outcome === 'goal' && !isPlantedSaveCol(aimToSaveCell(result.aim).col) && result.keeperDive.layout < 0.4) {
    standingFarBolt++;
  }
}
console.log(`25-yard thunderbolt goals with a standing keeper: ${standingFarBolt}/80 (expect 0)`);
if (standingFarBolt > 0) {
  console.error('FAIL: beaten thunderbolts from outside 16 yards must still be a dive');
  process.exitCode = 1;
}

console.log('\n--- Defender placement: 10-yard gap, or off the shooting line near goal ---');
const farSamples = 400;
let gapFail = 0;
let gapMin = Infinity;
for (let i = 0; i < farSamples; i++) {
  const dist = 14 + (i / farSamples) * (MAX_SHOT_DISTANCE_M - 14);
  const xRatio = 0.1 + (i % 9) * 0.1;
  const def = placeDefender(dist, xRatio, () => ((i * 17 + 3) % 1000) / 1000);
  const gap = defenderDistanceFromBallM(def, dist, xRatio);
  gapMin = Math.min(gapMin, gap);
  if (!canKeepTenYardGap(dist) || gap + 1e-6 < DEFENDER_GAP_M) gapFail++;
}
console.log(`open-play gap min=${gapMin.toFixed(2)}m over ${farSamples} samples (need ≥ ${DEFENDER_GAP_M.toFixed(2)}m)`);
if (gapFail > 0) {
  console.error(`FAIL: ${gapFail} open-play defenders stood inside 10 yards of the ball`);
  process.exitCode = 1;
}

const closeDist = MIN_SHOT_DISTANCE_M;
let lineFail = 0;
let closeOnLine = 0;
for (let i = 0; i < 200; i++) {
  const xRatio = 0.12 + (i % 8) * 0.1;
  const def = placeDefender(closeDist, xRatio, () => ((i * 31 + 11) % 1000) / 1000);
  const offset = defenderOffsetFromShootingLineM(def, closeDist, xRatio);
  if (offset < 1.6) lineFail++;
  const ballX = ballWorldXFromRatio(xRatio);
  if (Math.abs(def.worldX - ballX) < 0.35 && def.z < closeDist * 0.55) closeOnLine++;
}
console.log(`close-range (6-yard) off-line samples: line-offset fails=${lineFail}/200 on-line=${closeOnLine}/200`);
if (lineFail > 0 || closeOnLine > 0) {
  console.error('FAIL: a close-range defender must shade a post, not stand in front of the ball');
  process.exitCode = 1;
}
if (canKeepTenYardGap(closeDist)) {
  console.error('FAIL: a 6-yard spawn cannot keep a 10-yard gap to goal');
  process.exitCode = 1;
}

const view18 = createPitchView(SIM_W, SIM_H, 18);
const cover = placeDefender(18, 0.5, () => 0.2);
const torso = worldToScreen(view18, cover.worldX, cover.z);
const meterPx = view18.halfWidthPx(1, cover.z);
const hitBall = { x: torso.x, y: torso.y - 0.95 * meterPx };
const missBall = { x: torso.x + 2.4 * meterPx, y: torso.y - 0.95 * meterPx };
const lobBall = { x: torso.x, y: torso.y - 2.2 * meterPx };
const radius = 8;
const hit = defenderBlocksBall(view18, cover, hitBall, radius);
const miss = defenderBlocksBall(view18, cover, missBall, radius);
const lob = defenderBlocksBall(view18, cover, lobBall, radius);
console.log(`collision: into-body=${hit} wide=${miss} over-head=${lob} (expect true / false / false)`);
if (!hit || miss || lob) {
  console.error('FAIL: defender collision did not distinguish a body hit from a miss or a lob');
  process.exitCode = 1;
}

const lineDef = placeDefender(18, 0.5, () => 0.25);
const fromBall = (18 - lineDef.z) / 18;
const throughAimX = (lineDef.worldX / fromBall) / (FIFA.goalWidth / 2);
const through = shotLineHitsDefender(18, 0.5, { x: throughAimX, y: 0.22 }, lineDef);
const otherSide = shotLineHitsDefender(18, 0.5, { x: -Math.sign(throughAimX) * 0.85, y: 0.22 }, lineDef);
const lofted = shotLineHitsDefender(18, 0.5, { x: throughAimX, y: 1.15 }, lineDef);
console.log(`shot-line: through=${through} far-post=${otherSide} lofted=${lofted} (expect true / false / false)`);
if (!through || otherSide || lofted) {
  console.error('FAIL: the ball-to-aim line must hit a defender you shoot through, and miss around or over them');
  process.exitCode = 1;
}

console.log('\n--- Penalty chances: spot, no defender, season rate ---');
const pen = rollChanceSetup({ forcePenalty: true });
console.log(`forced penalty: dist=${pen.distanceM}m xRatio=${pen.ballStartXRatio} defender=${pen.defender}`);
if (pen.kind !== 'penalty' || pen.distanceM !== FIFA.penaltySpot || pen.ballStartXRatio !== 0.5 || pen.defender !== null) {
  console.error('FAIL: a penalty must sit on the spot, centred, with no defender');
  process.exitCode = 1;
}
const forcedOpen = rollChanceSetup({ forceDistanceM: 18, rng: () => 0 });
if (forcedOpen.kind !== 'open' || forcedOpen.defender === null) {
  console.error('FAIL: a forced open-play distance must still spawn a defender');
  process.exitCode = 1;
}

console.log('\n--- Defender closes toward the ball at a jog ---');
const closeStart = placeDefender(18, 0.5, () => 0.2);
const startGap = defenderDistanceFromBallM(closeStart, 18, 0.5);
let walked = { ...closeStart };
for (let i = 0; i < 25; i++) walked = advanceDefender(walked, 18, 0.5, 0.04);
const afterOne = defenderDistanceFromBallM(walked, 18, 0.5);
let settled = { ...closeStart };
for (let i = 0; i < 400; i++) settled = advanceDefender(settled, 18, 0.5, 0.04);
const settledGap = defenderDistanceFromBallM(settled, 18, 0.5);
const target = defenderCloseTarget(18, 0.5, closeStart.coverSide);
const settleErr = Math.hypot(settled.worldX - target.worldX, settled.z - target.z);
const closeTimeS = (startGap - DEFENDER_CLOSE_STOP_GAP_M) / DEFENDER_CLOSE_SPEED_MPS;
console.log(`18-yard close: startGap=${startGap.toFixed(2)} after1s=${afterOne.toFixed(2)} settled=${settledGap.toFixed(2)} time~${closeTimeS.toFixed(2)}s`);
if (!(afterOne < startGap - 1.5)) {
  console.error('FAIL: the defender must close toward the ball within a second');
  process.exitCode = 1;
}
if (settledGap + 1e-6 < DEFENDER_CLOSE_STOP_GAP_M - 0.05 || settleErr > 0.08) {
  console.error('FAIL: the defender must stop a few metres in front of the ball');
  process.exitCode = 1;
}
if (closeTimeS < 1.6 || closeTimeS > 5.5) {
  console.error('FAIL: the close-down should take a couple of seconds, not a sprint or a stroll');
  process.exitCode = 1;
}

const nearStart = placeDefender(MIN_SHOT_DISTANCE_M, 0.5, () => 0.3);
let nearNow = { ...nearStart };
for (let i = 0; i < 80; i++) nearNow = advanceDefender(nearNow, MIN_SHOT_DISTANCE_M, 0.5, 0.04);
const nearGap = defenderDistanceFromBallM(nearNow, MIN_SHOT_DISTANCE_M, 0.5);
console.log(`6-yard close: start=${defenderDistanceFromBallM(nearStart, MIN_SHOT_DISTANCE_M, 0.5).toFixed(2)} settled=${nearGap.toFixed(2)}`);
if (nearGap < 1.1) {
  console.error('FAIL: a 6-yard closer must not walk onto the ball');
  process.exitCode = 1;
}

const p52 = penaltyChanceProbability(52);
const p70 = penaltyChanceProbability(70);
const p94 = penaltyChanceProbability(94);
const pens52 = expectedPenaltiesPerSeason(52);
const pens70 = expectedPenaltiesPerSeason(70);
const pens94 = expectedPenaltiesPerSeason(94);
console.log(
  `pens/season: weak=${pens52.toFixed(1)} mid=${pens70.toFixed(1)} elite=${pens94.toFixed(1)}  per-chance=${(p52 * 100).toFixed(1)}% / ${(p70 * 100).toFixed(1)}% / ${(p94 * 100).toFixed(1)}%`,
);
if (!(pens52 < pens70 && pens70 < pens94 && pens52 > 2.5 && pens94 < 9.5 && pens70 > 4.5 && pens70 < 6.5)) {
  console.error('FAIL: penalty season rate is not in the 3–8 range scaled by club strength');
  process.exitCode = 1;
}
const midChances = expectedChancesPerLeagueSeason(70);
if (Math.abs(p70 * midChances - pens70) > 1e-6) {
  console.error('FAIL: per-chance penalty probability does not reconstruct the season rate');
  process.exitCode = 1;
}

let rolledPens = 0;
const ROLL_N = 20000;
for (let i = 0; i < ROLL_N; i++) {
  if (rollChanceSetup({ clubStrength: 70 }).kind === 'penalty') rolledPens++;
}
const rolledRate = rolledPens / ROLL_N;
console.log(`rolled penalty rate at strength 70: ${(rolledRate * 100).toFixed(2)}% (expect ~${(p70 * 100).toFixed(2)}%)`);
if (Math.abs(rolledRate - p70) > 0.012) {
  console.error('FAIL: rolled penalty frequency drifted from the season-rate probability');
  process.exitCode = 1;
}
