// Last Contact: day counting, colour thresholds and contact-date parsing.
// Pure functions (time zone and "now" are passed in) so they can be unit tested.

export type ContactThresholds = {
  /** Green while days since last contact is at most this. */
  greenDays: number;
  /** Yellow while days since last contact is at most this (and above greenDays). Red after. */
  yellowDays: number;
};

// Keep in sync with the app_settings defaults in supabase/migrations/002_last_contact.sql.
export const DEFAULT_CONTACT_THRESHOLDS: ContactThresholds = { greenDays: 14, yellowDays: 30 };

const MAX_THRESHOLD_DAYS = 3650;

export const CONTACT_LEVELS = {
  green: { label: "Recent", cell: "bg-emerald-100 text-emerald-900" },
  yellow: { label: "Due soon", cell: "bg-amber-100 text-amber-900" },
  red: { label: "Overdue", cell: "bg-red-100 text-red-900" },
  never: { label: "Never contacted", cell: "bg-gray-100 text-gray-500" },
} as const;

export type ContactLevel = keyof typeof CONTACT_LEVELS;

export function contactLevel(days: number | null, t: ContactThresholds): ContactLevel {
  if (days === null) return "never";
  if (days <= t.greenDays) return "green";
  if (days <= t.yellowDays) return "yellow";
  return "red";
}

/** Returns an error message, or null when the thresholds are usable. */
export function validateThresholds(t: ContactThresholds): string | null {
  for (const [name, value] of [
    ["Green", t.greenDays],
    ["Yellow", t.yellowDays],
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_THRESHOLD_DAYS) {
      return `${name} must be a whole number of days between 0 and ${MAX_THRESHOLD_DAYS}.`;
    }
  }
  if (t.yellowDays <= t.greenDays) {
    return "Yellow must be more days than green.";
  }
  return null;
}

type FormLike = { get(name: string): FormDataEntryValue | null };

export function parseThresholds(
  form: FormLike
): { ok: true; value: ContactThresholds } | { ok: false; error: string } {
  const toNumber = (v: FormDataEntryValue | null) =>
    typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  const value = {
    greenDays: toNumber(form.get("green_days")),
    yellowDays: toNumber(form.get("yellow_days")),
  };
  const error = validateThresholds(value);
  return error ? { ok: false, error } : { ok: true, value };
}

// --- Calendar days -----------------------------------------------------------

/** The calendar date (YYYY-MM-DD) of an instant, as seen in a time zone. */
export function calendarDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Whole calendar days from the last contact to now, in the given time zone.
 * Yesterday at 11 pm counts as 1 day, not 0. Never negative: a contact dated
 * later than now (clock skew, time zone change) counts as today.
 */
export function daysSince(
  lastContact: Date | string | null,
  now: Date,
  timeZone: string
): number | null {
  if (lastContact === null) return null;
  const then = typeof lastContact === "string" ? new Date(lastContact) : lastContact;
  if (Number.isNaN(then.getTime())) return null;
  const diff =
    (ymdToUtcMs(calendarDate(now, timeZone)) - ymdToUtcMs(calendarDate(then, timeZone))) /
    86_400_000;
  return Math.max(0, Math.round(diff));
}

export function formatDaysAgo(days: number | null): string {
  if (days === null) return "Never";
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function formatContactDate(instant: Date | string, timeZone: string): string {
  return new Date(instant).toLocaleDateString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatContactDateTime(instant: Date | string, timeZone: string): string {
  return new Date(instant).toLocaleString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Neutral colour for clients whose contact isn't tracked (Declined, Past). */
export const UNTRACKED_CONTACT_CELL = "bg-gray-50 text-gray-600";

/**
 * Everything the list cell and the detail-page badge need to show.
 * `tracked: false` keeps the "45 days ago" text but drops the green/yellow/red,
 * so red only ever means a Lead or Active client is overdue for a call.
 */
export function describeLastContact(
  lastContactAt: string | null,
  now: Date,
  timeZone: string,
  thresholds: ContactThresholds,
  { tracked = true }: { tracked?: boolean } = {}
) {
  const days = daysSince(lastContactAt, now, timeZone);
  const level = contactLevel(days, thresholds);
  return {
    days,
    level,
    text: formatDaysAgo(days),
    title:
      lastContactAt && days !== null
        ? formatContactDateTime(lastContactAt, timeZone)
        : CONTACT_LEVELS.never.label,
    className: tracked || level === "never" ? CONTACT_LEVELS[level].cell : UNTRACKED_CONTACT_CELL,
  };
}

// --- Contact date/time on the note form -------------------------------------

/** Wall-clock time of an instant in a time zone, as milliseconds of a UTC date with the same fields. */
function wallClockMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
}

/** Value for <input type="datetime-local">: the instant's wall-clock time, "YYYY-MM-DDTHH:mm". */
export function toDateTimeLocalValue(instant: Date, timeZone: string): string {
  return new Date(wallClockMs(instant, timeZone)).toISOString().slice(0, 16);
}

/** UTC instant of a wall-clock date and time in a time zone. */
function zonedTimeToUtc(wallMs: number, timeZone: string): Date {
  // First guess uses the offset a few hours away from the real instant; check it
  // again at the guessed instant in case a daylight-saving change lies between.
  let utc = wallMs - (wallClockMs(new Date(wallMs), timeZone) - wallMs);
  utc = wallMs - (wallClockMs(new Date(utc), timeZone) - utc);
  return new Date(utc);
}

/**
 * The contact_date to store for a note, from the form's datetime-local value
 * (read as wall-clock time in the business time zone).
 * - Blank, or not changed by the user (`changed` false): now, the moment the note
 *   is saved, rather than the minute the page happened to load.
 * - Anything later than now is rejected: Last Contact means a contact that happened.
 */
export function parseContactDateTime(
  value: FormDataEntryValue | null,
  changed: boolean,
  now: Date,
  timeZone: string
): Date {
  if (!changed || value === null || (typeof value === "string" && value.trim() === "")) return now;
  if (typeof value !== "string") throw new Error("Invalid contact date");
  const trimmed = value.trim();

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(trimmed);
  if (!match) throw new Error("Invalid contact date");
  const [y, mo, d, h, mi] = match.slice(1).map(Number);
  const wallMs = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(wallMs);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    throw new Error("Invalid contact date");
  }

  const instant = zonedTimeToUtc(wallMs, timeZone);
  // Seconds are dropped, so the current minute counts as now, not the future.
  if (instant.getTime() > now.getTime()) throw new Error("Contact date can't be in the future");
  return instant;
}

// --- Sorting the clients list ------------------------------------------------

export const CLIENT_SORTS = ["name", "last_contact", "-last_contact"] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];

export function parseClientSort(value: unknown): ClientSort {
  return CLIENT_SORTS.includes(value as ClientSort) ? (value as ClientSort) : "name";
}

/**
 * "last_contact": longest since contact first, never-contacted at the very top
 * ("who haven't we talked to"). "-last_contact": most recent first, never last.
 * Ties keep their incoming order (the list arrives sorted by name).
 */
export function sortByLastContact<T extends { lastContactAt: string | null }>(
  rows: readonly T[],
  sort: ClientSort
): T[] {
  if (sort === "name") return [...rows];
  const dir = sort === "last_contact" ? 1 : -1;
  const time = (r: T) => (r.lastContactAt ? new Date(r.lastContactAt).getTime() : null);
  return [...rows].sort((a, b) => {
    const ta = time(a);
    const tb = time(b);
    if (ta === tb) return 0;
    if (ta === null) return -dir;
    if (tb === null) return dir;
    return dir * (ta - tb);
  });
}
