import { useEffect, useState } from "react";
import { FAMILIES, getFamilyById } from "./data";
import type {
  AgreementRecord,
  Confidence,
  Family,
  Participant,
  SessionRecord,
} from "./data/types";
import { AdvisorScreen } from "./screens/AdvisorScreen";
import { AgreementScreen } from "./screens/AgreementScreen";
import { GuessOtherScreen } from "./screens/GuessOtherScreen";
import { GuessScreen } from "./screens/GuessScreen";
import { HandoffScreen } from "./screens/HandoffScreen";
import { RevealScreen } from "./screens/RevealScreen";
import { StartScreen } from "./screens/StartScreen";
import { StepsScreen } from "./screens/StepsScreen";
import { addDaysToIsoDate, getTodayIsoDate } from "./utils/dates";
import { stopSpeech } from "./utils/speech";
import {
  clearActiveState,
  loadActiveState,
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
  | { screen: "advisor"; returnTo: "start" | "agreement" };

type AppState = {
  screenState: ScreenState;
  draftFamilyId: string;
  draftPeopleCount: number;
  draftNames: string[];
  session: SessionRecord | null;
  agreementChoiceId: string;
  agreementDate: string;
  agreedIds: string[];
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
  };
}

function loadInitialState(): AppState {
  const saved = loadActiveState<AppState>();
  if (!saved || !saved.screenState || !getFamilyById(saved.draftFamilyId)) {
    return createInitialState();
  }
  if (saved.screenState.screen !== "start" && saved.screenState.screen !== "advisor" && !saved.session) {
    return createInitialState();
  }
  return saved;
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
    };

    setState((prev) => ({
      ...prev,
      session: newSession,
      agreementChoiceId: family.recommendations[0]?.id ?? "",
      agreementDate: addDaysToIsoDate(getTodayIsoDate(), 7),
      agreedIds: [],
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

  function handleToggleRecommendation(recommendationId: string) {
    setState((prev) => {
      if (!prev.session) return prev;
      const current = prev.session.selectedRecommendationIds;
      const exists = current.includes(recommendationId);
      const nextSelected = exists
        ? current.filter((id) => id !== recommendationId)
        : [...current, recommendationId];

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

  function renderScreen() {
    const { screenState, session } = state;

    if (screenState.screen === "start") {
      return (
        <StartScreen
          families={FAMILIES}
          selectedFamilyId={state.draftFamilyId}
          peopleCount={state.draftPeopleCount}
          participantNames={state.draftNames}
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
            onToggleRecommendation={handleToggleRecommendation}
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
          />
        );
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
