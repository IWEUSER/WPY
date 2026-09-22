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
  rumble.frequency.value = 68;
  const rumbleGain = audio.createGain();
  rumbleGain.gain.value = 0.006;
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

function peaking(audio: AudioContext, freq: number, q: number, gainDb: number): BiquadFilterNode {
  const node = audio.createBiquadFilter();
  node.type = 'peaking';
  node.frequency.value = freq;
  node.Q.value = q;
  node.gain.value = gainDb;
  return node;
}

function noiseSource(audio: AudioContext, seconds: number): AudioBufferSourceNode {
  const frames = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = audio.createBufferSource();
  src.buffer = buffer;
  return src;
}

/** One voiced shout with three formants — stacked to read as a small crowd. */
function shoutVoice(
  audio: AudioContext,
  t0: number,
  {
    duration,
    f0,
    f0End,
    f1,
    f2,
    f2Start,
    f3,
    gain,
    breath = 0.04,
  }: {
    duration: number;
    f0: number;
    f0End: number;
    f1: number;
    f2: number;
    f2Start?: number;
    f3: number;
    gain: number;
    breath?: number;
  },
): void {
  const osc = audio.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(60, f0End), t0 + duration);

  const a = peaking(audio, f1, 6.5, 18);
  const b = peaking(audio, f2Start ?? f2, 5.5, 16);
  if (f2Start != null && f2Start !== f2) {
    b.frequency.setValueAtTime(f2Start, t0);
    b.frequency.exponentialRampToValueAtTime(f2, t0 + Math.min(0.08, duration * 0.35));
  }
  const c = peaking(audio, f3, 4.2, 9);
  const hip = audio.createBiquadFilter();
  hip.type = 'highpass';
  hip.frequency.value = 90;
  const low = audio.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 4200;
  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.03);
  env.gain.linearRampToValueAtTime(gain * 0.82, t0 + duration * 0.55);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(a);
  a.connect(b);
  b.connect(c);
  c.connect(hip);
  hip.connect(low);
  low.connect(env);
  env.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);

  if (breath <= 0) return;
  const air = noiseSource(audio, duration + 0.04);
  const airFilter = audio.createBiquadFilter();
  airFilter.type = 'bandpass';
  airFilter.frequency.value = 1800;
  airFilter.Q.value = 0.7;
  const airGain = audio.createGain();
  airGain.gain.setValueAtTime(0.0001, t0);
  airGain.gain.linearRampToValueAtTime(breath, t0 + 0.02);
  airGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  air.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(audio.destination);
  air.start(t0);
  air.stop(t0 + duration + 0.02);
}

function shoutSibilant(audio: AudioContext, t0: number, gain: number): void {
  const src = noiseSource(audio, 0.18);
  const hip = audio.createBiquadFilter();
  hip.type = 'highpass';
  hip.frequency.value = 3800;
  const peak = peaking(audio, 6200, 1.1, 8);
  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.018);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  src.connect(hip);
  hip.connect(peak);
  peak.connect(env);
  env.connect(audio.destination);
  src.start(t0);
  src.stop(t0 + 0.18);
}

/** Home goal / away miss = a stacked human “yes”. Away goal / home miss = “oh”. */
export function reactCrowd(reaction: CrowdReaction): void {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  ensureCrowd(audio);
  const now = audio.currentTime;

  if (crowdBed) {
    crowdBed.gain.cancelScheduledValues(now);
    const bedNow = Math.max(0.0001, crowdBed.gain.value);
    crowdBed.gain.setValueAtTime(bedNow, now);
    crowdBed.gain.linearRampToValueAtTime(Math.min(crowdTargetGain * 1.35, bedNow * 1.2 + 0.008), now + 0.08);
    crowdBed.gain.linearRampToValueAtTime(crowdTargetGain, now + 0.7);
  }
  hushBus(crowdCheer, 0.05);
  hushBus(crowdGroan, 0.05);

  if (reaction === 'cheer') {
    const yes = [
      { delay: 0, f0: 168, f0End: 196, f1: 520, f2: 1840, f2Start: 2280, f3: 2550, gain: 0.055, s: 0.05 },
      { delay: 0.028, f0: 204, f0End: 232, f1: 560, f2: 1920, f2Start: 2360, f3: 2680, gain: 0.042, s: 0.04 },
      { delay: 0.052, f0: 146, f0End: 170, f1: 500, f2: 1760, f2Start: 2140, f3: 2460, gain: 0.038, s: 0.036 },
      { delay: 0.08, f0: 188, f0End: 210, f1: 540, f2: 1880, f2Start: 2220, f3: 2600, gain: 0.03, s: 0.03 },
      { delay: 0.11, f0: 224, f0End: 248, f1: 580, f2: 1980, f2Start: 2400, f3: 2720, gain: 0.024, s: 0.026 },
    ];
    for (const voice of yes) {
      shoutVoice(audio, now + voice.delay, {
        duration: 0.2,
        f0: voice.f0,
        f0End: voice.f0End,
        f1: voice.f1,
        f2: voice.f2,
        f2Start: voice.f2Start,
        f3: voice.f3,
        gain: voice.gain,
        breath: 0.012,
      });
      shoutSibilant(audio, now + voice.delay + 0.15, voice.s);
    }
    return;
  }

  const oh = [
    { delay: 0, f0: 162, f0End: 118, f1: 430, f2: 780, f3: 2480, gain: 0.05 },
    { delay: 0.04, f0: 148, f0End: 108, f1: 400, f2: 740, f3: 2360, gain: 0.038 },
    { delay: 0.07, f0: 186, f0End: 132, f1: 460, f2: 820, f3: 2600, gain: 0.032 },
    { delay: 0.11, f0: 136, f0End: 100, f1: 390, f2: 700, f3: 2280, gain: 0.026 },
  ];
  for (const voice of oh) {
    shoutVoice(audio, now + voice.delay, {
      duration: 0.42,
      f0: voice.f0,
      f0End: voice.f0End,
      f1: voice.f1,
      f2: voice.f2,
      f3: voice.f3,
      gain: voice.gain,
      breath: 0.02,
    });
  }
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
