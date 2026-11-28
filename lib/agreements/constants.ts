// Allowed values for service agreements. Keep in sync with the CHECK constraints in
// supabase/migrations/003_service_agreements.sql.

export const BILLING_TYPES = [
  { value: "flat_monthly", label: "Flat monthly" },
  { value: "per_visit", label: "Per visit" },
] as const;

export type BillingType = (typeof BILLING_TYPES)[number]["value"];

export const AGREEMENT_STATUSES = [
  { value: "draft", label: "Draft", badge: "bg-amber-100 text-amber-800" },
  { value: "active", label: "Active", badge: "bg-emerald-100 text-emerald-800" },
  { value: "ended", label: "Ended", badge: "bg-gray-100 text-gray-600" },
] as const;

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number]["value"];

/** Visits repeat every 1 to 4 weeks on the part's start weekday. */
export const INTERVAL_WEEKS = [1, 2, 3, 4] as const;

export function intervalLabel(weeks: number): string {
  return weeks === 1 ? "Weekly" : `Every ${weeks} weeks`;
}

export function isBillingType(value: unknown): value is BillingType {
  return BILLING_TYPES.some((t) => t.value === value);
}

export function isAgreementStatus(value: unknown): value is AgreementStatus {
  return AGREEMENT_STATUSES.some((s) => s.value === value);
}

/** What the save buttons ask for. Drafts can be saved or activated; other agreements keep their status. */
export type SaveIntent = "draft" | "activate" | "save";

export function statusAfterSave(current: AgreementStatus | null, intent: SaveIntent): AgreementStatus {
  if (current === null || current === "draft") return intent === "activate" ? "active" : "draft";
  return current;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
