import { describe, expect, it } from "vitest";
import { formatCurrency, invoiceTotals, lineComputations } from "./calc";
import { formatPlain } from "./format";

describe("lineComputations", () => {
  it("qty × price with no discount", () => {
    expect(lineComputations({ qty: 1, unit_price: 100, discount_pct: 0 })).toEqual({
      pretaxGross: 100,
      discountAmount: 0,
      total: 100,
    });
  });

  it("applies a percentage discount", () => {
    expect(lineComputations({ qty: 2, unit_price: 50, discount_pct: 10 })).toEqual({
      pretaxGross: 100,
      discountAmount: 10,
      total: 90,
    });
  });

  it.each([
    ["zero qty", { qty: 0, unit_price: 80, discount_pct: 0 }],
    ["zero price", { qty: 3, unit_price: 0, discount_pct: 0 }],
    ["100% discount", { qty: 3, unit_price: 80, discount_pct: 100 }],
  ])("%s gives a total of 0", (_name, item) => {
    expect(lineComputations(item).total).toBe(0);
  });

  it("handles fractional quantities (e.g. 1.5 hours)", () => {
    const { total } = lineComputations({ qty: 1.5, unit_price: 60, discount_pct: 0 });
    expect(total).toBe(90);
  });
});

describe("invoiceTotals", () => {
  it("is all zeros for an invoice with no lines", () => {
    expect(invoiceTotals([], 0.07)).toEqual({
      netPrice: 0,
      discountTotal: 0,
      tax: 0,
      totalPrice: 0,
      amountDue: 0,
    });
  });

  it("sums line totals and discounts, then adds tax", () => {
    const t = invoiceTotals(
      [
        { qty: 2, unit_price: 50, discount_pct: 10 }, // 90, discount 10
        { qty: 1, unit_price: 200, discount_pct: 0 }, // 200
      ],
      0.07
    );
    expect(t.netPrice).toBe(290);
    expect(t.discountTotal).toBe(10);
    expect(t.tax).toBeCloseTo(20.3, 10);
    expect(t.totalPrice).toBeCloseTo(310.3, 10);
  });

  it.each([0, 0.07, 1])("amount due equals total price at tax rate %s", (rate) => {
    const t = invoiceTotals([{ qty: 3, unit_price: 19.99, discount_pct: 0 }], rate);
    expect(t.amountDue).toBe(t.totalPrice);
    expect(t.tax).toBeCloseTo(t.netPrice * rate, 10);
  });

  // KNOWN GAP G1 (docs/test-plan.md): amounts are never rounded to cents, so the
  // line totals printed on the invoice can add up to a different net price than
  // the one printed. 3 lines of 12.375 print as 12.38 each (37.14) but the net
  // prints as 37.13. `it.fails` passes while the bug exists; once a rounding
  // rule is added this test will fail, and should be changed to a normal `it`.
  it.fails("G1: printed line totals add up to the printed net price", () => {
    const item = { qty: 1, unit_price: 12.5, discount_pct: 1 }; // total 12.375
    const items = [item, item, item];
    const printedLines = items.map((i) => Number(formatPlain(lineComputations(i).total)));
    const printedSum = printedLines.reduce((a, b) => a + b, 0);
    const printedNet = Number(formatPlain(invoiceTotals(items, 0).netPrice));
    expect(printedSum).toBeCloseTo(printedNet, 10);
  });
});

describe("formatCurrency", () => {
  it.each([
    [0, "$0.00"],
    [1234.5, "$1,234.50"],
    [1_000_000, "$1,000,000.00"],
    [-5, "-$5.00"],
  ])("%s → %s", (value, expected) => {
    expect(formatCurrency(value)).toBe(expected);
  });
});
