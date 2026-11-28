import { describe, expect, it } from "vitest";
import {
  listErrorMessage,
  parseServiceTaskForm,
  parseServiceTypeForm,
  submittedListValues,
} from "./service-lists";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseServiceTypeForm", () => {
  it("reads a type with a season", () => {
    expect(
      parseServiceTypeForm(
        form({ name: " Lawn care ", default_start_month: "3", default_end_month: "10", sort_order: "1", active: "on" })
      )
    ).toEqual({
      ok: true,
      value: { name: "Lawn care", default_start_month: 3, default_end_month: 10, sort_order: 1, active: true },
    });
  });

  it("allows no season, blank order and inactive", () => {
    const result = parseServiceTypeForm(form({ name: "Other", default_start_month: "", default_end_month: "" }));
    expect(result).toEqual({
      ok: true,
      value: { name: "Other", default_start_month: null, default_end_month: null, sort_order: null, active: false },
    });
  });

  it("allows a season that crosses the year", () => {
    const result = parseServiceTypeForm(form({ name: "Leaf", default_start_month: "10", default_end_month: "1" }));
    expect(result.ok).toBe(true);
  });

  it.each([
    [{ name: "" }, "Enter a name."],
    [{ name: "x".repeat(61) }, "Keep the name under 60 characters."],
    [{ name: "Lawn", default_start_month: "3" }, "Choose both season months, or neither."],
    [{ name: "Lawn", default_start_month: "13", default_end_month: "1" }, "Choose a month."],
    [{ name: "Lawn", sort_order: "-1" }, "Order must be a whole number from 0 to 9999."],
    [{ name: "Lawn", sort_order: "1.5" }, "Order must be a whole number from 0 to 9999."],
  ])("rejects %j", (fields, error) => {
    expect(parseServiceTypeForm(form(fields))).toEqual({ ok: false, error });
  });
});

describe("parseServiceTaskForm", () => {
  it("reads a task", () => {
    expect(parseServiceTaskForm(form({ name: "Mowing", sort_order: "2", active: "on" }))).toEqual({
      ok: true,
      value: { name: "Mowing", sort_order: 2, active: true },
    });
  });
});

describe("listErrorMessage", () => {
  it("explains duplicate names", () => {
    expect(listErrorMessage({ code: "23505", message: "duplicate key" })).toBe(
      "That name is already in the list."
    );
    expect(listErrorMessage({ message: "boom" })).toBe("boom");
  });
});

describe("submittedListValues", () => {
  it("keeps what was typed, with blanks for missing fields", () => {
    expect(submittedListValues(form({ name: "mowing", sort_order: "3" }))).toEqual({
      name: "mowing",
      default_start_month: "",
      default_end_month: "",
      sort_order: "3",
      active: "",
    });
  });
});
