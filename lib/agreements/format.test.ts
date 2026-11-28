import { describe, expect, it } from "vitest";
import { agreementPriceLabel, agreementsSummary, currentPerType, formatMoney } from "./format";
import { AGREEMENT_STATUSES, BILLING_TYPES, statusAfterSave } from "./constants";

describe("formatMoney", () => {
  it.each([
    [146, "$146"],
    [1170, "$1,170"],
    [65.5, "$65.50"],
    [0, "$0"],
  ])("%s → %s", (amount, expected) => expect(formatMoney(amount)).toBe(expected));
});

describe("agreementPriceLabel", () => {
  const base = { monthly_price: null, price_per_visit: null, partPrices: [] };

  it("flat monthly", () => {
    expect(agreementPriceLabel({ ...base, billing_type: "flat_monthly", monthly_price: 146 })).toBe(
      "$146/month"
    );
  });

  it("per visit, one price or a range", () => {
    expect(agreementPriceLabel({ ...base, billing_type: "per_visit", partPrices: [65, 65] })).toBe(
      "$65/visit"
    );
    expect(agreementPriceLabel({ ...base, billing_type: "per_visit", partPrices: [80, 60] })).toBe(
      "$60–$80/visit"
    );
  });

  it("on call", () => {
    expect(agreementPriceLabel({ ...base, billing_type: "per_visit", price_per_visit: 65 })).toBe(
      "$65/visit, on call"
    );
  });

  it("missing price", () => {
    expect(agreementPriceLabel({ ...base, billing_type: "flat_monthly" })).toBe("No price yet");
  });
});

describe("agreementsSummary", () => {
  it("one agreement shows just the price", () => {
    expect(agreementsSummary([{ typeName: "Lawn care", label: "$146/month" }])).toBe("$146/month");
  });

  it("several are prefixed with their type", () => {
    expect(
      agreementsSummary([
        { typeName: "Lawn care", label: "$146/month" },
        { typeName: "Leaf cleanup", label: "$65/visit" },
      ])
    ).toBe("Lawn care $146/month · Leaf cleanup $65/visit");
  });
});

describe("constants", () => {
  it("values are unique", () => {
    for (const list of [BILLING_TYPES, AGREEMENT_STATUSES]) {
      expect(new Set(list.map((x) => x.value)).size).toBe(list.length);
    }
  });

  it("statusAfterSave: drafts activate; active and ended keep their status", () => {
    expect(statusAfterSave(null, "draft")).toBe("draft");
    expect(statusAfterSave(null, "activate")).toBe("active");
    expect(statusAfterSave("draft", "activate")).toBe("active");
    expect(statusAfterSave("draft", "save")).toBe("draft");
    expect(statusAfterSave("active", "draft")).toBe("active");
    expect(statusAfterSave("ended", "activate")).toBe("ended");
  });
});

describe("currentPerType", () => {
  const lawn2026 = { id: "a", typeId: "lawn", start_date: "2026-03-03", end_date: "2026-10-31" };
  const lawn2027 = { id: "b", typeId: "lawn", start_date: "2027-03-03", end_date: "2027-10-31" };
  const leaf = { id: "c", typeId: "leaf", start_date: "2026-10-01", end_date: "2027-01-31" };

  it("shows the agreement running today, not its renewal", () => {
    expect(currentPerType([lawn2026, lawn2027], "2026-07-01").map((a) => a.id)).toEqual(["a"]);
  });

  it("between seasons, shows the next one to start", () => {
    expect(currentPerType([lawn2026, lawn2027], "2026-11-27").map((a) => a.id)).toEqual(["b"]);
  });

  it("with nothing running or ahead, shows the one that ended last", () => {
    const lawn2025 = { id: "z", typeId: "lawn", start_date: "2025-03-04", end_date: "2025-10-31" };
    expect(currentPerType([lawn2025, lawn2026], "2026-12-01").map((a) => a.id)).toEqual(["a"]);
  });

  it("keeps one per service type, in the incoming order", () => {
    expect(currentPerType([leaf, lawn2027, lawn2026], "2026-11-27").map((a) => a.id)).toEqual(["c", "b"]);
  });
});
