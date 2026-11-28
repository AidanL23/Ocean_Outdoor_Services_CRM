import { describe, expect, it } from "vitest";
import {
  agreedPrice,
  agreementToInput,
  keepAgreedPrice,
  newPart,
  withTerm,
  buildPreview,
  emptyAgreementInput,
  moneyInputValue,
  parseMoney,
  renewalInput,
  validateAgreement,
  type AgreementInput,
} from "./input";

const TYPE_ID = "11111111-1111-1111-1111-111111111111";

function orangeSt(overrides: Partial<AgreementInput> = {}): AgreementInput {
  return {
    ...emptyAgreementInput(),
    serviceTypeId: TYPE_ID,
    billingType: "flat_monthly",
    startDate: "2026-03-03",
    endDate: "2026-10-31",
    parts: [{ startDate: "2026-03-03", endDate: "2026-10-31", intervalWeeks: 2, pricePerVisit: "65" }],
    ...overrides,
  };
}

function expectErrors(raw: unknown) {
  const result = validateAgreement(raw);
  if (result.ok) throw new Error("expected validation errors");
  return result.errors;
}

describe("parseMoney", () => {
  it.each([
    ["65", 65],
    ["65.5", 65.5],
    ["$1,170.00", 1170],
    [" 0 ", 0],
  ])("%s → %s", (input, expected) => expect(parseMoney(input)).toBe(expected));

  it.each(["", "abc", "-5", "1.234", "1e3", "100001"])("rejects %s", (input) =>
    expect(parseMoney(input)).toBeNull()
  );

  it("moneyInputValue round-trips", () => {
    expect(moneyInputValue(65)).toBe("65");
    expect(moneyInputValue(65.5)).toBe("65.50");
  });
});

