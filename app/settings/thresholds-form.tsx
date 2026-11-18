"use client";

import { useActionState, useState } from "react";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTACT_LEVELS, type ContactThresholds } from "@/lib/contact/last-contact";
import { saveContactThresholds, type ThresholdsFormState } from "./actions";

const initialState: ThresholdsFormState = { error: null, saved: false };

export function ThresholdsForm({ initial }: { initial: ContactThresholds }) {
  const [green, setGreen] = useState(String(initial.greenDays));
  const [yellow, setYellow] = useState(String(initial.yellowDays));
  // The values currently stored. Save is only enabled when the fields differ from
  // them, so "Saved." always follows a real change and hides again on the next edit.
  const [stored, setStored] = useState(initial);
  const [state, formAction, pending] = useActionState(
    async (prev: ThresholdsFormState, formData: FormData) => {
      const result = await saveContactThresholds(prev, formData);
      if (result.saved) {
        setStored({
          greenDays: Number(formData.get("green_days")),
          yellowDays: Number(formData.get("yellow_days")),
        });
      }
      return result;
    },
    initialState
  );
  const unchanged =
    green.trim() !== "" &&
    yellow.trim() !== "" &&
    Number(green) === stored.greenDays &&
    Number(yellow) === stored.yellowDays;

  const g = Number(green);
  const y = Number(yellow);
  const previewOk = green !== "" && yellow !== "" && Number.isInteger(g) && Number.isInteger(y) && y > g && g >= 0;

  const legend = [
    { level: "green", range: `0–${g} days` },
    { level: "yellow", range: `${g + 1}–${y} days` },
    { level: "red", range: `more than ${y} days` },
    { level: "never", range: "no notes yet" },
  ] as const;

  return (
    <form action={formAction} className="max-w-md">
      <div className="grid grid-cols-2 gap-x-4">
        <FieldGroup>
          <Label htmlFor="green_days">Green up to (days)</Label>
          <Input
            id="green_days"
            name="green_days"
            type="number"
            min={0}
            step={1}
            required
            value={green}
            onChange={(e) => {
              setGreen(e.target.value);
            }}
          />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="yellow_days">Yellow up to (days)</Label>
          <Input
            id="yellow_days"
            name="yellow_days"
            type="number"
            min={0}
            step={1}
            required
            value={yellow}
            onChange={(e) => {
              setYellow(e.target.value);
            }}
          />
        </FieldGroup>
      </div>

      {previewOk ? (
        <ul className="mb-4 space-y-1.5 text-sm">
          {legend.map(({ level, range }) => (
            <li key={level} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block w-28 rounded px-2 py-0.5 text-xs font-medium",
                  CONTACT_LEVELS[level].cell
                )}
              >
                {CONTACT_LEVELS[level].label}
              </span>
              <span className="text-gray-600">{range}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-amber-700">Yellow must be more days than green.</p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || unchanged}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <p aria-live="polite" className="text-sm">
          {state.error ? (
            <span className="text-red-700">{state.error}</span>
          ) : state.saved && !pending && unchanged ? (
            <span className="text-emerald-700">Saved.</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
