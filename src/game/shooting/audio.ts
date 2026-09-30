/** Small synthesized sound-effect engine (no external audio assets required). */

import type { CrowdBedLevel } from './chanceAtmosphere';

export type { CrowdBedLevel };

let ctx: AudioContext | null = null;
let muted = false;
let crowdMaster: GainNode | null = null;
let crowdBed: GainNode | null = null;
let crowdCheer: GainNode | null = null;
let crowdGroan: GainNode | null = null;
let crowdStarted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (value) hushCrowd(0.08);
}

export function isMuted(): boolean {
  return muted;
}

function tone(
  freq: number,
  durationSec: number,
  {
    type = 'sine',
    startGain = 0.28,
    delaySec = 0,
    freqEnd,
  }: { type?: OscillatorType; startGain?: number; delaySec?: number; freqEnd?: number } = {},
) {
  const audio = getCtx();
  if (!audio || muted) return;
  const t0 = audio.currentTime + delaySec;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + durationSec);
  }
  gain.gain.setValueAtTime(startGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + durationSec + 0.02);
}

function noiseBurst(durationSec: number, { startGain = 0.25, delaySec = 0, filterFreq = 1200 }: { startGain?: number; delaySec?: number; filterFreq?: number } = {}) {
  const audio = getCtx();
  if (!audio || muted) return;
  const t0 = audio.currentTime + delaySec;
  const bufferSize = Math.floor(audio.sampleRate * durationSec);
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(startGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  src.start(t0);
  src.stop(t0 + durationSec + 0.02);
}

function noiseBuffer(audio: AudioContext, seconds: number, colour: 'roar' | 'groan'): AudioBuffer {
  const frames = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let pink = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    pink = 0.92 * pink + 0.08 * white;
    const swell = colour === 'roar'
      ? 0.78 + 0.22 * Math.sin((i / audio.sampleRate) * 17 + pink * 3)
      : 0.7 + 0.3 * Math.sin((i / audio.sampleRate) * 6.5);
    data[i] = (pink * 0.72 + white * 0.28) * swell;
  }
  return buffer;
}

function playCrowdBurst(
  audio: AudioContext,
  t0: number,
  {
    seconds,
    colour,
    gain,
    hp,
    lp,
    band,
    delay = 0,
    rise = 0.05,
  }: {
    seconds: number;
    colour: 'roar' | 'groan';
    gain: number;
    hp: number;
    lp: number;
    band?: number;
    delay?: number;
    rise?: number;
  },
): void {
  const start = t0 + delay;
  const src = audio.createBufferSource();
  src.buffer = noiseBuffer(audio, seconds + 0.04, colour);
  const high = audio.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = hp;
  const low = audio.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = lp;
  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.linearRampToValueAtTime(gain, start + rise);
  env.gain.linearRampToValueAtTime(gain * 0.72, start + seconds * 0.55);
  env.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  src.connect(high);
  if (band != null) {
    const mid = audio.createBiquadFilter();
    mid.type = 'bandpass';
    mid.frequency.value = band;
    mid.Q.value = 0.55;
    high.connect(mid);
    mid.connect(low);
  } else {
    high.connect(low);
  }
  low.connect(env);
  env.connect(audio.destination);
  src.start(start);
  src.stop(start + seconds + 0.02);
}

/** Keep the old buses muted so a leftover loop from a previous build cannot wash. */
function ensureCrowd(audio: AudioContext): GainNode {
  if (crowdMaster && crowdStarted) return crowdMaster;
  const master = crowdMaster ?? audio.createGain();
  master.gain.value = 1;
  if (!crowdMaster) master.connect(audio.destination);
  crowdMaster = master;

  const bed = crowdBed ?? audio.createGain();
  bed.gain.value = 0.0001;
  if (!crowdBed) bed.connect(master);
  crowdBed = bed;

  const cheer = crowdCheer ?? audio.createGain();
  cheer.gain.value = 0.0001;
  if (!crowdCheer) cheer.connect(master);
  crowdCheer = cheer;

  const groan = crowdGroan ?? audio.createGain();
  groan.gain.value = 0.0001;
  if (!crowdGroan) groan.connect(master);
  crowdGroan = groan;

  crowdStarted = true;
  return master;
}

function hushBus(node: GainNode | null, seconds: number): void {
  const audio = getCtx();
  if (!audio || !node) return;
  const now = audio.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), now);
  node.gain.linearRampToValueAtTime(0.0001, now + seconds);
}