describe("702 Orange St (done-when example)", () => {
  it("previews 18 visits, $1,170, 8 billing months, $146/month", () => {
    const p = buildPreview(orangeSt());
    expect(p.visits).toHaveLength(18);
    expect(p.total).toBe(1170);
    expect(p.billingMonths).toBe(8);
    expect(p.monthly).toBe(146);
    expect(p.difference).toBe(-2);
  });

  it("validates to the rows to save", () => {
    const result = validateAgreement(orangeSt({ taskIds: ["a", "b", "a"], notes: "  Gate code 1234 " }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.visits).toHaveLength(18);
    expect(result.value.billingMonths).toBe(8);
    expect(result.value.monthlyPrice).toBe(146);
    expect(result.value.pricePerVisit).toBeNull();
    expect(result.value.taskIds).toEqual(["a", "b"]);
    expect(result.value.notes).toBe("Gate code 1234");
    expect(result.value.serviceAreas).toBeNull();
  });

  it("changing billing months changes the monthly price", () => {
    expect(buildPreview(orangeSt({ billingMonths: 12 })).monthly).toBe(98); // 97.50
    const result = validateAgreement(orangeSt({ billingMonths: 12 }));
    expect(result.ok && result.value.monthlyPrice).toBe(98);
  });

  it("a removed visit lowers the total (and the price) before saving", () => {
    const p = buildPreview(orangeSt({ removedDates: ["2026-03-03"] }));
    expect(p.visits).toHaveLength(17);
    expect(p.total).toBe(1105);
    expect(p.removedVisits.map((v) => v.date)).toEqual(["2026-03-03"]);
  });

  it("an added visit is marked as added", () => {
    const p = buildPreview(orangeSt({ addedDates: ["2026-10-29"] }));
    expect(p.visits).toHaveLength(19);
    expect(p.addedDates.has("2026-10-29")).toBe(true);
  });
});

describe("other agreement shapes", () => {
  it("an on-call per-visit agreement saves with no schedule", () => {
    const result = validateAgreement(
      orangeSt({ billingType: "per_visit", onCall: true, pricePerVisit: "65" })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.parts).toEqual([]);
    expect(result.value.visits).toEqual([]);
    expect(result.value.pricePerVisit).toBe(65);
    expect(result.value.billingMonths).toBeNull();
    expect(result.value.monthlyPrice).toBeNull();
  });

  it("a per-visit agreement with a schedule has no monthly price", () => {
    const result = validateAgreement(orangeSt({ billingType: "per_visit" }));
    expect(result.ok && result.value.monthlyPrice).toBeNull();
    expect(result.ok && result.value.billingMonths).toBeNull();
    expect(buildPreview(orangeSt({ billingType: "per_visit" })).monthly).toBeNull();
  });

  it("three parts crossing into the next year, entered out of order, are saved sorted", () => {
    const input = orangeSt({
      startDate: "2026-10-01",
      endDate: "2027-01-31",
      parts: [
        { startDate: "2027-01-04", endDate: "2027-01-31", intervalWeeks: 1, pricePerVisit: "60" },
        { startDate: "2026-10-05", endDate: "2026-11-30", intervalWeeks: 4, pricePerVisit: "80" },
        { startDate: "2026-12-07", endDate: "2026-12-31", intervalWeeks: 2, pricePerVisit: "70" },
      ],
    });
    const p = buildPreview(input);
    expect(p.visits).toHaveLength(9);
    expect(p.total).toBe(620);
    expect(p.billingMonths).toBe(4);
    expect(p.monthly).toBe(155);

    const result = validateAgreement(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.parts.map((x) => x.startDate)).toEqual([
      "2026-10-05",
      "2026-12-07",
      "2027-01-04",
    ]);
    // partIndex points into the sorted list.
    const jan = result.value.visits.find((v) => v.date === "2027-01-04")!;
    expect(result.value.parts[jan.partIndex!].pricePerVisit).toBe(60);
  });
});

describe("validateAgreement rejects", () => {
  it("garbage input with a message for each missing field", () => {
    const errors = expectErrors(null);
    expect(errors).toContain("Choose a service type.");
    expect(errors).toContain("Choose a billing type.");
    expect(errors).toContain("Enter the agreement's start date.");
    expect(errors).toContain("Add at least one schedule part.");
  });

  it("an end date before the start date", () => {
    expect(expectErrors(orangeSt({ endDate: "2026-03-01" }))).toContain(
      "The end date must be on or after the start date."
    );
  });

  it("a term longer than two years", () => {
    expect(expectErrors(orangeSt({ endDate: "2029-03-01" }))[0]).toMatch(/at most two years/);
  });

  it("a part outside the term, a bad interval and a missing price", () => {
    const errors = expectErrors(
      orangeSt({
        parts: [{ startDate: "2026-02-01", endDate: "2026-10-31", intervalWeeks: 6, pricePerVisit: "" }],
      })
    );
    expect(errors).toEqual([
      "Schedule: dates must fall within the agreement's start and end dates.",
      "Schedule: choose how often (every 1 to 4 weeks).",
      "Schedule: enter the price per visit.",
    ]);
  });

  it("overlapping parts", () => {
    const errors = expectErrors(
      orangeSt({
        parts: [
          { startDate: "2026-03-03", endDate: "2026-06-30", intervalWeeks: 2, pricePerVisit: "65" },
          { startDate: "2026-06-30", endDate: "2026-10-31", intervalWeeks: 1, pricePerVisit: "65" },
        ],
      })
    );
    expect(errors).toEqual(["Schedule parts 1 and 2 overlap."]);
  });

  it("an added date outside the term", () => {
    expect(expectErrors(orangeSt({ addedDates: ["2026-11-03"] }))).toEqual([
      "Added visit Nov 3, 2026 is outside the agreement's dates.",
    ]);
  });

  it("a schedule whose visits were all removed", () => {
    const visits = buildPreview(orangeSt()).visits.map((v) => v.date);
    expect(expectErrors(orangeSt({ removedDates: visits }))).toContain("The schedule has no visits.");
  });

  it("on call with flat monthly billing, or without a price", () => {
    expect(expectErrors(orangeSt({ onCall: true, pricePerVisit: "65" }))).toContain(
      "Only per-visit agreements can be on call."
    );
    expect(expectErrors(orangeSt({ billingType: "per_visit", onCall: true }))).toContain(
      "Enter the price per visit."
    );
  });

  it.each([0, 37, 2.5, "8"])("billing months %s", (billingMonths) => {
    expect(expectErrors({ ...orangeSt(), billingMonths })[0]).toMatch(/Billing months/);
  });
});

describe("agreementToInput", () => {
  const saved = {
    property_id: "p1",
    service_type_id: TYPE_ID,
    billing_type: "flat_monthly",
    start_date: "2026-03-03",
    end_date: "2026-10-31",
    billing_months: 8,
    price_per_visit: null,
    service_areas: "Back yard only",
    notes: null,
  };
  const parts = [{ start_date: "2026-03-03", end_date: "2026-10-31", interval_weeks: 2, price_per_visit: 65 }];

  it("round-trips a saved agreement, recovering manual date changes", () => {
    const original = orangeSt({
      propertyId: "p1",
      serviceAreas: "Back yard only",
      removedDates: ["2026-07-07"],
      addedDates: ["2026-07-09"],
      taskIds: ["t1"],
    });
    const result = validateAgreement(original);
    if (!result.ok) throw new Error(result.errors.join());
    const back = agreementToInput(
      saved,
      parts,
      result.value.visits.map((v) => v.date),
      ["t1"]
    );
    expect(back).toEqual(original);
  });

  it("keeps billing months only when they differ from the default", () => {
    const dates = buildPreview(orangeSt()).visits.map((v) => v.date);
    expect(agreementToInput({ ...saved, billing_months: 12 }, parts, dates, []).billingMonths).toBe(12);
    expect(agreementToInput(saved, parts, dates, []).billingMonths).toBeNull();
  });

  it("an on-call agreement comes back on call with its price", () => {
    const input = agreementToInput(
      { ...saved, billing_type: "per_visit", billing_months: null, price_per_visit: 65 },
      [],
      [],
      []
    );
    expect(input.onCall).toBe(true);
    expect(input.pricePerVisit).toBe("65");
  });
});

describe("renewalInput (Renew)", () => {
  it("moves the dates one calendar year and drops dates changed by hand", () => {
    const renewed = renewalInput(
      orangeSt({ removedDates: ["2026-07-07"], addedDates: ["2026-07-09"] })
    );
    expect(renewed.startDate).toBe("2027-03-03");
    expect(renewed.endDate).toBe("2027-10-31");
    expect(renewed.parts[0]).toMatchObject({ startDate: "2027-03-03", endDate: "2027-10-31" });
    expect(renewed.removedDates).toEqual([]);
    expect(renewed.addedDates).toEqual([]);
    expect(validateAgreement(renewed).ok).toBe(true);
  });

  it("keeps the season and the $146/month year after year, including leap years", () => {
    // The 52-week shift used before slid the season to Feb 29 2028 and $130/month.
    let input = orangeSt();
    for (const year of [2027, 2028, 2029, 2030]) {
      input = renewalInput(input);
      expect(input.startDate).toBe(`${year}-03-03`);
      expect(input.endDate).toBe(`${year}-10-31`);
      const p = buildPreview(input);
      expect(p.billingMonths).toBe(8);
      expect(p.monthly).toBe(146);
    }
  });

  it("keeps a three-part schedule crossing into the next year in order", () => {
    const renewed = renewalInput(
      orangeSt({
        startDate: "2026-10-01",
        endDate: "2027-01-31",
        parts: [
          { startDate: "2026-10-05", endDate: "2026-11-30", intervalWeeks: 4, pricePerVisit: "80" },
          { startDate: "2026-12-07", endDate: "2026-12-31", intervalWeeks: 2, pricePerVisit: "70" },
          { startDate: "2027-01-04", endDate: "2027-01-31", intervalWeeks: 1, pricePerVisit: "60" },
        ],
      })
    );
    expect(renewed.parts.map((p) => p.startDate)).toEqual(["2027-10-05", "2027-12-07", "2028-01-04"]);
    expect(validateAgreement(renewed).ok).toBe(true);
  });
});

describe("withTerm", () => {
  it("moves a single part that matches the old dates", () => {
    const next = withTerm(orangeSt(), "2026-03-10", "2026-10-30");
    expect(next.startDate).toBe("2026-03-10");
    expect(next.parts[0]).toMatchObject({ startDate: "2026-03-10", endDate: "2026-10-30" });
  });

  it("moves an empty part on a new agreement", () => {
    const next = withTerm(emptyAgreementInput(), "2027-03-01", "2027-10-31");
    expect(next.parts[0]).toMatchObject({ startDate: "2027-03-01", endDate: "2027-10-31" });
  });

  it("leaves a part with its own dates alone", () => {
    const input = orangeSt({ parts: [{ ...orangeSt().parts[0], startDate: "2026-04-07" }] });
    expect(withTerm(input, "2026-03-01", "2026-10-31").parts[0].startDate).toBe("2026-04-07");
  });

  it("leaves several parts alone", () => {
    const input = orangeSt({ parts: [orangeSt().parts[0], orangeSt().parts[0]] });
    expect(withTerm(input, "2026-03-10", "2026-10-31").parts[0].startDate).toBe("2026-03-03");
  });

  it("leaves the part alone once dates were changed by hand", () => {
    const input = orangeSt({ removedDates: ["2026-07-07"] });
    expect(withTerm(input, "2026-03-10", "2026-10-31").parts[0].startDate).toBe("2026-03-03");
  });
});

describe("newPart", () => {
  it("starts the day after the last part, at the first part's price and the last part's interval", () => {
    const input = orangeSt({
      endDate: "2026-12-31",
      parts: [
        { startDate: "2026-03-03", endDate: "2026-06-30", intervalWeeks: 2, pricePerVisit: "65" },
        { startDate: "2026-07-07", endDate: "2026-10-31", intervalWeeks: 1, pricePerVisit: "70" },
      ],
    });
    expect(newPart(input)).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-12-31",
      intervalWeeks: 1,
      pricePerVisit: "65",
    });
  });

  it("falls back to the agreement's start when the last part has no end date", () => {
    const input = orangeSt({ parts: [{ ...orangeSt().parts[0], endDate: "" }] });
    expect(newPart(input).startDate).toBe("2026-03-03");
  });
});

