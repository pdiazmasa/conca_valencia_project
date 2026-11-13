import { useEffect, useState } from "react";
import { FAMILIES, getFamilyById } from "./data";
import type {
  AgreementRecord,
  Confidence,
  Day3BlockerReason,
  Day3PersonResponse,
  Family,
  Participant,
  QuestionAnswer,
  SessionRecord,
  StepProgressStatus,
} from "./data/types";
import { AdvisorScreen } from "./screens/AdvisorScreen";
import { AgreementScreen } from "./screens/AgreementScreen";
import {
  Day3BlockerScreen,
  Day3StatusScreen,
  Day3SummaryScreen,
} from "./screens/Day3CheckInScreens";
import {
  Day30RevealScreen,
  Day30StepScreen,
  Day30SummaryScreen,
} from "./screens/Day30CheckInScreens";
import { GuessOtherScreen } from "./screens/GuessOtherScreen";
import { GuessScreen } from "./screens/GuessScreen";
import { HandoffScreen } from "./screens/HandoffScreen";
import { RevealScreen } from "./screens/RevealScreen";
import { StartScreen } from "./screens/StartScreen";
import { StepsScreen } from "./screens/StepsScreen";
import { addDaysToIsoDate, getTodayIsoDate } from "./utils/dates";
import { getSelectedIdsForStepCount } from "./utils/planLogic";
import { stopSpeech } from "./utils/speech";
import {
  clearActiveState,
  findLatestSessionWithAgreement,
  loadActiveState,
  loadSessions,
  normalizeSession,
  saveActiveState,
  upsertSession,
} from "./utils/storage";

type ScreenState =
  | { screen: "start" }
  | { screen: "handoff"; personIndex: number }
  | { screen: "guess"; personIndex: number; questionIndex: number }
  | { screen: "guess_other"; personIndex: number; targetIndex: number }
  | { screen: "reveal"; questionIndex: number }
  | { screen: "steps" }
  | { screen: "agreement" }
  | { screen: "day3_handoff"; personIndex: number }
  | { screen: "day3_status"; personIndex: number }
  | { screen: "day3_blocker"; personIndex: number }
  | { screen: "day3_summary" }
  | { screen: "day30_handoff"; personIndex: number }
  | { screen: "day30_guess"; personIndex: number; questionIndex: number }
  | { screen: "day30_reveal"; questionIndex: number }
  | { screen: "day30_step" }
  | { screen: "day30_summary" }
  | {
      screen: "advisor";
      returnTo: "start" | "agreement" | "day3_summary" | "day30_summary";
    };

type AppState = {
  screenState: ScreenState;
  draftFamilyId: string;
  draftPeopleCount: number;
  draftNames: string[];
  session: SessionRecord | null;
  agreementChoiceId: string;
  agreementDate: string;
  agreedIds: string[];
  draftDay3Responses: Record<string, Day3PersonResponse>;
  draftDay30Answers: Record<string, Record<string, QuestionAnswer>>;
};

function defaultNamesForFamily(family: Family, count: number): string[] {
  return Array.from({ length: 4 }, (_, idx) => {
    if (idx < family.members.length) {
      return family.members[idx].name;
    }
    return `Person ${idx + 1}`;
  }).slice(0, Math.max(4, count));
}

function createInitialState(): AppState {
  const defaultFamily = FAMILIES[0];
  return {
    screenState: { screen: "start" },
    draftFamilyId: defaultFamily.id,
    draftPeopleCount: defaultFamily.members.length,
    draftNames: defaultNamesForFamily(defaultFamily, 4),
    session: null,
    agreementChoiceId: defaultFamily.recommendations[0]?.id ?? "",
    agreementDate: addDaysToIsoDate(getTodayIsoDate(), 7),
    agreedIds: [],
    draftDay3Responses: {},
    draftDay30Answers: {},
  };
}

function loadInitialState(): AppState {
  const saved = loadActiveState<Partial<AppState>>();
  if (
    !saved ||
    !saved.screenState ||
    !saved.draftFamilyId ||
    !getFamilyById(saved.draftFamilyId)
  ) {
    return createInitialState();
  }
  const normalizedSession = saved.session
    ? normalizeSession(saved.session)
    : null;
  if (
    saved.screenState.screen !== "start" &&
    saved.screenState.screen !== "advisor" &&
    !normalizedSession
  ) {
    return createInitialState();
  }
  const isCheckInScreen =
    saved.screenState.screen.startsWith("day3_") ||
    saved.screenState.screen.startsWith("day30_");
  if (isCheckInScreen && !normalizedSession?.agreement) {
    return createInitialState();
  }

  return {
    ...createInitialState(),
    ...saved,
    screenState: saved.screenState,
    session: normalizedSession,
    draftDay3Responses: saved.draftDay3Responses ?? {},
    draftDay30Answers: saved.draftDay30Answers ?? {},
  };
}

