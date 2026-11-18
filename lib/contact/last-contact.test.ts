import { describe, expect, it } from "vitest";
import {
  CONTACT_LEVELS,
  DEFAULT_CONTACT_THRESHOLDS,
  UNTRACKED_CONTACT_CELL,
  calendarDate,
  contactLevel,
  daysSince,
  describeLastContact,
  formatDaysAgo,
  parseClientSort,
  parseContactDateTime,
  parseThresholds,
  sortByLastContact,
  toDateTimeLocalValue,
  validateThresholds,
} from "./last-contact";
import { tracksLastContact } from "@/lib/clients/status";

const TZ = "America/New_York";
// 10:00 am Eastern (EST, UTC-5) on Tue 17 Nov 2026.
const NOW = new Date("2026-11-17T15:00:00Z");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("contactLevel with the default thresholds (green ≤ 14, yellow ≤ 30)", () => {
  it.each([
    [0, "green"],
    [14, "green"],
    [15, "yellow"],
    [30, "yellow"],
    [31, "red"],
    [400, "red"],
  ] as const)("%i days is %s", (days, level) => {
    expect(contactLevel(days, DEFAULT_CONTACT_THRESHOLDS)).toBe(level);
  });

  it("never contacted is grey", () => {
    expect(contactLevel(null, DEFAULT_CONTACT_THRESHOLDS)).toBe("never");
  });

  it("respects custom thresholds", () => {
    const t = { greenDays: 7, yellowDays: 10 };
    expect(contactLevel(7, t)).toBe("green");
    expect(contactLevel(8, t)).toBe("yellow");
    expect(contactLevel(11, t)).toBe("red");
  });

  it("green 0 means only today is green", () => {
    const t = { greenDays: 0, yellowDays: 1 };
    expect(contactLevel(0, t)).toBe("green");
    expect(contactLevel(1, t)).toBe("yellow");
    expect(contactLevel(2, t)).toBe("red");
  });
});

describe("validateThresholds / parseThresholds", () => {
  it("accepts the defaults, which match the migration defaults", () => {
    expect(DEFAULT_CONTACT_THRESHOLDS).toEqual({ greenDays: 14, yellowDays: 30 });
    expect(validateThresholds(DEFAULT_CONTACT_THRESHOLDS)).toBeNull();
  });

  it.each([
    ["yellow equal to green", { greenDays: 14, yellowDays: 14 }],
    ["yellow below green", { greenDays: 30, yellowDays: 14 }],
    ["negative green", { greenDays: -1, yellowDays: 30 }],
    ["fractional days", { greenDays: 14.5, yellowDays: 30 }],
    ["NaN", { greenDays: NaN, yellowDays: 30 }],
    ["absurdly large", { greenDays: 14, yellowDays: 100000 }],
  ])("rejects %s", (_name, t) => {
    expect(validateThresholds(t)).toEqual(expect.any(String));
  });

  it("parses form fields", () => {
    expect(parseThresholds(form({ green_days: "7", yellow_days: "21" }))).toEqual({
      ok: true,
      value: { greenDays: 7, yellowDays: 21 },
    });
  });

  it.each([
    [{ green_days: "", yellow_days: "30" }],
    [{ green_days: "abc", yellow_days: "30" }],
    [{ yellow_days: "30" }],
    [{ green_days: "20", yellow_days: "10" }],
  ])("returns an error for %j", (fields) => {
    const result = parseThresholds(form(fields));
    expect(result.ok).toBe(false);
  });
});

describe("daysSince (calendar days in the business time zone)", () => {
  it("is 0 earlier the same day", () => {
    expect(daysSince("2026-11-17T05:30:00Z", NOW, TZ)).toBe(0); // 12:30 am Eastern
  });

  it("counts 11 pm yesterday as 1 day, though under 24 hours have passed", () => {
    expect(daysSince("2026-11-17T04:00:00Z", NOW, TZ)).toBe(1); // 11 pm Mon Eastern
  });

  it("counts 12 days", () => {
    expect(daysSince("2026-11-05T20:00:00Z", NOW, TZ)).toBe(12);
  });

  it("is not thrown off by the daylight-saving change (1 Nov 2026)", () => {
    expect(daysSince("2026-10-31T16:00:00Z", NOW, TZ)).toBe(17);
  });

  it("never goes negative for a future timestamp", () => {
    expect(daysSince("2026-11-20T15:00:00Z", NOW, TZ)).toBe(0);
  });

  it("is null when never contacted or unparseable", () => {
    expect(daysSince(null, NOW, TZ)).toBeNull();
    expect(daysSince("not a date", NOW, TZ)).toBeNull();
  });
});

