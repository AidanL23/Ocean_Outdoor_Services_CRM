import { describe, expect, it } from "vitest";
import {
  addDays,
  addYears,
  applyDateChanges,
  billedDifference,
  diffDateChanges,
  formatMonth,
  generateVisits,
  groupByMonth,
  isYmd,
  monthlyPrice,
  monthsWithVisits,
  nextSeasonDates,
  partDates,
  priceForDate,
  visitTotal,
  type SchedulePart,
} from "./schedule";

const weekday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

// 702 Orange St, 2026: every other Tuesday from Mar 3 to Oct 31 at $65.
const ORANGE_ST: SchedulePart = {
  startDate: "2026-03-03",
  endDate: "2026-10-31",
  intervalWeeks: 2,
  pricePerVisit: 65,
};

describe("isYmd", () => {
  it.each(["2026-03-03", "2028-02-29"])("accepts %s", (d) => expect(isYmd(d)).toBe(true));
  it.each(["", "2026-3-3", "2026-02-30", "2027-02-29", "2026-13-01", null, 20260303])(
    "rejects %s",
    (d) => expect(isYmd(d)).toBe(false)
  );
});

describe("addDays", () => {
  it("crosses month, year and daylight-saving boundaries without drift", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08"); // DST starts Mar 8 in the US
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-03", -3)).toBe("2026-02-28");
  });
});

describe("partDates", () => {
  it("702 Orange St: 18 Tuesdays from Mar 3 to Oct 27", () => {
    const dates = partDates(ORANGE_ST);
    expect(dates).toHaveLength(18);
    expect(dates[0]).toBe("2026-03-03");
    expect(dates[1]).toBe("2026-03-17");
    expect(dates.at(-1)).toBe("2026-10-27");
    expect(dates.every((d) => weekday(d) === 2)).toBe(true);
  });

  it("includes the end date when a visit falls on it", () => {
    expect(partDates({ startDate: "2026-03-03", endDate: "2026-03-17", intervalWeeks: 1 })).toEqual([
      "2026-03-03",
      "2026-03-10",
      "2026-03-17",
    ]);
  });

  it("a one-day part has one visit", () => {
    expect(partDates({ startDate: "2026-05-05", endDate: "2026-05-05", intervalWeeks: 4 })).toEqual([
      "2026-05-05",
    ]);
  });

  it.each([0, 5, 1.5, NaN])("interval %s gives no dates", (intervalWeeks) => {
    expect(partDates({ startDate: "2026-03-03", endDate: "2026-10-31", intervalWeeks })).toEqual([]);
  });

  it("missing or reversed dates give no dates", () => {
    expect(partDates({ startDate: "", endDate: "2026-10-31", intervalWeeks: 1 })).toEqual([]);
    expect(partDates({ startDate: "2026-10-31", endDate: "2026-03-01", intervalWeeks: 1 })).toEqual([]);
  });
});

describe("pricing", () => {
  it("702 Orange St: $1,170 over 8 months is $146/month, $2 under the visits", () => {
    const visits = generateVisits([ORANGE_ST]);
    const total = visitTotal(visits);
    const months = monthsWithVisits(visits);
    expect(total).toBe(1170);
    expect(months).toBe(8);
    expect(monthlyPrice(total, months)).toBe(146);
    expect(billedDifference(146, months, total)).toBe(-2);
  });

  it("rounds the monthly price to the nearest whole dollar", () => {
    expect(monthlyPrice(1000, 3)).toBe(333); // 333.33
    expect(monthlyPrice(1001, 2)).toBe(501); // 500.50 rounds up
    expect(monthlyPrice(100, 1)).toBe(100);
  });

  it("sums cents exactly", () => {
    expect(visitTotal([{ price: 0.1 }, { price: 0.2 }])).toBe(0.3);
    expect(visitTotal([])).toBe(0);
  });

  it("billed difference can be positive", () => {
    expect(billedDifference(334, 3, 1000)).toBe(2);
  });
});

