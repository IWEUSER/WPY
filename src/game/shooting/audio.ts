/** Small synthesized sound-effect engine (no external audio assets required). */

import type { CrowdBedLevel } from './chanceAtmosphere';

export type { CrowdBedLevel };

let ctx: AudioContext | null = null;
let muted = false;
let crowdGain: GainNode | null = null;
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
  let gain = 0.042;
  if (level.home) gain += 0.016;
  if (level.night) gain += 0.012;
  if (level.cup) gain += 0.014;
  if (level.final) gain += 0.02;
  if (level.lastChance) gain += 0.01;
  if (level.penalty) gain += 0.012;
  if (level.crowdFill === 'sparse') gain *= 0.42;
  if (level.crowdFill === 'empty') gain *= 0.1;
  return gain;
}

function brownNoiseBuffer(audio: AudioContext, seconds = 3.2): AudioBuffer {
  const frames = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    data[i] = brown * 3.2 + white * 0.06;
  }
  return buffer;
}

function ensureCrowd(audio: AudioContext): GainNode {
  if (crowdGain && crowdStarted) return crowdGain;
  const output = crowdGain ?? audio.createGain();
  output.gain.value = 0.0001;
  if (!crowdGain) output.connect(audio.destination);
  crowdGain = output;
  if (crowdStarted) return output;

  const noise = audio.createBufferSource();
  noise.buffer = brownNoiseBuffer(audio);
  noise.loop = true;
  const wash = audio.createBiquadFilter();
  wash.type = 'lowpass';
  wash.frequency.value = 720;
  wash.Q.value = 0.7;
  const presence = audio.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 980;
  presence.gain.value = 4.5;
  presence.Q.value = 0.8;
  const noiseGain = audio.createGain();
  noiseGain.gain.value = 0.9;
  noise.connect(wash);
  wash.connect(presence);
  presence.connect(noiseGain);
  noiseGain.connect(output);
  noise.start();

  const rumble = audio.createOscillator();
  rumble.type = 'sine';
  rumble.frequency.value = 58;
  const rumble2 = audio.createOscillator();
  rumble2.type = 'triangle';
  rumble2.frequency.value = 73;
  const rumbleGain = audio.createGain();
  rumbleGain.gain.value = 0.045;
  rumble.connect(rumbleGain);
  rumble2.connect(rumbleGain);
  rumbleGain.connect(output);
  rumble.start();
  rumble2.start();

  crowdStarted = true;
  return output;
}

function rampCrowdTo(value: number, seconds: number): void {
  const audio = getCtx();
  if (!audio || !crowdGain) return;
  const now = audio.currentTime;
  crowdGain.gain.cancelScheduledValues(now);
  crowdGain.gain.setValueAtTime(Math.max(0.0001, crowdGain.gain.value), now);
  crowdGain.gain.linearRampToValueAtTime(Math.max(0.0001, value), now + seconds);
}

function hushCrowd(seconds: number): void {
  if (!crowdGain) return;
  rampCrowdTo(0.0001, seconds);
}

/** Continuous stadium wash under a chance. Louder at home, at night, and in cups. */
export function startCrowdBed(level: CrowdBedLevel = {}): void {
  if (muted) return;
  const audio = getCtx();
  if (!audio) return;
  const output = ensureCrowd(audio);
  crowdTargetGain = crowdBaseGain(level);
  const now = audio.currentTime;
  output.gain.cancelScheduledValues(now);
  output.gain.setValueAtTime(Math.max(0.0001, output.gain.value), now);
  output.gain.linearRampToValueAtTime(crowdTargetGain, now + 0.55);
}

export function swellCrowd(kind: 'goal' | 'miss' | 'save' | 'post' | 'block'): void {
  if (muted || !crowdGain) return;
  const audio = getCtx();
  if (!audio) return;
  const peak =
    kind === 'goal' ? crowdTargetGain * 2.4
    : kind === 'miss' ? crowdTargetGain * 1.85
    : kind === 'post' ? crowdTargetGain * 1.7
    : kind === 'block' ? crowdTargetGain * 1.35
    : crowdTargetGain * 1.2;
  const now = audio.currentTime;
  crowdGain.gain.cancelScheduledValues(now);
  crowdGain.gain.setValueAtTime(Math.max(0.0001, crowdGain.gain.value), now);
  crowdGain.gain.linearRampToValueAtTime(Math.max(crowdTargetGain, peak), now + 0.12);
  crowdGain.gain.linearRampToValueAtTime(crowdTargetGain, now + (kind === 'goal' ? 1.6 : 0.9));
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
  tone(1400, 0.35, { type: 'square', startGain: 0.22, freqEnd: 900 });
  tone(2100, 0.25, { type: 'sine', startGain: 0.15, delaySec: 0.02 });
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
