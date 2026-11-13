import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionRecord } from "../data/types";
import {
  buildAdvisorExportPayload,
  downloadSessionJson,
  findLatestSessionWithAgreement,
  getAdvisorExportFilename,
  loadSessions,
  SESSIONS_STORAGE_KEY,
  upsertSession,
} from "./storage";

describe("Session storage, backwards compatibility, and advisor export", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads old stored sessions without checkIns and provides defaults", () => {
    const legacySession = {
      id: "legacy-1",
      familyId: "weah",
      familyDisplayName: "Weah family",
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:05:00.000Z",
      participants: [
        { id: "person-1", name: "Timothy" },
        { id: "person-2", name: "Melanie" },
      ],
      answers: {
        "person-1": { card_interest: { value: 600, confidence: 3 } },
      },
      otherPredictions: {},
      selectedRecommendationIds: ["pay_card"],
      agreement: {
        recommendationId: "pay_card",
        recommendationLabel: "Pay off the credit card with cash",
        targetDate: "2026-09-08",
        agreedDate: "2026-09-01",
        checkInDay3: "2026-09-04",
        checkInDay30: "2026-10-01",
        agreedParticipantIds: ["person-1", "person-2"],
      },
    };

    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify([legacySession])
    );

    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("legacy-1");
    expect(loaded[0].checkIns).toEqual({});
    expect(loaded[0].agreement?.recommendationLabel).toBe(
      "Pay off the credit card with cash"
    );
  });

  it("recovers cleanly from invalid JSON or malformed entries in localStorage", () => {
    window.localStorage.setItem(SESSIONS_STORAGE_KEY, "{not-valid-json");
    expect(loadSessions()).toEqual([]);

    window.localStorage.setItem(
      SESSIONS_STORAGE_KEY,
      JSON.stringify([null, { foo: "bar" }, { id: "ok", familyId: "lewis" }])
    );
    const loaded = loadSessions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      id: "ok",
      familyId: "lewis",
      participants: [],
      answers: {},
      checkIns: {},
    });
  });

  it("persists Day 3 blocker reason and note and Day 30 check-in data", () => {
    const session: SessionRecord = {
      id: "s-day3",
      familyId: "weah",
      familyDisplayName: "Weah family",
      createdAt: "2026-11-01T10:00:00.000Z",
      updatedAt: "2026-11-04T10:00:00.000Z",
      participants: [
        { id: "person-1", name: "Timothy" },
        { id: "person-2", name: "Melanie" },
      ],
      answers: {},
      otherPredictions: {},
      selectedRecommendationIds: ["pay_card"],
      agreement: {
        recommendationId: "pay_card",
        recommendationLabel: "Pay off the credit card with cash",
        targetDate: "2026-11-08",
        agreedDate: "2026-11-01",
        checkInDay3: "2026-11-04",
        checkInDay30: "2026-12-01",
        agreedParticipantIds: ["person-1", "person-2"],
      },
      checkIns: {
        day3: {
          completedAt: "2026-11-04T10:00:00.000Z",
          responses: {
            "person-1": { status: "started" },
            "person-2": {
              status: "not_yet",
              blockerReason: "not_sure_how",
              blockerNote: "Need login details",
            },
          },
        },
      },
    };

    upsertSession(session);
    const reloaded = loadSessions();
    expect(reloaded[0].checkIns.day3?.responses["person-2"]).toEqual({
      status: "not_yet",
      blockerReason: "not_sure_how",
      blockerNote: "Need login details",
    });

    expect(findLatestSessionWithAgreement(reloaded, "weah")?.id).toBe("s-day3");
  });

  it("formats export filename and triggers Blob download without network", () => {
    const session: SessionRecord = {
      id: "s-export",
      familyId: "weah",
      familyDisplayName: "Weah family",
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      participants: [{ id: "person-1", name: "Timothy" }],
      answers: {},
      otherPredictions: {},
      selectedRecommendationIds: [],
      checkIns: {},
    };

    expect(getAdvisorExportFilename(session, "2026-11-13")).toBe(
      "same-page-weah-2026-11-13.json"
    );
    expect(JSON.parse(buildAdvisorExportPayload(session))).toEqual(session);

    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    const createObjectUrlMock = vi.fn().mockReturnValue("blob:mock-session");
    const revokeObjectUrlMock = vi.fn();
    URL.createObjectURL = createObjectUrlMock;
    URL.revokeObjectURL = revokeObjectUrlMock;

    try {
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});

      let capturedDownload = "";
      const appendSpy = vi
        .spyOn(document.body, "appendChild")
        .mockImplementation((node: Node) => {
          if (node instanceof HTMLAnchorElement) {
            capturedDownload = node.download;
          }
          return node;
        });
      vi.spyOn(document.body, "removeChild").mockImplementation((node: Node) => node);

      vi.useFakeTimers();
      downloadSessionJson(session);

      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(capturedDownload).toMatch(/^same-page-weah-\d{4}-\d{2}-\d{2}\.json$/);
      expect(clickSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000);
      expect(revokeObjectUrlMock).toHaveBeenCalledWith("blob:mock-session");
      vi.useRealTimers();
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });
});
