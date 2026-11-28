// The agreement form's data: live preview, validation of what the browser sends,
// and conversion from saved rows back to form data. Pure, unit tested in input.test.ts.

import { isBillingType, type BillingType } from "./constants";
import {
  addDays,
  addYears,
  applyDateChanges,
  billedDifference,
  daysBetween,
  diffDateChanges,
  formatDate,
  generateVisits,
  isYmd,
  monthlyPrice,
  monthsWithVisits,
  visitTotal,
  type PlannedVisit,
  type SchedulePart,
} from "./schedule";

export type PartInput = {
  startDate: string;
  endDate: string;
  intervalWeeks: number;
  /** As typed, e.g. "65" or "65.50". */
  pricePerVisit: string;
};

/** Everything the agreement form edits. Sent as-is to the save action, which re-validates it. */
export type AgreementInput = {
  propertyId: string | null;
  serviceTypeId: string;
  billingType: BillingType;
  /** Per visit with no schedule: visits are booked when the client calls. */
  onCall: boolean;
  startDate: string;
  endDate: string;
  parts: PartInput[];
  /** Generated dates taken out by hand. */
  removedDates: string[];
  /** Dates added by hand. */
  addedDates: string[];
  /** Flat monthly only. null means "the number of months that have visits". */
  billingMonths: number | null;
  /** On call only. */
  pricePerVisit: string;
  taskIds: string[];
  serviceAreas: string;
  notes: string;
};

export const MAX_TERM_DAYS = 731; // two years
export const MAX_BILLING_MONTHS = 36;
const MAX_PRICE = 100_000;

export function emptyAgreementInput(): AgreementInput {
  return {
    propertyId: null,
    serviceTypeId: "",
    billingType: "flat_monthly",
    onCall: false,
    startDate: "",
    endDate: "",
    parts: [{ startDate: "", endDate: "", intervalWeeks: 2, pricePerVisit: "" }],
    removedDates: [],
    addedDates: [],
    billingMonths: null,
    pricePerVisit: "",
    taskIds: [],
    serviceAreas: "",
    notes: "",
  };
}

/** Dollars from a typed price ("65", "$1,170.5"); null if it isn't a usable amount. */
export function parseMoney(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return amount <= MAX_PRICE ? amount : null;
}

