/** Contact haptics. Shares the session mute flag with the synth SFX. */

import { isMuted } from './audio';

function vibrate(pattern: number | number[]): void {
  if (isMuted()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Some browsers expose vibrate but reject it outside a user gesture.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Soft tap when the ball is knocked sideways. */
export function hapticKnock(): void {
  vibrate(12);
}

/** Kick pulse scaled by how hard the shot was struck. */
export function hapticKick(power: number): void {
  vibrate(Math.round(10 + clamp(power, 0.25, 1.8) * 22));
}

export function hapticPost(): void {
  vibrate([8, 24, 36]);
}

export function hapticBlock(): void {
  vibrate(18);
}

export function hapticGoal(): void {
  vibrate([18, 40, 28, 40, 55]);
}

export function hapticWhistle(): void {
  vibrate(8);
}
