import { describe, expect, it } from "vitest";
import { formatLongDate, formatPlain, formatShortDate, splitAddress } from "./format";

describe("formatPlain", () => {
  it.each([
    [0, "0.00"],
    [5, "5.00"],
    [1234.5, "1,234.50"],
    [0.125, "0.13"],
  ])("%s → %s", (value, expected) => {
    expect(formatPlain(value)).toBe(expected);
  });
});

describe("invoice dates", () => {
  it("returns an empty string for a missing date", () => {
    expect(formatLongDate(null)).toBe("");
    expect(formatShortDate(null)).toBe("");
    expect(formatLongDate("")).toBe("");
  });

  // Dates are stored as plain YYYY-MM-DD. They must print as that same day,
  // not shift a day back because of a UTC conversion.
  it.each([
    ["2026-01-31", "Jan 31, 2026", "1/31/2026"],
    ["2026-03-01", "Mar 1, 2026", "3/1/2026"],
    ["2026-12-31", "Dec 31, 2026", "12/31/2026"],
  ])("%s prints as the same calendar day", (input, long, short) => {
    expect(formatLongDate(input)).toBe(long);
    expect(formatShortDate(input)).toBe(short);
  });
});

describe("splitAddress", () => {
  it("returns blank lines when there is no address (job with no property)", () => {
    expect(splitAddress(null)).toEqual({ line1: "", line2: "" });
  });

  it("puts an address with no comma on line 1", () => {
    expect(splitAddress("  12 Ocean Ave  ")).toEqual({ line1: "12 Ocean Ave", line2: "" });
  });

  it("splits on the first comma and trims both parts", () => {
    expect(splitAddress("12 Ocean Ave ,  Wildwood")).toEqual({
      line1: "12 Ocean Ave",
      line2: "Wildwood",
    });
  });

  it("keeps everything after the first comma on line 2", () => {
    expect(splitAddress("12 Ocean Ave, Wildwood, NJ 08260")).toEqual({
      line1: "12 Ocean Ave",
      line2: "Wildwood, NJ 08260",
    });
  });
});