/** A saved price back as form text: 65 → "65", 65.5 → "65.50". */
export function moneyInputValue(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

function toPart(p: PartInput): SchedulePart | null {
  const price = parseMoney(p.pricePerVisit);
  if (price === null || !isYmd(p.startDate) || !isYmd(p.endDate)) return null;
  return {
    startDate: p.startDate,
    endDate: p.endDate,
    intervalWeeks: p.intervalWeeks,
    pricePerVisit: price,
  };
}

export type AgreementPreview = {
  /** Planned visits after manual changes. */
  visits: PlannedVisit[];
  /** Generated visits that were taken out by hand (shown struck through, can be restored). */
  removedVisits: PlannedVisit[];
  /** Dates added by hand that are in `visits`. */
  addedDates: Set<string>;
  total: number;
  defaultBillingMonths: number;
  billingMonths: number;
  /** Flat monthly only. */
  monthly: number | null;
  /** monthly × billing months − total, e.g. −2 for "$1,168 billed vs $1,170 of visits". */
  difference: number;
};

/** What the preview shows for the form as it stands. Rows that aren't filled in yet are skipped. */
export function buildPreview(input: AgreementInput): AgreementPreview {
  const parts = input.onCall
    ? []
    : input.parts.map(toPart).filter((p): p is SchedulePart => p !== null);
  const generated = generateVisits(parts);
  const visits = input.onCall
    ? []
    : applyDateChanges(generated, { removed: input.removedDates, added: input.addedDates }, parts);
  const removed = new Set(input.removedDates);
  const total = visitTotal(visits);
  const defaultBillingMonths = monthsWithVisits(visits);
  const billingMonths = input.billingMonths ?? defaultBillingMonths;
  const monthly =
    input.billingType === "flat_monthly" && billingMonths > 0 && visits.length > 0
      ? monthlyPrice(total, billingMonths)
      : null;
  return {
    visits,
    removedVisits: generated.filter((v) => removed.has(v.date)),
    addedDates: new Set(visits.filter((v) => v.partIndex === null).map((v) => v.date)),
    total,
    defaultBillingMonths,
    billingMonths,
    monthly,
    difference: monthly === null ? 0 : billedDifference(monthly, billingMonths, total),
  };
}

export type ValidAgreement = {
  propertyId: string | null;
  serviceTypeId: string;
  billingType: BillingType;
  startDate: string;
  endDate: string;
  billingMonths: number | null;
  monthlyPrice: number | null;
  pricePerVisit: number | null;
  serviceAreas: string | null;
  notes: string | null;
  taskIds: string[];
  /** Sorted by start date; visits' partIndex points into this list. */
  parts: SchedulePart[];
  visits: PlannedVisit[];
};

const text = (v: unknown) => (typeof v === "string" ? v : "");
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

/**
 * Checks what the form sent (untrusted: it arrives from the browser) and works out
 * the visits and prices to store. Returns every problem found, not just the first.
 */
export function validateAgreement(
  raw: unknown
): { ok: true; value: ValidAgreement } | { ok: false; errors: string[] } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];

  const serviceTypeId = text(r.serviceTypeId);
  if (!serviceTypeId) errors.push("Choose a service type.");

  const billingType = r.billingType;
  if (!isBillingType(billingType)) errors.push("Choose a billing type.");
  const onCall = r.onCall === true;
  if (onCall && billingType !== "per_visit") {
    errors.push("Only per-visit agreements can be on call.");
  }

  const startDate = text(r.startDate);
  const endDate = text(r.endDate);
  let termOk = true;
  if (!isYmd(startDate)) {
    errors.push("Enter the agreement's start date.");
    termOk = false;
  }
  if (!isYmd(endDate)) {
    errors.push("Enter the agreement's end date.");
    termOk = false;
  }
  if (termOk && endDate < startDate) {
    errors.push("The end date must be on or after the start date.");
    termOk = false;
  }
  if (termOk && daysBetween(startDate, endDate) > MAX_TERM_DAYS) {
    errors.push("An agreement can run for at most two years. Renew it for the next term.");
    termOk = false;
  }

  // --- Schedule ---
  let parts: SchedulePart[] = [];
  let visits: PlannedVisit[] = [];
  let pricePerVisit: number | null = null;

  if (onCall) {
    pricePerVisit = parseMoney(r.pricePerVisit);
    if (pricePerVisit === null) errors.push("Enter the price per visit.");
  } else {
    const rawParts = Array.isArray(r.parts) ? r.parts : [];
    if (rawParts.length === 0) errors.push("Add at least one schedule part.");

    const numbered: { n: number; part: SchedulePart }[] = [];
    rawParts.forEach((value, i) => {
      const p = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      const label = rawParts.length > 1 ? `Schedule part ${i + 1}` : "Schedule";
      const start = text(p.startDate);
      const end = text(p.endDate);
      const interval = p.intervalWeeks;
      const price = parseMoney(p.pricePerVisit);
      let ok = true;
      if (!isYmd(start) || !isYmd(end)) {
        errors.push(`${label}: enter a start and end date.`);
        ok = false;
      } else if (end < start) {
        errors.push(`${label}: the end date must be on or after the start date.`);
        ok = false;
      } else if (termOk && (start < startDate || end > endDate)) {
        errors.push(`${label}: dates must fall within the agreement's start and end dates.`);
        ok = false;
      }
      if (typeof interval !== "number" || !Number.isInteger(interval) || interval < 1 || interval > 4) {
        errors.push(`${label}: choose how often (every 1 to 4 weeks).`);
        ok = false;
      }
      if (price === null) {
        errors.push(`${label}: enter the price per visit.`);
        ok = false;
      }
      if (ok) {
        numbered.push({
          n: i + 1,
          part: { startDate: start, endDate: end, intervalWeeks: interval as number, pricePerVisit: price! },
        });
      }
    });

    numbered.sort((a, b) => (a.part.startDate < b.part.startDate ? -1 : 1));
    for (let i = 1; i < numbered.length; i++) {
      if (numbered[i].part.startDate <= numbered[i - 1].part.endDate) {
        errors.push(`Schedule parts ${numbered[i - 1].n} and ${numbered[i].n} overlap.`);
      }
    }
    parts = numbered.map((x) => x.part);

    const added = strings(r.addedDates);
    for (const date of added) {
      if (!isYmd(date)) {
        errors.push("An added visit date isn't a valid date.");
      } else if (termOk && (date < startDate || date > endDate)) {
        errors.push(`Added visit ${formatDate(date)} is outside the agreement's dates.`);
      }
    }

    visits = applyDateChanges(
      generateVisits(parts),
      { removed: strings(r.removedDates), added: added.filter(isYmd) },
      parts
    );
    if (rawParts.length > 0 && parts.length === rawParts.length && visits.length === 0) {
      errors.push("The schedule has no visits.");
    }
  }

  // --- Price ---
  let billingMonths: number | null = null;
  let monthly: number | null = null;
  if (billingType === "flat_monthly") {
    const requested = r.billingMonths;
    if (requested === null || requested === undefined) {
      billingMonths = monthsWithVisits(visits);
    } else if (
      typeof requested === "number" &&
      Number.isInteger(requested) &&
      requested >= 1 &&
      requested <= MAX_BILLING_MONTHS
    ) {
      billingMonths = requested;
    } else {
      errors.push(`Billing months must be a whole number from 1 to ${MAX_BILLING_MONTHS}.`);
    }
    if (billingMonths && visits.length > 0) monthly = monthlyPrice(visitTotal(visits), billingMonths);
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      propertyId: text(r.propertyId) || null,
      serviceTypeId,
      billingType: billingType as BillingType,
      startDate,
      endDate,
      billingMonths,
      monthlyPrice: monthly,
      pricePerVisit,
      serviceAreas: text(r.serviceAreas).trim() || null,
      notes: text(r.notes).trim() || null,
      taskIds: [...new Set(strings(r.taskIds))],
      parts,
      visits,
    },
  };
}

