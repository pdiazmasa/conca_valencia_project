export type ScaleKind = "age" | "usd" | "usd_per_year" | "percent" | "score";

export type Scale = {
  kind: ScaleKind;
  min: number;
  max: number;
  unit: string;
  step?: number;
};

export type QuestionOption = {
  label: string;
  value: number;
};

export type Question = {
  id: string;
  prompt: string;
  type: "choice" | "slider";
  options?: QuestionOption[];
  scale: Scale;
  planFactKey: string;
  revealSentence: string;
};

export type Recommendation = {
  id: string;
  label: string;
  detail: string;
  scoreAfterFactKey?: string;
};

export type FamilyMember = {
  id: string;
  name: string;
};

export type Family = {
  id: string;
  displayName: string;
  verified: boolean;
  source: string;
  members: FamilyMember[];
  headline: string;
  facts: Record<string, number>;
  factKinds?: Record<string, ScaleKind>;
  questions: Question[];
  recommendations: Recommendation[];
};

export type Participant = {
  id: string;
  name: string;
};

export type Confidence = 1 | 2 | 3;

export type QuestionAnswer = {
  value: number;
  confidence: Confidence;
};

export type AgreementRecord = {
  recommendationId: string;
  recommendationLabel: string;
  targetDate: string;
  agreedDate: string;
  checkInDay3: string;
  checkInDay30: string;
  agreedParticipantIds: string[];
};

export type StepProgressStatus = "done" | "started" | "not_yet";

export type Day3BlockerReason =
  | "no_time"
  | "not_sure_how"
  | "changed_minds"
  | "something_else";

export type Day3PersonResponse = {
  status: StepProgressStatus;
  blockerReason?: Day3BlockerReason;
  blockerNote?: string;
};

export type Day3CheckIn = {
  completedAt?: string;
  responses: Record<string, Day3PersonResponse>;
};

export type Day30CheckIn = {
  completedAt?: string;
  answers: Record<string, Record<string, QuestionAnswer>>;
  stepStatus?: StepProgressStatus;
};

export type SessionCheckIns = {
  day3?: Day3CheckIn;
  day30?: Day30CheckIn;
};

export type SessionRecord = {
  id: string;
  familyId: string;
  familyDisplayName: string;
  createdAt: string;
  updatedAt: string;
  participants: Participant[];
  answers: Record<string, Record<string, QuestionAnswer>>;
  otherPredictions: Record<string, Record<string, number>>;
  selectedRecommendationIds: string[];
  agreement?: AgreementRecord;
  checkIns: SessionCheckIns;
};
