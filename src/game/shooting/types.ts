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
  /**
   * How much the swipe path bowed away from a straight line between its
   * start and end point, in [-1, 1]. This is what lets a player bend a shot:
   * a swipe that arcs to the right of its own straight line curls the ball
   * right, one that arcs left curls it left - independent of which way the
   * shot is aimed, mirroring how the inside/outside of the boot curls a real
   * strike. 0 (or omitted) means a straight, uncurled strike.
   */
  curl?: number;
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
  /** Effective curl actually applied to the flight, in [-1, 1] (see SwipeGesture.curl). */
  curl: number;
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
  /** Extra inaccuracy incurred from heavily curling a shot (harder to place). */
  curlNoisePenalty: number;
  /** Keeper's reach radius at full stretch (normalized units), before power/curl adjustments. */
  keeperReach: number;
  /** How much a powerful strike shrinks the keeper's effective reach (0-1: harder to hold onto firm shots). */
  powerReachPenalty: number;
  /** Keeper reaction delay before starting the dive, in ms. */
  keeperReactionMs: number;
  /** Chance (0-1) the keeper reads the shot correctly and dives the right way. */
  keeperReadChance: number;
  /** How much the keeper's read chance improves for slow/central shots. */
  keeperReadBonus: number;
  /** How much curl degrades the keeper's read chance (curling shots are deceptive). */
  curlConfusion: number;
}