function findNextOtherTarget(
  personIndex: number,
  afterIndex: number,
  totalPeople: number
): number | null {
  for (let i = afterIndex + 1; i < totalPeople; i += 1) {
    if (i !== personIndex) {
      return i;
    }
  }
  return null;
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadInitialState());

  useEffect(() => {
    saveActiveState(state);
  }, [state]);

  const activeFamily =
    (state.session ? getFamilyById(state.session.familyId) : undefined) ??
    getFamilyById(state.draftFamilyId) ??
    FAMILIES[0];

  function handleStartOver() {
    stopSpeech();
    clearActiveState();
    setState(createInitialState());
  }

  function handleSelectFamily(familyId: string) {
    const family = getFamilyById(familyId);
    if (!family) return;
    setState((prev) => ({
      ...prev,
      draftFamilyId: family.id,
      draftPeopleCount: family.members.length,
      draftNames: defaultNamesForFamily(family, 4),
      agreementChoiceId: family.recommendations[0]?.id ?? "",
    }));
  }

  function handleChangePeopleCount(count: number) {
    setState((prev) => ({
      ...prev,
      draftPeopleCount: count,
    }));
  }

  function handleChangeName(index: number, name: string) {
    setState((prev) => {
      const nextNames = [...prev.draftNames];
      nextNames[index] = name;
      return { ...prev, draftNames: nextNames };
    });
  }

  function handleBegin() {
    const family = getFamilyById(state.draftFamilyId) ?? FAMILIES[0];
    const participants: Participant[] = Array.from(
      { length: state.draftPeopleCount },
      (_, idx) => {
        const trimmed = (state.draftNames[idx] ?? "").trim();
        const fallback =
          idx < family.members.length
            ? family.members[idx].name
            : `Person ${idx + 1}`;
        return {
          id: `person-${idx + 1}`,
          name: trimmed || fallback,
        };
      }
    );

    const now = new Date().toISOString();
    const newSession: SessionRecord = {
      id: createSessionId(),
      familyId: family.id,
      familyDisplayName: family.displayName,
      createdAt: now,
      updatedAt: now,
      participants,
      answers: {},
      otherPredictions: {},
      selectedRecommendationIds: [],
      checkIns: {},
    };

    setState((prev) => ({
      ...prev,
      session: newSession,
      agreementChoiceId: family.recommendations[0]?.id ?? "",
      agreementDate: addDaysToIsoDate(getTodayIsoDate(), 7),
      agreedIds: [],
      draftDay3Responses: {},
      draftDay30Answers: {},
      screenState: { screen: "handoff", personIndex: 0 },
    }));
  }

  function handleStartTurn(personIndex: number) {
    setState((prev) => ({
      ...prev,
      screenState: { screen: "guess", personIndex, questionIndex: 0 },
    }));
  }

  function handleSubmitGuess(
    personIndex: number,
    questionIndex: number,
    value: number,
    confidence: Confidence
  ) {
    setState((prev) => {
      if (!prev.session) return prev;
      const family = getFamilyById(prev.session.familyId);
      if (!family) return prev;

      const participant = prev.session.participants[personIndex];
      const question = family.questions[questionIndex];
      if (!participant || !question) return prev;

      const updatedSession: SessionRecord = {
        ...prev.session,
        updatedAt: new Date().toISOString(),
        answers: {
          ...prev.session.answers,
          [participant.id]: {
            ...(prev.session.answers[participant.id] ?? {}),
            [question.id]: { value, confidence },
          },
        },
      };

      const nextQuestionIndex = questionIndex + 1;
      if (nextQuestionIndex < family.questions.length) {
        return {
          ...prev,
          session: updatedSession,
          screenState: {
            screen: "guess",
            personIndex,
            questionIndex: nextQuestionIndex,
          },
        };
      }

      const totalPeople = updatedSession.participants.length;
      if (totalPeople >= 2) {
        const firstOther = findNextOtherTarget(personIndex, -1, totalPeople);
        if (firstOther !== null) {
          return {
            ...prev,
            session: updatedSession,
            screenState: {
              screen: "guess_other",
              personIndex,
              targetIndex: firstOther,
            },
          };
        }
      }

      const nextPerson = personIndex + 1;
      if (nextPerson < totalPeople) {
        return {
          ...prev,
          session: updatedSession,
          screenState: { screen: "handoff", personIndex: nextPerson },
        };
      }

      upsertSession(updatedSession);
      return {
        ...prev,
        session: updatedSession,
        screenState: { screen: "reveal", questionIndex: 0 },
      };
    });
  }

  function handleSubmitGuessOther(
    personIndex: number,
    targetIndex: number,
    value: number
  ) {
    setState((prev) => {
      if (!prev.session) return prev;
      const predictor = prev.session.participants[personIndex];
      const target = prev.session.participants[targetIndex];
      if (!predictor || !target) return prev;

      const updatedSession: SessionRecord = {
        ...prev.session,
        updatedAt: new Date().toISOString(),
        otherPredictions: {
          ...prev.session.otherPredictions,
          [predictor.id]: {
            ...(prev.session.otherPredictions[predictor.id] ?? {}),
            [target.id]: value,
          },
        },
      };

      const totalPeople = updatedSession.participants.length;
      const nextTarget = findNextOtherTarget(
        personIndex,
        targetIndex,
        totalPeople
      );
      if (nextTarget !== null) {
        return {
          ...prev,
          session: updatedSession,
          screenState: {
            screen: "guess_other",
            personIndex,
            targetIndex: nextTarget,
          },
        };
      }

      const nextPerson = personIndex + 1;
      if (nextPerson < totalPeople) {
        return {
          ...prev,
          session: updatedSession,
          screenState: { screen: "handoff", personIndex: nextPerson },
        };
      }

      upsertSession(updatedSession);
      return {
        ...prev,
        session: updatedSession,
        screenState: { screen: "reveal", questionIndex: 0 },
      };
    });
  }

  function handleNextReveal(questionIndex: number) {
    stopSpeech();
    setState((prev) => {
      if (!prev.session) return prev;
      const family = getFamilyById(prev.session.familyId);
      if (!family) return prev;

      if (questionIndex + 1 < family.questions.length) {
        return {
          ...prev,
          screenState: { screen: "reveal", questionIndex: questionIndex + 1 },
        };
      }
      return {
        ...prev,
        screenState: { screen: "steps" },
      };
    });
  }

  function handleSetStepCount(stepCount: number) {
    setState((prev) => {
      if (!prev.session) return prev;
      const family = getFamilyById(prev.session.familyId);
      if (!family) return prev;

      const nextSelected = getSelectedIdsForStepCount(family, stepCount);
      const updatedSession: SessionRecord = {
        ...prev.session,
        updatedAt: new Date().toISOString(),
        selectedRecommendationIds: nextSelected,
      };
      upsertSession(updatedSession);

      return {
        ...prev,
        session: updatedSession,
      };
    });
  }

  function handleContinueToAgreement() {
    setState((prev) => {
      if (!prev.session) return prev;
      const family = getFamilyById(prev.session.familyId);
      if (!family) return prev;

      const defaultChoice =
        prev.session.selectedRecommendationIds[0] ??
        family.recommendations[0]?.id ??
        "";

      return {
        ...prev,
        agreementChoiceId: prev.agreementChoiceId || defaultChoice,
        screenState: { screen: "agreement" },
      };
    });
  }

  function handleSelectAgreementRecommendation(recommendationId: string) {
    setState((prev) => ({
      ...prev,
      agreementChoiceId: recommendationId,
      agreedIds: [],
    }));
  }

  function handleChangeAgreementDate(date: string) {
    setState((prev) => ({
      ...prev,
      agreementDate: date,
      agreedIds: [],
    }));
  }

  function handleToggleAgree(participantId: string) {
    setState((prev) => {
      if (!prev.session) return prev;
      const family = getFamilyById(prev.session.familyId);
      if (!family) return prev;

      const exists = prev.agreedIds.includes(participantId);
      const nextAgreed = exists
        ? prev.agreedIds.filter((id) => id !== participantId)
        : [...prev.agreedIds, participantId];

      const everyoneAgreed = prev.session.participants.every((p) =>
        nextAgreed.includes(p.id)
      );

      if (!everyoneAgreed) {
        return { ...prev, agreedIds: nextAgreed };
      }

      const chosenRec =
        family.recommendations.find((r) => r.id === prev.agreementChoiceId) ??
        family.recommendations[0];
      const agreedDate = getTodayIsoDate();
      const targetDate = prev.agreementDate || addDaysToIsoDate(agreedDate, 7);

      const agreement: AgreementRecord = {
        recommendationId: chosenRec.id,
        recommendationLabel: chosenRec.label,
        targetDate,
        agreedDate,
        checkInDay3: addDaysToIsoDate(agreedDate, 3),
        checkInDay30: addDaysToIsoDate(agreedDate, 30),
        agreedParticipantIds: nextAgreed,
      };

      const updatedSession: SessionRecord = {
        ...prev.session,
        updatedAt: new Date().toISOString(),
        agreement,
      };
      upsertSession(updatedSession);

      return {
        ...prev,
        agreedIds: nextAgreed,
        session: updatedSession,
      };
    });
  }

  function handleResetAgreement() {
    stopSpeech();
    setState((prev) => {
      if (!prev.session) return prev;
      const updatedSession: SessionRecord = {
        ...prev.session,
        agreement: undefined,
      };
      upsertSession(updatedSession);
      return {
        ...prev,
        agreedIds: [],
        session: updatedSession,
      };
    });
  }

  function handleOpenDay3(targetSession?: SessionRecord) {
    stopSpeech();
    setState((prev) => {
      const source = targetSession ?? prev.session;
      if (!source || !source.agreement) return prev;
      const normalized = normalizeSession(source) ?? source;
      return {
        ...prev,
        session: normalized,
        draftDay3Responses: {},
        screenState: { screen: "day3_handoff", personIndex: 0 },
      };
    });
  }

  function handleOpenDay30(targetSession?: SessionRecord) {
    stopSpeech();
    setState((prev) => {
      const source = targetSession ?? prev.session;
      if (!source || !source.agreement) return prev;
      const normalized = normalizeSession(source) ?? source;
      return {
        ...prev,
        session: normalized,
        draftDay30Answers: {},
        screenState: { screen: "day30_handoff", personIndex: 0 },
      };
    });
  }

  function handleDay3SelectStatus(
    personIndex: number,
    status: StepProgressStatus
  ) {
    setState((prev) => {
      if (!prev.session) return prev;
      const person = prev.session.participants[personIndex];
      if (!person) return prev;

      if (status === "not_yet") {
        const existing = prev.draftDay3Responses[person.id];
        return {
          ...prev,
          draftDay3Responses: {
            ...prev.draftDay3Responses,
            [person.id]: {
              status: "not_yet",
              blockerReason: existing?.blockerReason,
              blockerNote: existing?.blockerNote,
            },
          },
          screenState: { screen: "day3_blocker", personIndex },
        };
      }

      const nextResponses: Record<string, Day3PersonResponse> = {
        ...prev.draftDay3Responses,
        [person.id]: { status },
      };

      const nextPerson = personIndex + 1;
      if (nextPerson < prev.session.participants.length) {
        return {
          ...prev,
          draftDay3Responses: nextResponses,
          screenState: { screen: "day3_handoff", personIndex: nextPerson },
        };
      }

      const now = new Date().toISOString();
      const updatedSession: SessionRecord = {
        ...prev.session,
        updatedAt: now,
        checkIns: {
          ...(prev.session.checkIns ?? {}),
          day3: {
            completedAt: now,
            responses: nextResponses,
          },
        },
      };
      upsertSession(updatedSession);

      return {
        ...prev,
        session: updatedSession,
        draftDay3Responses: nextResponses,
        screenState: { screen: "day3_summary" },
      };
    });
  }

  function handleDay3SubmitBlocker(
    personIndex: number,
    reason: Day3BlockerReason,
    note?: string
  ) {
    setState((prev) => {
      if (!prev.session) return prev;
      const person = prev.session.participants[personIndex];
      if (!person) return prev;

      const nextResponses: Record<string, Day3PersonResponse> = {
        ...prev.draftDay3Responses,
        [person.id]: {
          status: "not_yet",
          blockerReason: reason,
          ...(note ? { blockerNote: note } : {}),
        },
      };

      const nextPerson = personIndex + 1;
      if (nextPerson < prev.session.participants.length) {
        return {
          ...prev,
          draftDay3Responses: nextResponses,
          screenState: { screen: "day3_handoff", personIndex: nextPerson },
        };
      }

      const now = new Date().toISOString();
      const updatedSession: SessionRecord = {
        ...prev.session,
        updatedAt: now,
        checkIns: {
          ...(prev.session.checkIns ?? {}),
          day3: {
            completedAt: now,
            responses: nextResponses,
          },
        },
      };
      upsertSession(updatedSession);

      return {
        ...prev,
        session: updatedSession,
        draftDay3Responses: nextResponses,
        screenState: { screen: "day3_summary" },
      };
    });
  }

  function handleDay30SubmitGuess(
    personIndex: number,
    questionIndex: number,
    value: number,
    confidence: Confidence
  ) {
    setState((prev) => {
      if (!prev.session) return prev;
      const family = getFamilyById(prev.session.familyId);
      if (!family) return prev;

      const participant = prev.session.participants[personIndex];
      const question = family.questions[questionIndex];
      if (!participant || !question) return prev;

      const nextAnswers: Record<string, Record<string, QuestionAnswer>> = {
        ...prev.draftDay30Answers,
        [participant.id]: {
          ...(prev.draftDay30Answers[participant.id] ?? {}),
          [question.id]: { value, confidence },
        },
      };

      const nextQuestionIndex = questionIndex + 1;
      if (nextQuestionIndex < family.questions.length) {
        return {
          ...prev,
          draftDay30Answers: nextAnswers,
          screenState: {
            screen: "day30_guess",
            personIndex,
            questionIndex: nextQuestionIndex,
          },
        };
      }

      const nextPerson = personIndex + 1;
      if (nextPerson < prev.session.participants.length) {
        return {
          ...prev,
          draftDay30Answers: nextAnswers,
          screenState: { screen: "day30_handoff", personIndex: nextPerson },
        };
      }

      const now = new Date().toISOString();
      const updatedSession: SessionRecord = {
        ...prev.session,
        updatedAt: now,
        checkIns: {
          ...(prev.session.checkIns ?? {}),
          day30: {
            ...(prev.session.checkIns?.day30 ?? {}),
            completedAt: now,
            answers: nextAnswers,
          },
        },
      };
      upsertSession(updatedSession);

      return {
        ...prev,
        session: updatedSession,
        draftDay30Answers: nextAnswers,
        screenState: { screen: "day30_reveal", questionIndex: 0 },
      };
    });
  }

  function handleDay30NextReveal(questionIndex: number) {
    stopSpeech();
    setState((prev) => {
      if (!prev.session) return prev;
      const family = getFamilyById(prev.session.familyId);
      if (!family) return prev;

      if (questionIndex + 1 < family.questions.length) {
        return {
          ...prev,
          screenState: {
            screen: "day30_reveal",
            questionIndex: questionIndex + 1,
          },
        };
      }
      return {
        ...prev,
        screenState: { screen: "day30_step" },
      };
    });
  }

  function handleDay30SelectStepStatus(status: StepProgressStatus) {
    setState((prev) => {
      if (!prev.session) return prev;
      const now = new Date().toISOString();
      const existingDay30 = prev.session.checkIns?.day30;
      const updatedSession: SessionRecord = {
        ...prev.session,
        updatedAt: now,
        checkIns: {
          ...(prev.session.checkIns ?? {}),
          day30: {
            completedAt: now,
            answers: existingDay30?.answers ?? prev.draftDay30Answers,
            stepStatus: status,
          },
        },
      };
      upsertSession(updatedSession);

      return {
        ...prev,
        session: updatedSession,
        screenState: { screen: "day30_summary" },
      };
    });
  }

  function renderScreen() {
    const { screenState, session } = state;

    if (screenState.screen === "start") {
      const checkInSession = state.session?.agreement
        ? state.session
        : findLatestSessionWithAgreement(loadSessions(), state.draftFamilyId);

      return (
        <StartScreen
          families={FAMILIES}
          selectedFamilyId={state.draftFamilyId}
          peopleCount={state.draftPeopleCount}
          participantNames={state.draftNames}
          checkInSession={checkInSession}
          onSelectFamily={handleSelectFamily}
          onChangePeopleCount={handleChangePeopleCount}
          onChangeName={handleChangeName}
          onBegin={handleBegin}
          onOpenAdvisor={() =>
            setState((prev) => ({
              ...prev,
              screenState: { screen: "advisor", returnTo: "start" },
            }))
          }
          onOpenDay3={handleOpenDay3}
          onOpenDay30={handleOpenDay30}
        />
      );
    }

    if (screenState.screen === "advisor") {
      return (
        <AdvisorScreen
          onBack={() =>
            setState((prev) => ({
              ...prev,
              screenState: { screen: screenState.returnTo },
            }))
          }
        />
      );
    }

    if (!session) {
      return null;
    }

    const family = getFamilyById(session.familyId);
    if (!family) return null;

    switch (screenState.screen) {
      case "handoff": {
        const person = session.participants[screenState.personIndex];
        return (
          <HandoffScreen
            participantName={person.name}
            onStartTurn={() => handleStartTurn(screenState.personIndex)}
          />
        );
      }

      case "guess": {
        const person = session.participants[screenState.personIndex];
        const question = family.questions[screenState.questionIndex];
        const existing = session.answers[person.id]?.[question.id];
        return (
          <GuessScreen
            key={`${person.id}-${question.id}`}
            family={family}
            participantName={person.name}
            question={question}
            questionNumber={screenState.questionIndex + 1}
            totalQuestions={family.questions.length}
            initialValue={existing?.value}
            initialConfidence={existing?.confidence}
            onSubmit={(value, confidence) =>
              handleSubmitGuess(
                screenState.personIndex,
                screenState.questionIndex,
                value,
                confidence
              )
            }
          />
        );
      }

      case "guess_other": {
        const person = session.participants[screenState.personIndex];
        const target = session.participants[screenState.targetIndex];
        const firstQuestion = family.questions[0];
        const existing = session.otherPredictions[person.id]?.[target.id];
        return (
          <GuessOtherScreen
            key={`${person.id}-other-${target.id}`}
            family={family}
            participantName={person.name}
            otherName={target.name}
            firstQuestion={firstQuestion}
            initialValue={existing}
            onSubmit={(value) =>
              handleSubmitGuessOther(
                screenState.personIndex,
                screenState.targetIndex,
                value
              )
            }
          />
        );
      }

      case "reveal": {
        const question = family.questions[screenState.questionIndex];
        return (
          <RevealScreen
            key={`${screenState.questionIndex}-${question.id}`}
            family={family}
            participants={session.participants}
            question={question}
            questionIndex={screenState.questionIndex}
            totalQuestions={family.questions.length}
            answers={session.answers}
            otherPredictions={session.otherPredictions}
            onNext={() => handleNextReveal(screenState.questionIndex)}
          />
        );
      }

      case "steps":
        return (
          <StepsScreen
            family={family}
            selectedIds={session.selectedRecommendationIds}
            onSetStepCount={handleSetStepCount}
            onContinue={handleContinueToAgreement}
          />
        );

      case "agreement":
        return (
          <AgreementScreen
            family={family}
            participants={session.participants}
            chosenRecommendationId={state.agreementChoiceId}
            targetDate={state.agreementDate}
            agreedParticipantIds={state.agreedIds}
            confirmedAgreement={session.agreement}
            onSelectRecommendation={handleSelectAgreementRecommendation}
            onChangeTargetDate={handleChangeAgreementDate}
            onToggleAgree={handleToggleAgree}
            onResetAgreement={handleResetAgreement}
            onOpenAdvisor={() =>
              setState((prev) => ({
                ...prev,
                screenState: { screen: "advisor", returnTo: "agreement" },
              }))
            }
            onOpenDay3={() => handleOpenDay3(session)}
            onOpenDay30={() => handleOpenDay30(session)}
          />
        );

      case "day3_handoff": {
        const person = session.participants[screenState.personIndex];
        return (
          <HandoffScreen
            participantName={person.name}
            eyebrow="Day 3 check-in — Next person"
            onStartTurn={() =>
              setState((prev) => ({
                ...prev,
                screenState: {
                  screen: "day3_status",
                  personIndex: screenState.personIndex,
                },
              }))
            }
          />
        );
      }

      case "day3_status": {
        const person = session.participants[screenState.personIndex];
        const stepLabel = session.agreement?.recommendationLabel ?? "";
        return (
          <Day3StatusScreen
            participantName={person.name}
            stepLabel={stepLabel}
            onSelectStatus={(status) =>
              handleDay3SelectStatus(screenState.personIndex, status)
            }
          />
        );
      }

      case "day3_blocker": {
        const person = session.participants[screenState.personIndex];
        const existing = state.draftDay3Responses[person.id];
        return (
          <Day3BlockerScreen
            participantName={person.name}
            initialReason={existing?.blockerReason}
            initialNote={existing?.blockerNote}
            onSubmit={(reason, note) =>
              handleDay3SubmitBlocker(screenState.personIndex, reason, note)
            }
            onBack={() =>
              setState((prev) => ({
                ...prev,
                screenState: {
                  screen: "day3_status",
                  personIndex: screenState.personIndex,
                },
              }))
            }
          />
        );
      }

      case "day3_summary": {
        const stepLabel = session.agreement?.recommendationLabel ?? "";
        return (
          <Day3SummaryScreen
            familyDisplayName={session.familyDisplayName}
            stepLabel={stepLabel}
            participants={session.participants}
            day3={session.checkIns?.day3}
            onBackToStart={() =>
              setState((prev) => ({
                ...prev,
                screenState: { screen: "start" },
              }))
            }
            onOpenAdvisor={() =>
              setState((prev) => ({
                ...prev,
                screenState: { screen: "advisor", returnTo: "day3_summary" },
              }))
            }
          />
        );
      }

      case "day30_handoff": {
        const person = session.participants[screenState.personIndex];
        return (
          <HandoffScreen
            participantName={person.name}
            eyebrow="Day 30 check-in — Next person"
            onStartTurn={() =>
              setState((prev) => ({
                ...prev,
                screenState: {
                  screen: "day30_guess",
                  personIndex: screenState.personIndex,
                  questionIndex: 0,
                },
              }))
            }
          />
        );
      }

      case "day30_guess": {
        const person = session.participants[screenState.personIndex];
        const question = family.questions[screenState.questionIndex];
        const existing = state.draftDay30Answers[person.id]?.[question.id];
        return (
          <GuessScreen
            key={`day30-${person.id}-${question.id}`}
            family={family}
            participantName={person.name}
            question={question}
            questionNumber={screenState.questionIndex + 1}
            totalQuestions={family.questions.length}
            initialValue={existing?.value}
            initialConfidence={existing?.confidence}
            eyebrowOverride={`${person.name} — Day 30 check-in (${
              screenState.questionIndex + 1
            } of ${family.questions.length})`}
            titleOverride="One month later: what does your plan say?"
            onSubmit={(value, confidence) =>
              handleDay30SubmitGuess(
                screenState.personIndex,
                screenState.questionIndex,
                value,
                confidence
              )
            }
          />
        );
      }

      case "day30_reveal": {
        const question = family.questions[screenState.questionIndex];
        const todayAnswers =
          session.checkIns?.day30?.answers ?? state.draftDay30Answers;
        return (
          <Day30RevealScreen
            key={`day30-reveal-${screenState.questionIndex}-${question.id}`}
            family={family}
            participants={session.participants}
            question={question}
            questionIndex={screenState.questionIndex}
            totalQuestions={family.questions.length}
            firstAnswers={session.answers}
            todayAnswers={todayAnswers}
            onNext={() => handleDay30NextReveal(screenState.questionIndex)}
          />
        );
      }

      case "day30_step": {
        const stepLabel = session.agreement?.recommendationLabel ?? "";
        return (
          <Day30StepScreen
            stepLabel={stepLabel}
            onSelectStatus={handleDay30SelectStepStatus}
          />
        );
      }

      case "day30_summary": {
        const stepLabel = session.agreement?.recommendationLabel ?? "";
        const day30 = session.checkIns?.day30;
        return (
          <Day30SummaryScreen
            family={family}
            participants={session.participants}
            stepLabel={stepLabel}
            stepStatus={day30?.stepStatus}
            firstAnswers={session.answers}
            todayAnswers={day30?.answers ?? state.draftDay30Answers}
            onBackToStart={() =>
              setState((prev) => ({
                ...prev,
                screenState: { screen: "start" },
              }))
            }
            onOpenAdvisor={() =>
              setState((prev) => ({
                ...prev,
                screenState: { screen: "advisor", returnTo: "day30_summary" },
              }))
            }
          />
        );
      }
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark">
          <p className="brand-title">Same Page</p>
          {!activeFamily.verified && (
            <span className="demo-badge">Demo data — pending verification</span>
          )}
        </div>
        <button
          type="button"
          className="btn-header"
          onClick={handleStartOver}
        >
          Start over
        </button>
      </header>

      {renderScreen()}
    </div>
  );
}
