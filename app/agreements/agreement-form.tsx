"use client";

import { useState, useTransition } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Textarea, Select, Label, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { AgreementVisits } from "@/components/agreement-visits";
import {
  BILLING_TYPES,
  INTERVAL_WEEKS,
  intervalLabel,
  type AgreementStatus,
  type SaveIntent,
} from "@/lib/agreements/constants";
import {
  buildPreview,
  newPart,
  validateAgreement,
  withTerm,
  type AgreedPrice,
  type AgreementInput,
  type PartInput,
} from "@/lib/agreements/input";
import { formatDate, isYmd, nextSeasonDates } from "@/lib/agreements/schedule";
import { formatMoney } from "@/lib/agreements/format";
import { saveAgreement } from "./actions";

type ServiceTypeOption = {
  id: string;
  name: string;
  default_start_month: number | null;
  default_end_month: number | null;
  active: boolean;
};

type Props = {
  clientId: string;
  /** null for a new agreement. */
  agreementId: string | null;
  status: AgreementStatus | null;
  initial: AgreementInput;
  properties: { id: string; address: string }[];
  serviceTypes: ServiceTypeOption[];
  tasks: { id: string; name: string; active: boolean }[];
  /** Today in the business time zone (YYYY-MM-DD), for the default season. */
  today: string;
  cancelHref: string;
  /** The price agreed at activation (active or ended flat-monthly agreements), kept unless recalculated. */
  agreed: AgreedPrice | null;
};

