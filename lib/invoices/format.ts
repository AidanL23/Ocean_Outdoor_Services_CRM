// Formatting helpers for the invoice document. Kept free of server-only imports
// so they can be unit tested (see lib/invoices/format.test.ts).

export function formatPlain(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatLongDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

export function splitAddress(address: string | null) {
  if (!address) return { line1: "", line2: "" };
  const idx = address.indexOf(",");
  if (idx === -1) return { line1: address.trim(), line2: "" };
  return { line1: address.slice(0, idx).trim(), line2: address.slice(idx + 1).trim() };
}