describe("formatDaysAgo", () => {
  it.each([
    [null, "Never"],
    [0, "Today"],
    [1, "Yesterday"],
    [2, "2 days ago"],
    [30, "30 days ago"],
    [400, "400 days ago"],
    [-3, "Today"],
  ])("%s → %s", (days, text) => {
    expect(formatDaysAgo(days)).toBe(text);
  });
});

describe("describeLastContact", () => {
  it("colours a tracked client by level, with the date in the tooltip", () => {
    const lc = describeLastContact("2026-10-01T15:00:00Z", NOW, TZ, DEFAULT_CONTACT_THRESHOLDS);
    expect(lc.level).toBe("red");
    expect(lc.text).toBe("47 days ago");
    expect(lc.className).toBe(CONTACT_LEVELS.red.cell);
    expect(lc.title).toContain("Oct 1, 2026");
  });

  it("keeps the text but drops the colour for untracked (Declined/Past) clients", () => {
    const lc = describeLastContact("2026-10-01T15:00:00Z", NOW, TZ, DEFAULT_CONTACT_THRESHOLDS, {
      tracked: false,
    });
    expect(lc.text).toBe("47 days ago");
    expect(lc.className).toBe(UNTRACKED_CONTACT_CELL);
  });

  it("shows Never in grey either way", () => {
    for (const tracked of [true, false]) {
      const lc = describeLastContact(null, NOW, TZ, DEFAULT_CONTACT_THRESHOLDS, { tracked });
      expect(lc.text).toBe("Never");
      expect(lc.className).toBe(CONTACT_LEVELS.never.cell);
    }
  });
});

describe("tracksLastContact", () => {
  it.each([
    ["lead", true],
    ["active", true],
    ["declined", false],
    ["past", false],
    [null, false],
  ])("%s → %s", (status, tracked) => {
    expect(tracksLastContact(status)).toBe(tracked);
  });
});

describe("toDateTimeLocalValue / calendarDate", () => {
  it("gives the Eastern wall-clock time", () => {
    expect(toDateTimeLocalValue(NOW, TZ)).toBe("2026-11-17T10:00");
    expect(calendarDate(NOW, TZ)).toBe("2026-11-17");
  });

  it("uses the Eastern date, not the UTC date, late in the evening", () => {
    const evening = new Date("2026-11-18T03:30:00Z"); // 10:30 pm Tue Eastern
    expect(calendarDate(evening, TZ)).toBe("2026-11-17");
    expect(toDateTimeLocalValue(evening, TZ)).toBe("2026-11-17T22:30");
  });
});

