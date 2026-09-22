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
let crowdTargetGain = 0;

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

function crowdBaseGain(level: CrowdBedLevel): number {
  let gain = 0.016;
  if (level.home) gain += 0.004;
  if (level.night) gain += 0.003;
  if (level.cup) gain += 0.003;
  if (level.final) gain += 0.005;
  if (level.penalty) gain += 0.003;
  if (level.crowdFill === 'sparse') gain *= 0.4;
  if (level.crowdFill === 'empty') gain *= 0.08;
  return gain;
}

function voiceBuffer(audio: AudioContext, seconds: number, colour: 'bed' | 'cheer' | 'groan'): AudioBuffer {
  const frames = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  let pink = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.018 * white) / 1.018;
    pink = 0.97 * pink + 0.03 * white;
    const breath = 0.72 + 0.28 * Math.sin((i / audio.sampleRate) * (colour === 'cheer' ? 9.2 : colour === 'groan' ? 3.4 : 5.1));
    const chatter = Math.sin((i / audio.sampleRate) * (colour === 'cheer' ? 340 : colour === 'groan' ? 160 : 220) + brown * 8);
    if (colour === 'cheer') data[i] = (pink * 0.7 + white * 0.18 + chatter * 0.22) * breath;
    else if (colour === 'groan') data[i] = (brown * 2.4 + pink * 0.35 + chatter * 0.12) * breath;
    else data[i] = (brown * 1.8 + pink * 0.45) * breath;
  }
  return buffer;
}

function connectLoop(
  audio: AudioContext,
  buffer: AudioBuffer,
  dest: AudioNode,
  filter: { type: BiquadFilterType; freq: number; q?: number; gain?: number },
  extra?: { type: BiquadFilterType; freq: number; q?: number; gain?: number },
): void {
  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const a = audio.createBiquadFilter();
  a.type = filter.type;
  a.frequency.value = filter.freq;
  if (filter.q != null) a.Q.value = filter.q;
  if (filter.gain != null && 'gain' in a) a.gain.value = filter.gain;
  src.connect(a);
  if (extra) {
    const b = audio.createBiquadFilter();
    b.type = extra.type;
    b.frequency.value = extra.freq;
    if (extra.q != null) b.Q.value = extra.q;
    if (extra.gain != null) b.gain.value = extra.gain;
    a.connect(b);
    b.connect(dest);
  } else {
    a.connect(dest);
  }
  src.start();
}

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

  if (crowdStarted) return master;

  connectLoop(audio, voiceBuffer(audio, 3.4, 'bed'), bed, { type: 'lowpass', freq: 420, q: 0.6 }, { type: 'highpass', freq: 80, q: 0.5 });
  connectLoop(audio, voiceBuffer(audio, 2.6, 'cheer'), cheer, { type: 'bandpass', freq: 980, q: 0.7 }, { type: 'highpass', freq: 420, q: 0.4 });
  connectLoop(audio, voiceBuffer(audio, 3.1, 'groan'), groan, { type: 'lowpass', freq: 280, q: 0.8 }, { type: 'peaking', freq: 180, q: 0.9, gain: 5 });

  const rumble = audio.createOscillator();
  rumble.type = 'sine';
  rumble.frequency.value = 52;
  const rumbleGain = audio.createGain();
  rumbleGain.gain.value = 0.018;
  rumble.connect(rumbleGain);
  rumbleGain.connect(bed);
  rumble.start();

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

/** Quiet living wash under a chance — kept low so the outcome reaction reads. */
export function startCrowdBed(level: CrowdBedLevel = {}): void {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  ensureCrowd(audio);
  if (!crowdBed) return;
  crowdTargetGain = crowdBaseGain(level);
  const now = audio.currentTime;
  crowdBed.gain.cancelScheduledValues(now);
  crowdBed.gain.setValueAtTime(Math.max(0.0001, crowdBed.gain.value), now);
  crowdBed.gain.linearRampToValueAtTime(crowdTargetGain, now + 0.7);
  hushBus(crowdCheer, 0.2);
  hushBus(crowdGroan, 0.2);
}

export type CrowdReaction = 'cheer' | 'groan';

/** Home goal / away miss = cheer. Away goal / home miss = groan. */
export function reactCrowd(reaction: CrowdReaction): void {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  ensureCrowd(audio);
  const bus = reaction === 'cheer' ? crowdCheer : crowdGroan;
  if (!bus) return;
  const now = audio.currentTime;
  const peak = reaction === 'cheer' ? 0.28 : 0.24;
  const hold = reaction === 'cheer' ? 0.55 : 0.7;
  const tail = reaction === 'cheer' ? 1.7 : 1.9;
  bus.gain.cancelScheduledValues(now);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
  bus.gain.linearRampToValueAtTime(peak, now + (reaction === 'cheer' ? 0.07 : 0.14));
  bus.gain.linearRampToValueAtTime(peak * 0.72, now + hold);
  bus.gain.exponentialRampToValueAtTime(0.0001, now + tail);
}

/** @deprecated Outcome reactions now go through reactCrowd. */
export function swellCrowd(kind: 'goal' | 'miss' | 'save' | 'post' | 'block', home = true): void {
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
