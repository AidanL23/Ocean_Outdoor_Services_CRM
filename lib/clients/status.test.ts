import { describe, expect, it } from "vitest";
import {
  CLIENT_STATUSES,
  DEFAULT_CLIENT_STATUS,
  isClientStatus,
  parseClientStatus,
} from "./status";

const VALID = ["lead", "active", "declined", "past"];

describe("CLIENT_STATUSES", () => {
  it("matches the database CHECK constraint, in display order", () => {
    // Keep in sync with supabase/migrations/001_client_status.sql
    expect(CLIENT_STATUSES.map((s) => s.value)).toEqual(VALID);
  });

  it("has unique labels for the filter and badge", () => {
    const labels = CLIENT_STATUSES.map((s) => s.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("defaults new clients to Lead", () => {
    expect(DEFAULT_CLIENT_STATUS).toBe("lead");
    expect(isClientStatus(DEFAULT_CLIENT_STATUS)).toBe(true);
  });
});

describe("isClientStatus", () => {
  it.each(VALID)("accepts %s", (value) => {
    expect(isClientStatus(value)).toBe(true);
  });

  it.each([
    ["the old 'inactive' value", "inactive"],
    ["wrong case", "Active"],
    ["trailing space", "lead "],
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
    ["an array (repeated ?status= params)", ["lead", "past"]],
  ])("rejects %s", (_name, value) => {
    expect(isClientStatus(value)).toBe(false);
  });
});

describe("parseClientStatus", () => {
  it.each(VALID)("returns %s unchanged", (value) => {
    expect(parseClientStatus(value)).toBe(value);
  });

  it.each([["inactive"], ["bogus"], [""], [null]])("throws on %s", (value) => {
    expect(() => parseClientStatus(value)).toThrow("Invalid client status");
  });

  it("throws on a file upload in place of a status", () => {
    const file = new File(["x"], "status.txt");
    expect(() => parseClientStatus(file)).toThrow("Invalid client status");
  });
});
