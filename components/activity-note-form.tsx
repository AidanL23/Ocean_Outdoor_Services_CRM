"use client";

import { useActionState, useState } from "react";
import { Input, Textarea, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { NoteFormState } from "@/app/clients/actions";

const initialState: NoteFormState = { error: null };

type Props = {
  action: (prev: NoteFormState, formData: FormData) => Promise<NoteFormState>;
  /** "Now" in the business time zone when the page rendered (datetime-local format). */
  defaultContactDate: string;
  /** Latest selectable value: end of today in the business time zone. */
  maxContactDate: string;
};

export function ActivityNoteFormFields({ action, defaultContactDate, maxContactDate }: Props) {
  // Whether the user picked a contact time. If not, the server saves the note with
  // the time it's saved, not the minute the page loaded.
  const [dateChanged, setDateChanged] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: NoteFormState, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result.error) setDateChanged(false);
      return result;
    },
    initialState
  );
  // React resets the form after every submit. On an error the fields reset to
  // what was submitted, so the note isn't lost; on success, to the page defaults.
  const values = state.error ? state.values : undefined;

  return (
    <form action={formAction} className="space-y-2">
      <FieldGroup>
        <Label htmlFor="content">Add Note</Label>
        <Textarea id="content" name="content" rows={2} required defaultValue={values?.content} />
      </FieldGroup>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <FieldGroup>
          <Label htmlFor="author">Author</Label>
          <Input id="author" name="author" defaultValue={values?.author} />
        </FieldGroup>
        <FieldGroup>
          <Label htmlFor="contact_date">Contacted on</Label>
          <Input
            id="contact_date"
            name="contact_date"
            type="datetime-local"
            defaultValue={values?.contact_date ?? defaultContactDate}
            max={maxContactDate}
            onChange={() => setDateChanged(true)}
            aria-invalid={state.error ? true : undefined}
            aria-describedby="note-form-error"
          />
          <input type="hidden" name="contact_date_changed" value={dateChanged ? "1" : ""} />
        </FieldGroup>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Add Note"}
        </Button>
        <p id="note-form-error" aria-live="polite" className="text-sm text-red-700">
          {state.error}
        </p>
      </div>
    </form>
  );
}
