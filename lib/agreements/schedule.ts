// Schedule and pricing maths for service agreements. Pure functions, unit tested in
// schedule.test.ts.
//
// Dates are calendar dates as "YYYY-MM-DD" strings. Arithmetic is done on UTC
// midnights, so no time zone or daylight-saving change can shift a day.

const DAY_MS = 86_400_000;

export type SchedulePart = {
  startDate: string;
  endDate: string;
  intervalWeeks: number;
  pricePerVisit: number;
};

export type PlannedVisit = {
  date: string;
  price: number;
  /** Index of the schedule part that generated it; null for a date added by hand. */
  partIndex: number | null;
};

// --- Dates -------------------------------------------------------------------

export function isYmd(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

function toMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  return fromMs(toMs(ymd) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

function ymdOf(year: number, month: number, day: number): string {
  return fromMs(Date.UTC(year, month - 1, day));
}

/** "2026-03" */
export function monthKey(ymd: string): string {
  return ymd.slice(0, 7);
}

export function formatDate(
  ymd: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
): string {
  return new Date(toMs(ymd)).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

/** "March 2026" */
export function formatMonth(key: string): string {
  return formatDate(`${key}-01`, { month: "long", year: "numeric" });
}

// --- Visits ------------------------------------------------------------------

/** First visit on the part's start date, then every N weeks up to and including its end date. */
export function partDates(part: Pick<SchedulePart, "startDate" | "endDate" | "intervalWeeks">): string[] {
  // The preview runs on half-typed input, so an unusable part simply has no dates.
  if (!isYmd(part.startDate) || !isYmd(part.endDate)) return [];
  if (!Number.isInteger(part.intervalWeeks) || part.intervalWeeks < 1 || part.intervalWeeks > 4) {
    return [];
  }
  const dates: string[] = [];
  const end = toMs(part.endDate);
  for (let ms = toMs(part.startDate); ms <= end; ms += part.intervalWeeks * 7 * DAY_MS) {
    dates.push(fromMs(ms));
  }
  return dates;
}

export function generateVisits(parts: readonly SchedulePart[]): PlannedVisit[] {
  return sortVisits(
    parts.flatMap((part, partIndex) =>
      partDates(part).map((date) => ({ date, price: part.pricePerVisit, partIndex }))
    )
  );
}

/** Price for a date added by hand: the part whose range holds it, else the first part's. */
export function priceForDate(date: string, parts: readonly SchedulePart[]): number {
  const covering = parts.find((p) => p.startDate <= date && date <= p.endDate);
  return (covering ?? parts[0])?.pricePerVisit ?? 0;
}

export type DateChanges = { removed: readonly string[]; added: readonly string[] };

/** The generated visits, minus removed dates, plus added ones (one visit per date). */
export function applyDateChanges(
  generated: readonly PlannedVisit[],
  changes: DateChanges,
  parts: readonly SchedulePart[]
): PlannedVisit[] {
  const removed = new Set(changes.removed);
  const visits = generated.filter((v) => !removed.has(v.date));
  const taken = new Set(visits.map((v) => v.date));
  for (const date of changes.added) {
    if (taken.has(date)) continue;
    taken.add(date);
    visits.push({ date, price: priceForDate(date, parts), partIndex: null });
  }
  return sortVisits(visits);
}

/** The manual changes that turn the generated dates into the saved ones. */
export function diffDateChanges(
  generatedDates: readonly string[],
  savedDates: readonly string[]
): { removed: string[]; added: string[] } {
  const generated = new Set(generatedDates);
  const saved = new Set(savedDates);
  return {
    removed: [...generated].filter((d) => !saved.has(d)).sort(),
    added: [...saved].filter((d) => !generated.has(d)).sort(),
  };
}

function sortVisits(visits: PlannedVisit[]): PlannedVisit[] {
  return visits.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function groupByMonth<T extends { date: string }>(
  visits: readonly T[]
): { month: string; label: string; visits: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const v of [...visits].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const key = monthKey(v.date);
    groups.set(key, [...(groups.get(key) ?? []), v]);
  }
  return [...groups].map(([month, list]) => ({ month, label: formatMonth(month), visits: list }));
}

// --- Money -------------------------------------------------------------------
// Summed in whole cents so 0.1 + 0.2 style float errors can't creep in.

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function visitTotal(visits: readonly { price: number }[]): number {
  return visits.reduce((sum, v) => sum + toCents(v.price), 0) / 100;
}

/** Default billing months: the number of calendar months that have a visit. */
export function monthsWithVisits(visits: readonly { date: string }[]): number {
  return new Set(visits.map((v) => monthKey(v.date))).size;
}

/** Flat monthly price: the visit total over the billing months, rounded to whole dollars. */
export function monthlyPrice(total: number, billingMonths: number): number {
  return Math.round(toCents(total) / billingMonths / 100);
}

/** What the monthly price bills over the term, minus the visit total ($1,168 billed - $1,170 of visits = -2). */
export function billedDifference(monthly: number, billingMonths: number, total: number): number {
  return (toCents(monthly) * billingMonths - toCents(total)) / 100;
}

// --- Seasons and renewal -------------------------------------------------------

/**
 * The next occurrence of a service type's default season, as a term: the 1st of the
 * start month to the last day of the end month. This year if the start month is still
 * ahead, otherwise next year; during the start month itself it starts today, so the
 * dates are never in the past. An end month before the start month means the season
 * ends the following year (Oct–Jan).
 */
export function nextSeasonDates(
  startMonth: number | null,
  endMonth: number | null,
  today: string
): { startDate: string; endDate: string } | null {
  if (startMonth === null || endMonth === null) return null;
  const [year, month] = today.split("-").map(Number);
  const startYear = month <= startMonth ? year : year + 1;
  const endYear = endMonth >= startMonth ? startYear : startYear + 1;
  return {
    startDate: month === startMonth ? today : ymdOf(startYear, startMonth, 1),
    endDate: ymdOf(endYear, endMonth + 1, 0),
  };
}

/** The same calendar date `years` later. Feb 29 becomes Feb 28 in a year without one. */
export function addYears(ymd: string, years: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return ymdOf(y + years, m, Math.min(d, lastDay));
}