describe("parseContactDateTime", () => {
  const CHANGED = true; // the user picked a time in the field

  it.each([[null], [""], ["   "]])("treats %j as now", (value) => {
    expect(parseContactDateTime(value, CHANGED, NOW, TZ)).toBe(NOW);
  });

  it("treats an unchanged field as now, not the time the page loaded", () => {
    expect(parseContactDateTime("2026-11-17T09:40", false, NOW, TZ)).toBe(NOW);
  });

  it("keeps a picked time even if it equals the page-load default", () => {
    expect(parseContactDateTime("2026-11-17T09:40", CHANGED, NOW, TZ).toISOString()).toBe(
      "2026-11-17T14:40:00.000Z"
    );
  });

  it.each([
    ["after clocks go back (1 Nov, 3 am EST)", "2026-11-01T03:00", "2026-11-01T08:00:00.000Z"],
    ["before clocks go back (1 Nov, midnight EDT)", "2026-11-01T00:30", "2026-11-01T04:30:00.000Z"],
    ["after clocks go forward (8 Mar, 5 am EDT)", "2026-03-08T05:00", "2026-03-08T09:00:00.000Z"],
    ["before clocks go forward (8 Mar, 1 am EST)", "2026-03-08T01:00", "2026-03-08T06:00:00.000Z"],
  ])("handles the daylight-saving change: %s", (_name, value, iso) => {
    expect(parseContactDateTime(value, CHANGED, NOW, TZ).toISOString()).toBe(iso);
  });

  it("reads a back-dated time as Eastern (standard time)", () => {
    expect(parseContactDateTime("2026-11-10T14:30", CHANGED, NOW, TZ).toISOString()).toBe(
      "2026-11-10T19:30:00.000Z"
    );
  });

  it("reads a back-dated time as Eastern (daylight time)", () => {
    expect(parseContactDateTime("2026-07-04T09:00", CHANGED, NOW, TZ).toISOString()).toBe(
      "2026-07-04T13:00:00.000Z"
    );
  });

  it("accepts seconds if the browser sends them", () => {
    expect(parseContactDateTime("2026-11-10T14:30:00", CHANGED, NOW, TZ).toISOString()).toBe(
      "2026-11-10T19:30:00.000Z"
    );
  });

  it("accepts the current minute", () => {
    expect(parseContactDateTime("2026-11-17T10:00", CHANGED, NOW, TZ)).toEqual(NOW);
  });

  it.each([["2026-11-17T10:01"], ["2026-11-18T08:00"], ["2027-01-01T00:00"]])(
    "rejects the future: %s",
    (value) => {
      expect(() => parseContactDateTime(value, CHANGED, NOW, TZ)).toThrow(
        "Contact date can't be in the future"
      );
    }
  );

  it.each([["2026-02-30T10:00"], ["2026-11-10T24:00"], ["2026-11-10T10:60"], ["2026-11-10"], ["yesterday"]])(
    "rejects invalid %s",
    (value) => {
      expect(() => parseContactDateTime(value, CHANGED, NOW, TZ)).toThrow("Invalid contact date");
    }
  );

  it("rejects a file upload in place of a date", () => {
    const file = new File(["x"], "date.txt");
    expect(() => parseContactDateTime(file, CHANGED, NOW, TZ)).toThrow("Invalid contact date");
  });
});

describe("sorting the clients list", () => {
  const rows = [
    { name: "Ann", lastContactAt: "2026-11-10T15:00:00Z" },
    { name: "Bob", lastContactAt: null },
    { name: "Cat", lastContactAt: "2026-09-01T15:00:00Z" },
    { name: "Dan", lastContactAt: null },
    { name: "Eve", lastContactAt: "2026-11-16T15:00:00Z" },
  ];
  const names = (r: typeof rows) => r.map((x) => x.name);

  it("parses the sort param, falling back to name", () => {
    expect(parseClientSort("last_contact")).toBe("last_contact");
    expect(parseClientSort("-last_contact")).toBe("-last_contact");
    expect(parseClientSort("bogus")).toBe("name");
    expect(parseClientSort(["last_contact"])).toBe("name");
    expect(parseClientSort(undefined)).toBe("name");
  });

  it("name keeps the incoming (alphabetical) order", () => {
    expect(names(sortByLastContact(rows, "name"))).toEqual(["Ann", "Bob", "Cat", "Dan", "Eve"]);
  });

  it("last_contact puts never-contacted first, then longest ago", () => {
    expect(names(sortByLastContact(rows, "last_contact"))).toEqual(["Bob", "Dan", "Cat", "Ann", "Eve"]);
  });

  it("-last_contact puts most recent first, never-contacted last", () => {
    expect(names(sortByLastContact(rows, "-last_contact"))).toEqual(["Eve", "Ann", "Cat", "Bob", "Dan"]);
  });

  it("does not modify the input", () => {
    const copy = [...rows];
    sortByLastContact(rows, "last_contact");
    expect(rows).toEqual(copy);
  });
});