describe("a three-part agreement crossing into the next year", () => {
  // Every 4 weeks Oct–Nov, every 2 weeks in Dec, weekly in January, all Mondays.
  const parts: SchedulePart[] = [
    { startDate: "2026-10-05", endDate: "2026-11-30", intervalWeeks: 4, pricePerVisit: 80 },
    { startDate: "2026-12-07", endDate: "2026-12-31", intervalWeeks: 2, pricePerVisit: 70 },
    { startDate: "2027-01-04", endDate: "2027-01-31", intervalWeeks: 1, pricePerVisit: 60 },
  ];
  const visits = generateVisits(parts);

  it("generates each part's dates in order, with its price", () => {
    expect(visits.map((v) => v.date)).toEqual([
      "2026-10-05",
      "2026-11-02",
      "2026-11-30",
      "2026-12-07",
      "2026-12-21",
      "2027-01-04",
      "2027-01-11",
      "2027-01-18",
      "2027-01-25",
    ]);
    expect(visits.map((v) => v.partIndex)).toEqual([0, 0, 0, 1, 1, 2, 2, 2, 2]);
    expect(visits[3].price).toBe(70);
  });

  it("counts months across the year boundary", () => {
    expect(monthsWithVisits(visits)).toBe(4); // Oct, Nov, Dec 2026, Jan 2027
    const total = visitTotal(visits); // 3×80 + 2×70 + 4×60
    expect(total).toBe(620);
    expect(monthlyPrice(total, 4)).toBe(155);
  });

  it("groups by month in date order, labelled with the year", () => {
    const groups = groupByMonth(visits);
    expect(groups.map((g) => g.label)).toEqual([
      "October 2026",
      "November 2026",
      "December 2026",
      "January 2027",
    ]);
    expect(groups.map((g) => g.visits.length)).toEqual([1, 2, 2, 4]);
  });

  it("an added date takes the price of the part it falls in", () => {
    expect(priceForDate("2026-12-14", parts)).toBe(70);
    expect(priceForDate("2027-02-15", parts)).toBe(80); // outside every part: first part's
    expect(priceForDate("2027-02-15", [])).toBe(0);
  });
});

describe("manual date changes", () => {
  const generated = generateVisits([ORANGE_ST]);

  it("removes and adds dates, keeping one visit per date", () => {
    const visits = applyDateChanges(
      generated,
      { removed: ["2026-03-03", "2026-07-07"], added: ["2026-03-05", "2026-03-17", "2026-03-05"] },
      [ORANGE_ST]
    );
    expect(visits).toHaveLength(17);
    expect(visits[0]).toEqual({ date: "2026-03-05", price: 65, partIndex: null });
    expect(visits[1].date).toBe("2026-03-17");
    expect(visits[1].partIndex).toBe(0); // already generated, not doubled
  });

  it("diffDateChanges recovers the changes from the saved dates", () => {
    const saved = [...generated.map((v) => v.date).filter((d) => d !== "2026-07-07"), "2026-11-03"];
    expect(diffDateChanges(generated.map((v) => v.date), saved)).toEqual({
      removed: ["2026-07-07"],
      added: ["2026-11-03"],
    });
  });
});

describe("nextSeasonDates", () => {
  it("Lawn care (Mar–Oct) from late November starts next March", () => {
    expect(nextSeasonDates(3, 10, "2026-11-24")).toEqual({
      startDate: "2027-03-01",
      endDate: "2027-10-31",
    });
  });

  it("uses this year while the start month is still ahead", () => {
    expect(nextSeasonDates(3, 10, "2026-01-15")).toEqual({
      startDate: "2026-03-01",
      endDate: "2026-10-31",
    });
  });

  it("during the start month, starts today rather than in the past", () => {
    expect(nextSeasonDates(3, 10, "2026-03-20")).toEqual({
      startDate: "2026-03-20",
      endDate: "2026-10-31",
    });
    expect(nextSeasonDates(3, 10, "2026-03-01")?.startDate).toBe("2026-03-01");
    expect(nextSeasonDates(10, 1, "2026-10-15")).toEqual({
      startDate: "2026-10-15",
      endDate: "2027-01-31",
    });
  });

  it("Leaf cleanup (Oct–Jan) ends in January of the following year", () => {
    expect(nextSeasonDates(10, 1, "2026-11-24")).toEqual({
      startDate: "2027-10-01",
      endDate: "2028-01-31",
    });
    expect(nextSeasonDates(10, 1, "2026-06-01")).toEqual({
      startDate: "2026-10-01",
      endDate: "2027-01-31",
    });
  });

  it("ends on the last day of February, including leap years", () => {
    expect(nextSeasonDates(1, 2, "2027-12-01")?.endDate).toBe("2028-02-29");
    expect(nextSeasonDates(1, 2, "2026-12-01")?.endDate).toBe("2027-02-28");
  });

  it("no default season gives null", () => {
    expect(nextSeasonDates(null, null, "2026-11-24")).toBeNull();
  });
});

describe("addYears", () => {
  it("keeps the calendar date", () => {
    expect(addYears("2026-03-03", 1)).toBe("2027-03-03");
    expect(addYears("2026-10-31", 1)).toBe("2027-10-31");
    expect(addYears("2027-12-31", 1)).toBe("2028-12-31");
  });

  it("Feb 29 becomes Feb 28 in a year without one", () => {
    expect(addYears("2028-02-29", 1)).toBe("2029-02-28");
    expect(addYears("2027-02-28", 1)).toBe("2028-02-28");
  });
});

describe("formatMonth", () => {
  it("has no time zone drift on the 1st", () => {
    expect(formatMonth("2026-03")).toBe("March 2026");
  });
});
