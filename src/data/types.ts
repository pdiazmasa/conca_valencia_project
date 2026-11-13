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
};
