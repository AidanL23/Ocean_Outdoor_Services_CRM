// Single source of truth for client statuses. Keep in sync with the
// clients_status_check constraint in supabase/migrations/001_client_status.sql.

export const CLIENT_STATUSES = [
  { value: "lead", label: "Lead", badge: "bg-blue-100 text-blue-800" },
  { value: "active", label: "Active Client", badge: "bg-emerald-100 text-emerald-800" },
  { value: "declined", label: "Declined", badge: "bg-red-100 text-red-800" },
  { value: "past", label: "Past Client", badge: "bg-gray-100 text-gray-600" },
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number]["value"];

export const DEFAULT_CLIENT_STATUS: ClientStatus = "lead";

// Statuses whose Last Contact is colour-coded green/yellow/red. Declined and Past
// clients show the date in neutral grey, so red only flags someone worth calling.
export const CONTACT_TRACKED_STATUSES: readonly ClientStatus[] = ["lead", "active"];

export function tracksLastContact(status: string | null): boolean {
  return CONTACT_TRACKED_STATUSES.some((s) => s === status);
}

export function isClientStatus(value: unknown): value is ClientStatus {
  return CLIENT_STATUSES.some((s) => s.value === value);
}

export function parseClientStatus(value: FormDataEntryValue | null): ClientStatus {
  if (!isClientStatus(value)) throw new Error("Invalid client status");
  return value;
}
