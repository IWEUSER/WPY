/** Small synthesized sound-effect engine (no external audio assets required). */

let ctx: AudioContext | null = null;
let muted = false;

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

export function playKick(power: number): void {
  noiseBurst(0.08, { startGain: 0.3 + power * 0.1, filterFreq: 2200 });
  tone(140, 0.09, { type: 'triangle', startGain: 0.22, freqEnd: 60 });
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

export function playWhistle(): void {
  tone(1800, 0.5, { type: 'square', startGain: 0.12, freqEnd: 1500 });
}