describe("agreed price on active agreements", () => {
  const saved = { status: "active", billing_type: "flat_monthly", billing_months: 8, monthly_price: 146 };

  it("agreedPrice is the saved price for active and ended flat-monthly agreements", () => {
    expect(agreedPrice(saved)).toEqual({ billingMonths: 8, monthlyPrice: 146 });
    expect(agreedPrice({ ...saved, status: "ended" })).toEqual({ billingMonths: 8, monthlyPrice: 146 });
  });

  it("drafts and per-visit agreements have none", () => {
    expect(agreedPrice({ ...saved, status: "draft" })).toBeNull();
    expect(
      agreedPrice({ status: "active", billing_type: "per_visit", billing_months: null, monthly_price: null })
    ).toBeNull();
  });

  it("removing a visit keeps $146/month unless recalculating", () => {
    const result = validateAgreement(orangeSt({ removedDates: ["2026-07-07"] }));
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.value.monthlyPrice).toBe(138); // round(1105 / 8)

    const kept = keepAgreedPrice(result.value, agreedPrice(saved), false);
    expect(kept.monthlyPrice).toBe(146);
    expect(kept.billingMonths).toBe(8);
    expect(kept.visits).toHaveLength(17);

    expect(keepAgreedPrice(result.value, agreedPrice(saved), true).monthlyPrice).toBe(138);
  });

  it("switching an agreement to per visit drops the monthly price", () => {
    const result = validateAgreement(orangeSt({ billingType: "per_visit" }));
    if (!result.ok) throw new Error(result.errors.join());
    expect(keepAgreedPrice(result.value, agreedPrice(saved), false).monthlyPrice).toBeNull();
  });
});