function hushCrowd(seconds: number): void {
  hushBus(crowdBed, seconds);
  hushBus(crowdCheer, seconds);
  hushBus(crowdGroan, seconds);
}

/** The old looping wash read as ocean, not a crowd — stay silent until an outcome. */
export function startCrowdBed(_level: CrowdBedLevel = {}): void {
  hushCrowd(0.08);
}

export type CrowdReaction = 'cheer' | 'groan';

/** Goal = a stacked stadium roar. Miss = a falling collective groan. No voiced YES/OH. */
export function reactCrowd(reaction: CrowdReaction): void {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  ensureCrowd(audio);
  const now = audio.currentTime;
  hushCrowd(0.04);

  if (reaction === 'cheer') {
    playCrowdBurst(audio, now, { seconds: 1.15, colour: 'roar', gain: 0.22, hp: 90, lp: 900, delay: 0, rise: 0.04 });
    playCrowdBurst(audio, now, { seconds: 1.05, colour: 'roar', gain: 0.16, hp: 280, lp: 1800, band: 980, delay: 0.03, rise: 0.05 });
    playCrowdBurst(audio, now, { seconds: 0.9, colour: 'roar', gain: 0.11, hp: 520, lp: 2600, band: 1600, delay: 0.07, rise: 0.04 });
    playCrowdBurst(audio, now, { seconds: 0.7, colour: 'roar', gain: 0.07, hp: 900, lp: 3400, band: 2200, delay: 0.11, rise: 0.03 });
    return;
  }

  playCrowdBurst(audio, now, { seconds: 0.95, colour: 'groan', gain: 0.2, hp: 60, lp: 420, delay: 0, rise: 0.06 });
  playCrowdBurst(audio, now, { seconds: 0.85, colour: 'groan', gain: 0.12, hp: 120, lp: 700, band: 280, delay: 0.04, rise: 0.08 });
  playCrowdBurst(audio, now, { seconds: 0.7, colour: 'groan', gain: 0.07, hp: 180, lp: 520, delay: 0.08, rise: 0.1 });
}

/** @deprecated Outcome reactions now go through reactCrowd. Blocks stay silent. */
export function swellCrowd(kind: 'goal' | 'miss' | 'save' | 'post' | 'block', home = true): void {
  if (kind === 'block') return;
  const scored = kind === 'goal';
  reactCrowd(scored === home ? 'cheer' : 'groan');
}

export function stopCrowdBed(): void {
  hushCrowd(0.35);
}

export function playKick(power: number): void {
  noiseBurst(0.08, { startGain: 0.3 + power * 0.1, filterFreq: 2200 });
  tone(140, 0.09, { type: 'triangle', startGain: 0.22, freqEnd: 60 });
}

export function playKnock(): void {
  noiseBurst(0.05, { startGain: 0.12, filterFreq: 900 });
  tone(90, 0.06, { type: 'sine', startGain: 0.08, freqEnd: 50 });
}

export function playPost(): void {
  noiseBurst(0.04, { startGain: 0.3, filterFreq: 1500 });
  tone(155, 0.08, { type: 'triangle', startGain: 0.2, freqEnd: 68 });
  tone(620, 0.24, { type: 'sine', startGain: 0.15, freqEnd: 410 });
  tone(880, 0.14, { type: 'sine', startGain: 0.06, delaySec: 0.018, freqEnd: 640 });
}

export function playGoal(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone(f, 0.32, { type: 'triangle', startGain: 0.2, delaySec: i * 0.09 }));
  noiseBurst(0.6, { startGain: 0.12, filterFreq: 3000, delaySec: 0.1 });
}

export function playSave(): void {
  tone(220, 0.18, { type: 'sawtooth', startGain: 0.2, freqEnd: 90 });
  noiseBurst(0.2, { startGain: 0.18, filterFreq: 800, delaySec: 0.03 });
}

export function playMiss(): void {
  tone(180, 0.28, { type: 'sine', startGain: 0.15, freqEnd: 70 });
}

export function playBlock(): void {
  noiseBurst(0.12, { startGain: 0.28, filterFreq: 700 });
  tone(110, 0.14, { type: 'triangle', startGain: 0.2, freqEnd: 55 });
}

export function playWhistle(): void {
  tone(1800, 0.5, { type: 'square', startGain: 0.12, freqEnd: 1500 });
}