export type SavedAgreement = {
  property_id: string | null;
  service_type_id: string;
  billing_type: string;
  start_date: string;
  end_date: string;
  billing_months: number | null;
  price_per_visit: number | null;
  service_areas: string | null;
  notes: string | null;
};

export type SavedPart = {
  start_date: string;
  end_date: string;
  interval_weeks: number;
  price_per_visit: number;
};

/** Saved rows back into form data. Manual date changes are worked out from the saved visits. */
export function agreementToInput(
  agreement: SavedAgreement,
  savedParts: readonly SavedPart[],
  visitDates: readonly string[],
  taskIds: readonly string[]
): AgreementInput {
  const parts: SchedulePart[] = savedParts.map((p) => ({
    startDate: p.start_date,
    endDate: p.end_date,
    intervalWeeks: p.interval_weeks,
    pricePerVisit: Number(p.price_per_visit),
  }));
  const billingType: BillingType = isBillingType(agreement.billing_type)
    ? agreement.billing_type
    : "flat_monthly";
  const onCall = billingType === "per_visit" && parts.length === 0;
  const { removed, added } = diffDateChanges(
    generateVisits(parts).map((v) => v.date),
    visitDates
  );
  const defaultMonths = monthsWithVisits(visitDates.map((date) => ({ date })));

  return {
    propertyId: agreement.property_id,
    serviceTypeId: agreement.service_type_id,
    billingType,
    onCall,
    startDate: agreement.start_date,
    endDate: agreement.end_date,
    parts: onCall
      ? emptyAgreementInput().parts
      : parts.map((p) => ({ ...p, pricePerVisit: moneyInputValue(p.pricePerVisit) })),
    removedDates: removed,
    addedDates: added,
    billingMonths:
      billingType === "flat_monthly" && agreement.billing_months !== defaultMonths
        ? agreement.billing_months
        : null,
    pricePerVisit:
      agreement.price_per_visit === null ? "" : moneyInputValue(Number(agreement.price_per_visit)),
    taskIds: [...taskIds],
    serviceAreas: agreement.service_areas ?? "",
    notes: agreement.notes ?? "",
  };
}

