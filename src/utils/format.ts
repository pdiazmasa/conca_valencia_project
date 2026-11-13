import type { Family, Question, ScaleKind } from "../data/types";

export type FormatContext = "readout" | "sentence" | "tick";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function formatValue(
  value: number,
  kind: ScaleKind,
  context: FormatContext = "sentence"
): string {
  const formattedNumber = numberFormatter.format(value);
  switch (kind) {
    case "usd":
      return `$${formattedNumber}`;
    case "usd_per_year":
      return context === "readout" ? `$${formattedNumber} a year` : `$${formattedNumber}`;
    case "percent":
      return `${formattedNumber}%`;
    case "age":
    case "score":
      return formattedNumber;
  }
}

function getFactKind(family: Family, key: string, question?: Question): ScaleKind {
  if (family.factKinds && family.factKinds[key]) {
    return family.factKinds[key];
  }
  if (question && key === question.planFactKey) {
    return question.scale.kind;
  }
  const lower = key.toLowerCase();
  if (lower.includes("rate") || lower.includes("percent")) return "percent";
  if (lower.includes("age")) return "age";
  if (lower.includes("score")) return "score";
  if (
    lower.includes("cash") ||
    lower.includes("balance") ||
    lower.includes("price") ||
    lower.includes("interest") ||
    lower.includes("contribution")
  ) {
    return "usd";
  }
  return "score";
}

export function formatTemplate(
  template: string,
  family: Family,
  options?: { question?: Question; participantName?: string }
): string {
  const question = options?.question;

  return template.replace(/\{([a-zA-Z0-9_]+)\}(\%?)/g, (fullMatch, key: string, trailingPercent: string) => {
    if (key === "name") {
      return (options?.participantName ?? "") + trailingPercent;
    }

    const factKey = key === "plan" && question ? question.planFactKey : key;
    if (!(factKey in family.facts)) {
      return fullMatch;
    }

    const value = family.facts[factKey];
    const kind =
      key === "plan" && question
        ? question.scale.kind
        : getFactKind(family, factKey, question);

    const rendered = formatValue(value, kind, "sentence");
    if (trailingPercent && rendered.endsWith("%")) {
      return rendered;
    }
    return rendered + trailingPercent;
  });
}
