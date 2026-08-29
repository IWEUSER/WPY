import type { ShotDifficulty } from './types';

/** Goal frame in normalized units: x spans [-1, 1], y spans [0, 1]. */
export const GOAL_HALF_WIDTH = 1;
export const GOAL_HEIGHT = 1;

/** Post/bar thickness in normalized units, used for the "hit the woodwork" check. */
export const WOODWORK_MARGIN = 0.045;

/** Minimum swipe distance (px) before a gesture counts as a shot attempt. */
export const MIN_SWIPE_DISTANCE = 18;

/** Swipe distance (px) that maps to full/maximum aim deflection. */
export const MAX_SWIPE_DISTANCE = 260;

/** Swipe distance (px) representing "ideal" power - beyond this, accuracy drops off. */
export const SWEET_SPOT_DISTANCE = 170;

/** Duration (ms) of a well-timed swipe covering SWEET_SPOT_DISTANCE at power 1.0. */
export const REFERENCE_SWIPE_DURATION_MS = 220;
export const REFERENCE_SPEED = SWEET_SPOT_DISTANCE / REFERENCE_SWIPE_DURATION_MS;

/** How far past the goal frame a fully-deflected swipe is allowed to aim.
 * Keeping this modest (~1.15) means a well-struck corner shot lands safely
 * inside the frame, and only near-maximal swipes risk missing on aim alone -
 * misses should mostly come from the random inaccuracy, not the mapping. */
export const AIM_X_OVERSHOOT = 1.15;
export const AIM_Y_OVERSHOOT = 1.15;

/** Ball travel time bounds, in ms, fastest (max power) to slowest (min power).
 * Widened so a full-blooded strike genuinely feels like a rocket compared to
 * a delicate touch, rather than a subtle difference in the same tempo. */
export const MIN_TRAVEL_MS = 260;
export const MAX_TRAVEL_MS = 1080;

/** How many ms it takes the keeper to cover one normalized unit of dive distance. */
export const KEEPER_DIVE_MS_PER_UNIT = 300;

/** Max |x| the keeper's hips travel, in normalized goal space (posts at ±1).
 * Feet trail the other way, so hips can sit closer to the ball than a standing
 * side-reach would allow without putting a boot past the post. */
export const KEEPER_DIVE_MAX_X = 0.58;

/** Radians of body rotation at full layout. Positive dir (right) rotates
 * clockwise: head and both arms go right, legs trail left. */
export const DIVE_LAYOUT_RAD = 1.48;

/** Standing hip height in normalized goal space (0 = ground, 1 = bar). */
export const KEEPER_STAND_Y = 0.28;

/**
 * On-target shots are resolved against a 16-across × 5-down grid painted on
 * the goal mouth. Each square has its own save chance: the dead-centre square
 * is where the keeper is strongest, the two top-corner squares are where they
 * are weakest.
 */
export const SAVE_GRID_COLS = 16;
export const SAVE_GRID_ROWS = 5;
/** Probability the keeper holds a shot aimed at the centre square. */
export const SAVE_CHANCE_CENTER = 0.9;
/** Probability the keeper holds a shot aimed at a top-corner square. */
export const SAVE_CHANCE_TOP_CORNER = 0.16;

/** Trajectory loft as a fraction of the ball-to-goal screen distance.
 * Kept modest so a soft placed shot doesn't balloon over the bar. */
export const MAX_ARC_ALONG_PATH = 0.18;
export const MIN_ARC_ALONG_PATH = 0.04;

/** How much a swipe's path has to bow away from a straight line (as a
 * fraction of the swipe's own length) to register as full (+-1) curl.
 * A gentle arch while drawing toward a corner should stay a slight bend,
 * not a full banana. */
export const CURL_BOW_SENSITIVITY = 0.32;

/** How far a fully-curled shot's flight path bends sideways, as a fraction
 * of canvas width. */
export const MAX_BEND_RATIO = 0.055;

export const DEFAULT_DIFFICULTY: ShotDifficulty = {
  baseNoise: 0.04,
  powerNoisePenalty: 0.16,
  curlNoisePenalty: 0.03,
  keeperReach: 0.3,
  powerReachPenalty: 0.55,
  keeperReactionMs: 250,
  keeperReadChance: 0.33,
  keeperReadBonus: 0.26,
  curlConfusion: 0.4,
};
