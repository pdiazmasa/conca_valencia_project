function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

export function getTodayIsoDate(): string {
  return formatLocalIsoDate(new Date());
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const parts = isoDate.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return isoDate;
  }
  const [year, month, day] = parts;
  const shifted = new Date(year, month - 1, day + days);
  return formatLocalIsoDate(shifted);
}

const humanFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatHumanDate(isoDate: string): string {
  const parts = isoDate.split("-").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return isoDate;
  }
  const [year, month, day] = parts;
  return humanFormatter.format(new Date(year, month - 1, day));
}
