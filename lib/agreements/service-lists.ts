// Parsing the Settings forms for the service type and task lists. Pure, unit tested
// in service-lists.test.ts.

type FormLike = { get(name: string): FormDataEntryValue | null };

const MAX_NAME_LENGTH = 60;
const MAX_SORT_ORDER = 9999;

type ListItem = { name: string; sort_order: number | null; active: boolean };
export type ServiceTypeFields = ListItem & {
  default_start_month: number | null;
  default_end_month: number | null;
};

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseItem(form: FormLike): Parsed<ListItem> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter a name." };
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Keep the name under ${MAX_NAME_LENGTH} characters.` };
  }
  const order = String(form.get("sort_order") ?? "").trim();
  let sortOrder: number | null = null;
  if (order !== "") {
    sortOrder = Number(order);
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > MAX_SORT_ORDER) {
      return { ok: false, error: `Order must be a whole number from 0 to ${MAX_SORT_ORDER}.` };
    }
  }
  return { ok: true, value: { name, sort_order: sortOrder, active: form.get("active") === "on" } };
}

function parseMonth(value: FormDataEntryValue | null): number | null | "invalid" {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : "invalid";
}

/** Blank order means "put it at the end"; the action fills that in. */
export function parseServiceTypeForm(form: FormLike): Parsed<ServiceTypeFields> {
  const item = parseItem(form);
  if (!item.ok) return item;
  const start = parseMonth(form.get("default_start_month"));
  const end = parseMonth(form.get("default_end_month"));
  if (start === "invalid" || end === "invalid") return { ok: false, error: "Choose a month." };
  if ((start === null) !== (end === null)) {
    return { ok: false, error: "Choose both season months, or neither." };
  }
  return { ok: true, value: { ...item.value, default_start_month: start, default_end_month: end } };
}

export function parseServiceTaskForm(form: FormLike): Parsed<ListItem> {
  return parseItem(form);
}

/** Postgres unique violation, e.g. a second "Mowing". */
export function listErrorMessage(error: { code?: string; message: string }): string {
  return error.code === "23505" ? "That name is already in the list." : error.message;
}

const LIST_FIELDS = ["name", "default_start_month", "default_end_month", "sort_order", "active"] as const;

/**
 * What was typed in a list row, so a rejected save can show it again: React resets
 * the form after every submit, and without these the row would snap back.
 */
export function submittedListValues(form: FormLike): Record<string, string> {
  return Object.fromEntries(LIST_FIELDS.map((name) => [name, String(form.get(name) ?? "")]));
}
