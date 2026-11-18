import type { ComponentProps } from "react";
import { ActivityNoteFormFields } from "@/components/activity-note-form";
import {
  calendarDate,
  formatContactDate,
  formatContactDateTime,
  toDateTimeLocalValue,
} from "@/lib/contact/last-contact";
import { APP_TIME_ZONE } from "@/lib/time-zone";

type Note = {
  id: string;
  content: string;
  author: string | null;
  contact_date: string;
  created_at: string | null;
};

/** Columns to select from activity_logs for <ActivityNotes>. Order by contact_date, newest first. */
export const ACTIVITY_NOTE_COLUMNS = "id, content, author, contact_date, created_at";

export function ActivityNotes({ notes }: { notes: Note[] | null }) {
  if (!notes || notes.length === 0) {
    return (
      <ul className="mb-4 space-y-3">
        <li className="text-sm text-gray-500">No notes yet.</li>
      </ul>
    );
  }

  return (
    <ul className="mb-4 space-y-3">
      {notes.map((note) => {
        const backDated =
          note.created_at !== null &&
          calendarDate(new Date(note.contact_date), APP_TIME_ZONE) !==
            calendarDate(new Date(note.created_at), APP_TIME_ZONE);
        return (
          <li key={note.id} className="text-sm text-gray-700">
            <div>{note.content}</div>
            <div className="text-xs text-gray-400">
              {note.author ? `${note.author} — ` : ""}
              {formatContactDateTime(note.contact_date, APP_TIME_ZONE)}
              {backDated && ` (logged ${formatContactDate(note.created_at!, APP_TIME_ZONE)})`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Server wrapper: works out "now" in the business time zone for the client form. */
export function ActivityNoteForm({ action }: { action: ComponentProps<typeof ActivityNoteFormFields>["action"] }) {
  const now = new Date();
  return (
    <ActivityNoteFormFields
      action={action}
      // Left untouched, the field means "now" at the moment the note is saved (see
      // parseContactDateTime), not the minute the page happened to load.
      defaultContactDate={toDateTimeLocalValue(now, APP_TIME_ZONE)}
      // Blocks later days in the picker; the server rejects any time later than now.
      maxContactDate={`${calendarDate(now, APP_TIME_ZONE)}T23:59`}
    />
  );
}
