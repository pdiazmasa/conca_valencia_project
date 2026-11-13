import type {
  Day3CheckIn,
  Day30CheckIn,
  SessionCheckIns,
  SessionRecord,
  StepProgressStatus,
} from "../data/types";
import { getTodayIsoDate } from "./dates";

export const SESSIONS_STORAGE_KEY = "samepage.sessions";
export const ACTIVE_STATE_STORAGE_KEY = "samepage.activeState";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStepProgressStatus(value: unknown): value is StepProgressStatus {
  return value === "done" || value === "started" || value === "not_yet";
}

export function normalizeCheckIns(raw: unknown): SessionCheckIns {
  try {
    if (!isPlainObject(raw)) {
      return {};
    }
    const result: SessionCheckIns = {};

    if (isPlainObject(raw.day3)) {
      const day3: Day3CheckIn = {
        responses: isPlainObject(raw.day3.responses)
          ? (raw.day3.responses as Day3CheckIn["responses"])
          : {},
      };
      if (typeof raw.day3.completedAt === "string") {
        day3.completedAt = raw.day3.completedAt;
      }
      result.day3 = day3;
    }

    if (isPlainObject(raw.day30)) {
      const day30: Day30CheckIn = {
        answers: isPlainObject(raw.day30.answers)
          ? (raw.day30.answers as Day30CheckIn["answers"])
          : {},
      };
      if (typeof raw.day30.completedAt === "string") {
        day30.completedAt = raw.day30.completedAt;
      }
      if (isStepProgressStatus(raw.day30.stepStatus)) {
        day30.stepStatus = raw.day30.stepStatus;
      }
      result.day30 = day30;
    }

    return result;
  } catch {
    return {};
  }
}

export function normalizeSession(raw: unknown): SessionRecord | null {
  try {
    if (!isPlainObject(raw)) return null;
    if (typeof raw.id !== "string" || typeof raw.familyId !== "string") {
      return null;
    }

    const base = raw as Partial<SessionRecord>;
    return {
      id: raw.id,
      familyId: raw.familyId,
      familyDisplayName:
        typeof base.familyDisplayName === "string"
          ? base.familyDisplayName
          : raw.familyId,
      createdAt: typeof base.createdAt === "string" ? base.createdAt : "",
      updatedAt: typeof base.updatedAt === "string" ? base.updatedAt : "",
      participants: Array.isArray(base.participants) ? base.participants : [],
      answers: isPlainObject(base.answers)
        ? (base.answers as SessionRecord["answers"])
        : {},
      otherPredictions: isPlainObject(base.otherPredictions)
        ? (base.otherPredictions as SessionRecord["otherPredictions"])
        : {},
      selectedRecommendationIds: Array.isArray(base.selectedRecommendationIds)
        ? base.selectedRecommendationIds
        : [],
      agreement: isPlainObject(base.agreement)
        ? (base.agreement as SessionRecord["agreement"])
        : undefined,
      checkIns: normalizeCheckIns(raw.checkIns),
    };
  } catch {
    return null;
  }
}

export function loadSessions(): SessionRecord[] {
  try {
    const raw = window.localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeSession(item))
      .filter((item): item is SessionRecord => item !== null);
  } catch {
    return [];
  }
}

export function upsertSession(session: SessionRecord): void {
  try {
    const normalized = normalizeSession(session) ?? {
      ...session,
      checkIns: normalizeCheckIns(session.checkIns),
    };
    const existing = loadSessions();
    const index = existing.findIndex((item) => item.id === normalized.id);
    const next = [...existing];
    if (index >= 0) {
      next[index] = normalized;
    } else {
      next.unshift(normalized);
    }
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function findLatestSessionWithAgreement(
  sessions: SessionRecord[],
  preferredFamilyId?: string
): SessionRecord | null {
  const withAgreement = sessions.filter((session) => Boolean(session.agreement));
  if (withAgreement.length === 0) {
    return null;
  }
  const sorted = [...withAgreement].sort((a, b) =>
    (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
  );
  if (preferredFamilyId) {
    const matchingFamily = sorted.find(
      (session) => session.familyId === preferredFamilyId
    );
    if (matchingFamily) {
      return matchingFamily;
    }
  }
  return sorted[0];
}

export function getAdvisorExportFilename(
  session: SessionRecord,
  date: string = getTodayIsoDate()
): string {
  const familySlug =
    session.familyId
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "family";
  return `same-page-${familySlug}-${date}.json`;
}

export function buildAdvisorExportPayload(session: SessionRecord): string {
  return JSON.stringify(session, null, 2);
}

export function downloadSessionJson(session: SessionRecord): void {
  const json = buildAdvisorExportPayload(session);
  const filename = getAdvisorExportFilename(session);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }, 1000);
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
