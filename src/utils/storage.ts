import type { SessionRecord } from "../data/types";

export const SESSIONS_STORAGE_KEY = "samepage.sessions";
export const ACTIVE_STATE_STORAGE_KEY = "samepage.activeState";

export function loadSessions(): SessionRecord[] {
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function upsertSession(session: SessionRecord): void {
  try {
    const existing = loadSessions();
    const index = existing.findIndex((item) => item.id === session.id);
    const next = [...existing];
    if (index >= 0) {
      next[index] = session;
    } else {
      next.unshift(session);
    }
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function loadActiveState<T>(): T | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_STATE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveActiveState<T>(state: T): void {
  try {
    window.localStorage.setItem(ACTIVE_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function clearActiveState(): void {
  try {
    window.localStorage.removeItem(ACTIVE_STATE_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted environments
  }
}