export function AgreementForm({
  clientId,
  agreementId,
  status,
  initial,
  properties,
  serviceTypes,
  tasks,
  today,
  cancelHref,
  agreed,
}: Props) {
  const [input, setInput] = useState(initial);
  // The type's default season pre-fills the dates until the user sets them.
  const [datesTouched, setDatesTouched] = useState(agreementId !== null);
  const [newDate, setNewDate] = useState("");
  const [dateMessage, setDateMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [recalculate, setRecalculate] = useState(false);

  const preview = buildPreview(input);
  // An active agreement keeps the price agreed at activation unless the user asks to recalculate.
  const priceKept = agreed !== null && input.billingType === "flat_monthly" && !recalculate;
  const manualChanges = input.removedDates.length + input.addedDates.length;
  const scheduleLocked = manualChanges > 0;
  const isDraft = status === null || status === "draft";
  const set = (patch: Partial<AgreementInput>) => setInput((prev) => ({ ...prev, ...patch }));

  // Inactive types and tasks stay listed only if this agreement already uses them.
  const typeOptions = serviceTypes.filter((t) => t.active || t.id === input.serviceTypeId);
  const taskOptions = tasks.filter((t) => t.active || input.taskIds.includes(t.id));

  function changeServiceType(id: string) {
    setInput((prev) => {
      const next = { ...prev, serviceTypeId: id };
      const type = serviceTypes.find((t) => t.id === id);
      const season =
        !datesTouched && type
          ? nextSeasonDates(type.default_start_month, type.default_end_month, today)
          : null;
      return season ? withTerm(next, season.startDate, season.endDate) : next;
    });
  }

  function changeTerm(startDate: string, endDate: string) {
    setDatesTouched(true);
    setInput((prev) => withTerm(prev, startDate, endDate));
  }

  function updatePart(index: number, patch: Partial<PartInput>) {
    setInput((prev) => ({
      ...prev,
      parts: prev.parts.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }

  function addPart() {
    setInput((prev) => ({ ...prev, parts: [...prev.parts, newPart(prev)] }));
  }

  function removeVisit(date: string) {
    setInput((prev) =>
      prev.addedDates.includes(date)
        ? { ...prev, addedDates: prev.addedDates.filter((d) => d !== date) }
        : { ...prev, removedDates: [...prev.removedDates, date].sort() }
    );
  }

  function restoreVisit(date: string) {
    setInput((prev) => ({ ...prev, removedDates: prev.removedDates.filter((d) => d !== date) }));
  }

  function addVisit() {
    if (!isYmd(newDate)) return setDateMessage("Pick a date first.");
    if (isYmd(input.startDate) && isYmd(input.endDate) && (newDate < input.startDate || newDate > input.endDate)) {
      return setDateMessage("Pick a date within the agreement's start and end dates.");
    }
    if (input.removedDates.includes(newDate)) {
      restoreVisit(newDate);
    } else if (preview.visits.some((v) => v.date === newDate)) {
      return setDateMessage(`${formatDate(newDate)} is already a visit.`);
    } else {
      set({ addedDates: [...input.addedDates, newDate].sort() });
    }
    setNewDate("");
    setDateMessage(null);
  }

  function submit(intent: SaveIntent) {
    const check = validateAgreement(input);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setErrors([]);
    startTransition(async () => {
      const result = await saveAgreement(agreementId, clientId, intent, input, recalculate);
      // On success the action redirects to the agreement page.
      if (result?.errors.length) setErrors(result.errors);
    });
  }

  const chips = [
    ...preview.visits.map((v) => ({ ...v, added: preview.addedDates.has(v.date) })),
    ...preview.removedVisits.map((v) => ({ ...v, removed: true })),
  ];

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <Card>
        <CardTitle>Agreement</CardTitle>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <FieldGroup>
            <Label htmlFor="service_type">Service type</Label>
            <Select
              id="service_type"
              value={input.serviceTypeId}
              onChange={(e) => changeServiceType(e.target.value)}
            >
              <option value="" disabled>
                Choose a service type
              </option>
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.active ? "" : " (no longer offered)"}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="property">Property</Label>
            <Select
              id="property"
              value={input.propertyId ?? ""}
              onChange={(e) => set({ propertyId: e.target.value || null })}
            >
              <option value="">No specific property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="start_date">Start date</Label>
            <Input
              id="start_date"
              type="date"
              value={input.startDate}
              onChange={(e) => changeTerm(e.target.value, input.endDate)}
            />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="end_date">End date (last day of service)</Label>
            <Input
              id="end_date"
              type="date"
              value={input.endDate}
              onChange={(e) => changeTerm(input.startDate, e.target.value)}
            />
          </FieldGroup>
        </div>
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-gray-700">Billing</legend>
          <div className="flex flex-wrap gap-4 text-sm text-gray-800">
            {BILLING_TYPES.map((b) => (
              <label key={b.value} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="billing_type"
                  checked={input.billingType === b.value}
                  onChange={() =>
                    set({ billingType: b.value, onCall: b.value === "per_visit" ? input.onCall : false })
                  }
                />
                {b.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Card>

      <Card>
        <CardTitle>Schedule</CardTitle>
        {input.billingType === "per_visit" && (
          <div className="mb-4 flex flex-wrap gap-4 text-sm text-gray-800">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="on_call" checked={!input.onCall} onChange={() => set({ onCall: false })} />
              Recurring schedule
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="on_call" checked={input.onCall} onChange={() => set({ onCall: true })} />
              On call (no schedule)
            </label>
          </div>
        )}

        {input.onCall ? (
          <div className="max-w-xs">
            <FieldGroup>
              <Label htmlFor="on_call_price">Price per visit ($)</Label>
              <Input
                id="on_call_price"
                inputMode="decimal"
                value={input.pricePerVisit}
                onChange={(e) => set({ pricePerVisit: e.target.value })}
              />
            </FieldGroup>
            <p className="text-sm text-gray-500">Visits are booked when the client asks.</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-gray-500">
              The first visit is on the part&apos;s start date, then on the same weekday every 1–4
              weeks until its end date.
            </p>
            {scheduleLocked && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span>
                  You changed {manualChanges} visit {manualChanges === 1 ? "date" : "dates"} by hand.
                  Changing the schedule rebuilds the visit list and clears those changes.
                </span>
                <Button type="button" variant="secondary" onClick={() => set({ removedDates: [], addedDates: [] })}>
                  Clear {manualChanges === 1 ? "it" : "them"} and change the schedule
                </Button>
              </div>
            )}
            <fieldset disabled={scheduleLocked} className="disabled:opacity-60">
              <div className="space-y-2">
                {input.parts.map((part, i) => (
                  <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_9rem_7rem_auto]">
                    <div>
                      <Label htmlFor={`part_${i}_start`}>
                        {input.parts.length > 1 ? `Part ${i + 1} from` : "From"}
                      </Label>
                      <Input
                        id={`part_${i}_start`}
                        type="date"
                        value={part.startDate}
                        onChange={(e) => updatePart(i, { startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`part_${i}_end`}>To</Label>
                      <Input
                        id={`part_${i}_end`}
                        type="date"
                        value={part.endDate}
                        onChange={(e) => updatePart(i, { endDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`part_${i}_interval`}>How often</Label>
                      <Select
                        id={`part_${i}_interval`}
                        value={part.intervalWeeks}
                        onChange={(e) => updatePart(i, { intervalWeeks: Number(e.target.value) })}
                      >
                        {INTERVAL_WEEKS.map((w) => (
                          <option key={w} value={w}>
                            {intervalLabel(w)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`part_${i}_price`}>$ per visit</Label>
                      <Input
                        id={`part_${i}_price`}
                        inputMode="decimal"
                        value={part.pricePerVisit}
                        onChange={(e) => updatePart(i, { pricePerVisit: e.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600"
                      disabled={input.parts.length === 1}
                      onClick={() => set({ parts: input.parts.filter((_, j) => j !== i) })}
                    >
                      Remove
                    </Button>
                    {isYmd(part.startDate) && (
                      <p className="text-xs text-gray-500 sm:col-span-full">
                        {formatDate(part.startDate, { weekday: "long" })}s
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="mt-3" onClick={addPart}>
                Add schedule part
              </Button>
            </fieldset>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>What&apos;s included</CardTitle>
        <fieldset className="mb-4">
          <legend className="mb-1 block text-sm font-medium text-gray-700">Tasks</legend>
          {taskOptions.length === 0 ? (
            <p className="text-sm text-gray-500">No tasks set up. Add them on the Settings page.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-800">
              {taskOptions.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={input.taskIds.includes(t.id)}
                    onChange={(e) =>
                      set({
                        taskIds: e.target.checked
                          ? [...input.taskIds, t.id]
                          : input.taskIds.filter((id) => id !== t.id),
                      })
                    }
                  />
                  {t.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <FieldGroup>
          <Label htmlFor="service_areas">Service areas</Label>
          <Textarea
            id="service_areas"
            rows={2}
            placeholder="e.g. Back yard only (the HOA does the front)"
            value={input.serviceAreas}
            onChange={(e) => set({ serviceAreas: e.target.value })}
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} value={input.notes} onChange={(e) => set({ notes: e.target.value })} />
        </FieldGroup>
      </Card>

      {!input.onCall && (
        <Card>
          <CardTitle>Preview</CardTitle>
          <dl className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-gray-500">Visits</dt>
              <dd className="text-lg font-semibold tabular-nums text-gray-900">{preview.visits.length}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Total of visits</dt>
              <dd className="text-lg font-semibold tabular-nums text-gray-900">{formatMoney(preview.total)}</dd>
            </div>
            {input.billingType === "flat_monthly" && (
              <>
                <div>
                  <dt>
                    <label htmlFor="billing_months" className="text-gray-500">
                      Billing months
                    </label>
                  </dt>
                  <dd className="flex items-center gap-2">
                    <Input
                      id="billing_months"
                      type="number"
                      min={1}
                      step={1}
                      className="w-20"
                      disabled={priceKept}
                      value={priceKept ? agreed.billingMonths : (input.billingMonths ?? preview.defaultBillingMonths)}
                      onChange={(e) =>
                        set({ billingMonths: Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber })
                      }
                    />
                    {!priceKept && input.billingMonths !== null && input.billingMonths !== preview.defaultBillingMonths && (
                      <button
                        type="button"
                        className="text-xs text-emerald-700 hover:underline"
                        onClick={() => set({ billingMonths: null })}
                      >
                        Reset to {preview.defaultBillingMonths}
                      </button>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Monthly price</dt>
                  <dd className="text-lg font-semibold tabular-nums text-emerald-700">
                    {priceKept
                      ? `${formatMoney(agreed.monthlyPrice)}/month`
                      : preview.monthly === null
                        ? "—"
                        : `${formatMoney(preview.monthly)}/month`}
                  </dd>
                </div>
              </>
            )}
          </dl>
          {agreed !== null && input.billingType === "flat_monthly" && (
            <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {priceKept ? (
                <p className="mb-1">
                  Keeps the agreed price of {formatMoney(agreed.monthlyPrice)}/month over{" "}
                  {agreed.billingMonths} months: skipping or adding a visit doesn&apos;t change what the
                  client pays.
                  {preview.monthly !== null && preview.monthly !== agreed.monthlyPrice && (
                    <> With these visits it would be {formatMoney(preview.monthly)}/month.</>
                  )}
                </p>
              ) : (
                <p className="mb-1">
                  The monthly price will change from {formatMoney(agreed.monthlyPrice)} to{" "}
                  {preview.monthly === null ? "—" : formatMoney(preview.monthly)} when you save.
                </p>
              )}
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={recalculate} onChange={(e) => setRecalculate(e.target.checked)} />
                Recalculate the monthly price from these visits
              </label>
            </div>
          )}
          {!priceKept && preview.monthly !== null && preview.difference !== 0 && (
            <p className="mb-4 text-sm text-gray-600">
              Rounded to whole dollars: {formatMoney(preview.monthly * preview.billingMonths)} billed vs{" "}
              {formatMoney(preview.total)} of visits.
            </p>
          )}

          <AgreementVisits visits={chips} onRemove={removeVisit} onRestore={restoreVisit} />

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="add_date">Add a visit date</Label>
              <Input
                id="add_date"
                type="date"
                value={newDate}
                min={isYmd(input.startDate) ? input.startDate : undefined}
                max={isYmd(input.endDate) ? input.endDate : undefined}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <Button type="button" variant="secondary" onClick={addVisit}>
              Add date
            </Button>
            {dateMessage && <p className="pb-2 text-sm text-red-700">{dateMessage}</p>}
          </div>
        </Card>
      )}

      {errors.length > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="mb-1 font-medium">Please fix the following:</p>
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isDraft ? (
          <>
            <Button type="button" disabled={pending} onClick={() => submit("activate")}>
              {pending ? "Saving…" : "Activate"}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => submit("draft")}>
              Save as draft
            </Button>
          </>
        ) : (
          <Button type="button" disabled={pending} onClick={() => submit("save")}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        )}
        <LinkButton href={cancelHref} variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
