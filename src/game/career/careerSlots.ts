import { getClub } from './data/clubs';
import { displaySeasonLabel } from './seasonDisplay';
import type { CareerState } from './types';

export const CAREER_SLOTS_KEY = 'wpy-career-slots-v1';
export const MAX_CAREER_SLOTS = 12;

export type SlotStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export interface CareerSlotMeta {
  id: string;
  savedAt: number;
  playerName: string;
  clubId: string | null;
  clubName: string;
  seasonNumber: number;
  seasonLabel: string;
  role: CareerState['role'];
  nationality: string | null;
  openingLabel: string | null;
}

export interface CareerSlot extends CareerSlotMeta {
  state: CareerState;
}

export function memorySlotStorage(): SlotStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

let fallbackStorage: SlotStorage | null = null;

function defaultSlotStorage(): SlotStorage {
  if (typeof localStorage !== 'undefined') return localStorage;
  fallbackStorage ??= memorySlotStorage();
  return fallbackStorage;
}

let slotStorage: SlotStorage = defaultSlotStorage();

export function useCareerSlotStorage(storage: SlotStorage): void {
  slotStorage = storage;
}

export function careerHasProgress(state: Partial<CareerState> | null | undefined): boolean {
  if (!state) return false;
  if (state.clubId) return true;
  if (state.openingCampaign) return true;
  if ((state.seasonHistory?.length ?? 0) > 0) return true;
  if (state.nationality) return true;
  if (state.careerStart && state.phase && state.phase !== 'menu') return true;
  return false;
}

export function careerSlotLabel(slot: CareerSlotMeta): string {
  const name = slot.playerName.trim() || 'Player';
  const club = slot.clubName || slot.openingLabel || 'No club';
  return `${name} · ${slot.seasonLabel} · ${club}`;
}

export function describeCareerSlot(state: CareerState, id: string, savedAt = Date.now()): CareerSlotMeta {
  const club = state.clubId ? getClub(state.clubId) : undefined;
  const opening = state.openingCampaign;
  const openingLabel = opening
    ? opening.kind === 'youth-tournament'
      ? opening.youthName ?? 'Youth tournament'
      : club?.name ?? 'Club trial'
    : null;
  return {
    id,
    savedAt,
    playerName: state.playerName?.trim() || 'Player',
    clubId: state.clubId,
    clubName: club?.name ?? '',
    seasonNumber: state.seasonNumber,
    seasonLabel: displaySeasonLabel(state.seasonNumber, {
      role: state.role,
      careerStart: state.careerStart,
    }),
    role: state.role,
    nationality: state.nationality ?? null,
    openingLabel,
  };
}

function readLibrary(storage: SlotStorage = slotStorage): CareerSlot[] {
  try {
    const raw = storage.getItem(CAREER_SLOTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CareerSlot[];
    return Array.isArray(parsed) ? parsed.filter((slot) => slot && slot.id && slot.state) : [];
  } catch {
    return [];
  }
}

function writeLibrary(slots: CareerSlot[], storage: SlotStorage = slotStorage): void {
  storage.setItem(CAREER_SLOTS_KEY, JSON.stringify(slots));
}

export function listCareerSlots(storage: SlotStorage = slotStorage): CareerSlotMeta[] {
  return readLibrary(storage)
    .map(({ state: _state, ...meta }) => meta)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function readCareerSlot(id: string, storage: SlotStorage = slotStorage): CareerSlot | null {
  return readLibrary(storage).find((slot) => slot.id === id) ?? null;
}

export function removeCareerSlot(id: string, storage: SlotStorage = slotStorage): void {
  writeLibrary(readLibrary(storage).filter((slot) => slot.id !== id), storage);
}

export function upsertCareerSlot(state: CareerState, storage: SlotStorage = slotStorage): CareerSlot {
  const slots = readLibrary(storage);
  const existing = state.careerSlotId ? slots.find((slot) => slot.id === state.careerSlotId) : undefined;
  const id = existing?.id ?? `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const meta = describeCareerSlot({ ...state, careerSlotId: id }, id);
  const next: CareerSlot = {
    ...meta,
    state: { ...state, careerSlotId: id },
  };
  const others = slots.filter((slot) => slot.id !== id);
  if (!existing && others.length >= MAX_CAREER_SLOTS) {
    others.sort((a, b) => a.savedAt - b.savedAt);
    others.shift();
  }
  writeLibrary([next, ...others], storage);
  return next;
}
