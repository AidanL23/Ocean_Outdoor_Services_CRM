import { cn } from "@/lib/utils";
import { CLIENT_STATUSES } from "@/lib/clients/status";
import { AGREEMENT_STATUSES } from "@/lib/agreements/constants";

const badgeClasses = "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium";
const fallbackColor = "bg-gray-100 text-gray-600";

// Job and invoice statuses. Client statuses live in lib/clients/status.ts.
const colorMap: Record<string, string> = {
  estimate: "bg-amber-100 text-amber-800",
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  completed: "bg-emerald-100 text-emerald-800",
  invoiced: "bg-purple-100 text-purple-800",
  unpaid: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status }: { status: string | null }) {
  const key = status ?? "unknown";
  const label = key.replace(/_/g, " ");
  return (
    <span className={cn(badgeClasses, "capitalize", colorMap[key] ?? fallbackColor)}>
      {label}
    </span>
  );
}

export function ClientStatusBadge({ status }: { status: string | null }) {
  const match = CLIENT_STATUSES.find((s) => s.value === status);
  return (
    <span className={cn(badgeClasses, match?.badge ?? fallbackColor)}>
      {match?.label ?? status ?? "Unknown"}
    </span>
  );
}

export function AgreementStatusBadge({ status }: { status: string | null }) {
  const match = AGREEMENT_STATUSES.find((s) => s.value === status);
  return (
    <span className={cn(badgeClasses, match?.badge ?? fallbackColor)}>
      {match?.label ?? status ?? "Unknown"}
    </span>
  );
}
