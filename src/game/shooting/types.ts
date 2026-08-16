/** Normalized goal-plane coordinates: x in [-1, 1] (left post to right post,
 * 0 = center), y in [0, 1] (0 = ground, 1 = crossbar). Values can extend
 * beyond this range to represent shots that miss wide or over the bar. */
export interface AimPoint {
  x: number;
  y: number;
}

export interface SwipeGesture {
  /** Horizontal distance of the swipe in pixels, + is to the right. */
  dx: number;
  /** Vertical distance of the swipe in pixels, + is upward. */
  dy: number;
  /** Duration of the swipe gesture in milliseconds. */
  durationMs: number;
}

export type ShotZoneX = 'far-left' | 'left' | 'center' | 'right' | 'far-right';
export type ShotZoneY = 'low' | 'mid' | 'high';

export type ShotOutcomeKind = 'goal' | 'saved' | 'post' | 'wide' | 'over';

export interface KeeperDive {
  /** Where the keeper dives to, in the same normalized space as AimPoint. */
  target: AimPoint;
  /** Reaction delay before the dive itself begins, in milliseconds. */
  reactionMs: number;
  /** How long the dive takes to complete (including reaction), in milliseconds. */
  diveDurationMs: number;
  /** Effective reach radius once fully stretched, in normalized units. */
  reach: number;
}

export interface ShotResult {
  outcome: ShotOutcomeKind;
  /** Where the ball actually ends up crossing the goal plane (pre-clamp). */
  aim: AimPoint;
  /** The intended aim before random inaccuracy was applied. */
  intendedAim: AimPoint;
  power: number;
  travelTimeMs: number;
  keeperDive: KeeperDive;
  /** 0-1, how close the keeper's reach came to the ball; for UI/feedback. */
  saveMargin: number;
}

export interface ShotDifficulty {
  /** Baseline random inaccuracy applied to every shot (normalized units). */
  baseNoise: number;
  /** Extra inaccuracy incurred as power exceeds the "sweet spot". */
  powerNoisePenalty: number;
  /** Keeper's reach radius at full stretch (normalized units). */
  keeperReach: number;
  /** Keeper reaction delay before starting the dive, in ms. */
  keeperReactionMs: number;
  /** Chance (0-1) the keeper reads the shot correctly and dives the right way. */
  keeperReadChance: number;
  /** How much the keeper's read chance improves for slow/central shots. */
  keeperReadBonus: number;
}
