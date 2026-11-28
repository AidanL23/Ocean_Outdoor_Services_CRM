// Planned visits grouped by month. Used read-only on the agreement page, and with
// remove/restore buttons in the agreement form's preview.

import { cn } from "@/lib/utils";
import { formatDate, groupByMonth, visitTotal } from "@/lib/agreements/schedule";
import { formatMoney } from "@/lib/agreements/format";

export type VisitChip = {
  date: string;
  price: number;
  /** Added by hand (not from a schedule part). */
  added?: boolean;
  /** Taken out by hand; shown struck through and not counted. */
  removed?: boolean;
};

export function AgreementVisits({
  visits,
  onRemove,
  onRestore,
}: {
  visits: VisitChip[];
  onRemove?: (date: string) => void;
  onRestore?: (date: string) => void;
}) {
  if (visits.length === 0) return <p className="text-sm text-gray-500">No visits planned.</p>;

  return (
    <div className="space-y-3">
      {groupByMonth(visits).map((group) => {
        const counted = group.visits.filter((v) => !v.removed);
        return (
          <div key={group.month}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-gray-900">{group.label}</span>
              <span className="text-gray-500 tabular-nums">
                {counted.length} {counted.length === 1 ? "visit" : "visits"} ·{" "}
                {formatMoney(visitTotal(counted))}
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {group.visits.map((v) => (
                <li
                  key={v.date}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs tabular-nums",
                    v.removed
                      ? "border-dashed border-gray-300 text-gray-400 line-through"
                      : v.added
                        ? "border-blue-300 bg-blue-50 text-blue-900"
                        : "border-gray-200 bg-white text-gray-800"
                  )}
                  title={`${formatDate(v.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${formatMoney(v.price)}${v.added ? " · added by hand" : ""}${v.removed ? " · removed" : ""}`}
                >
                  {formatDate(v.date, { weekday: "short", month: "short", day: "numeric" })}
                  {v.removed
                    ? onRestore && (
                        <button
                          type="button"
                          onClick={() => onRestore(v.date)}
                          className="ml-0.5 text-gray-500 no-underline hover:text-emerald-700"
                          aria-label={`Restore ${formatDate(v.date)}`}
                        >
                          ↺
                        </button>
                      )
                    : onRemove && (
                        <button
                          type="button"
                          onClick={() => onRemove(v.date)}
                          className="ml-0.5 text-gray-400 hover:text-red-600"
                          aria-label={`Remove ${formatDate(v.date)}`}
                        >
                          ×
                        </button>
                      )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
