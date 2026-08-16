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

/** Ball travel time bounds, in ms, fastest (max power) to slowest (min power). */
export const MIN_TRAVEL_MS = 420;
export const MAX_TRAVEL_MS = 950;

/** How many ms it takes the keeper to cover one normalized unit of dive distance. */
export const KEEPER_DIVE_MS_PER_UNIT = 300;

export const DEFAULT_DIFFICULTY: ShotDifficulty = {
  baseNoise: 0.085,
  powerNoisePenalty: 0.3,
  keeperReach: 0.36,
  keeperReactionMs: 230,
  keeperReadChance: 0.42,
  keeperReadBonus: 0.32,
};