/**
 * Next year's agreement (Renew): the agreement's and every part's dates move to the
 * same calendar dates one year later, so the season and the monthly price stay the
 * same year after year (Mar 3 – Oct 31 stays Mar 3 – Oct 31). Visits are generated
 * again from the parts, so they can fall on a different weekday than last year; the
 * draft is reviewed before it is activated. Dates changed by hand are not carried over.
 */
export function renewalInput(input: AgreementInput): AgreementInput {
  const shift = (d: string) => (isYmd(d) ? addYears(d, 1) : d);
  return {
    ...input,
    startDate: shift(input.startDate),
    endDate: shift(input.endDate),
    parts: input.parts.map((p) => ({ ...p, startDate: shift(p.startDate), endDate: shift(p.endDate) })),
    removedDates: [],
    addedDates: [],
  };
}

/**
 * Changes the agreement's start and end dates. A single schedule part that still
 * matches the old dates moves with them, so the common one-part agreement only
 * needs its dates entered once. Parts are left alone once dates were changed by hand.
 */
export function withTerm(input: AgreementInput, startDate: string, endDate: string): AgreementInput {
  const next = { ...input, startDate, endDate };
  const [only] = input.parts;
  const hasManualChanges = input.removedDates.length + input.addedDates.length > 0;
  if (
    !hasManualChanges &&
    input.parts.length === 1 &&
    only.startDate === input.startDate &&
    only.endDate === input.endDate
  ) {
    next.parts = [{ ...only, startDate, endDate }];
  }
  return next;
}

/**
 * A new schedule part: from the day after the last part ends (or the agreement's
 * start) to the agreement's end, as often as the last part, at the first part's price.
 */
export function newPart(input: AgreementInput): PartInput {
  const last = input.parts.at(-1);
  return {
    startDate: last && isYmd(last.endDate) ? addDays(last.endDate, 1) : input.startDate,
    endDate: input.endDate,
    intervalWeeks: last?.intervalWeeks ?? 2,
    pricePerVisit: input.parts[0]?.pricePerVisit ?? "",
  };
}

export type AgreedPrice = { billingMonths: number; monthlyPrice: number };

/**
 * The flat monthly price agreed when the agreement was activated, or null if there
 * is none to keep (drafts, per-visit agreements).
 */
export function agreedPrice(saved: {
  status: string;
  billing_type: string;
  billing_months: number | null;
  monthly_price: number | null;
}): AgreedPrice | null {
  if (saved.status === "draft" || saved.billing_type !== "flat_monthly") return null;
  if (saved.billing_months === null || saved.monthly_price === null) return null;
  return { billingMonths: saved.billing_months, monthlyPrice: Number(saved.monthly_price) };
}

/**
 * Editing an active (or ended) flat-monthly agreement keeps the agreed price unless
 * the user chose to recalculate it: skipping or adding a visit doesn't change what
 * the client pays each month.
 */
export function keepAgreedPrice(
  value: ValidAgreement,
  agreed: AgreedPrice | null,
  recalculate: boolean
): ValidAgreement {
  if (!agreed || recalculate || value.billingType !== "flat_monthly") return value;
  return { ...value, billingMonths: agreed.billingMonths, monthlyPrice: agreed.monthlyPrice };
}
