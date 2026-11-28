"use client";

import { useActionState } from "react";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MONTH_NAMES } from "@/lib/agreements/constants";
import type { ListFormState } from "./actions";

type ListAction = (prev: ListFormState, formData: FormData) => Promise<ListFormState>;
type SaveAction = (id: string | null, prev: ListFormState, formData: FormData) => Promise<ListFormState>;

/** What was typed in a rejected row (undefined otherwise). */
type Typed = Record<string, string> | undefined;

type ServiceType = {
  id: string;
  name: string;
  default_start_month: number | null;
  default_end_month: number | null;
  sort_order: number;
  active: boolean;
};

type ServiceTask = { id: string; name: string; sort_order: number; active: boolean };

const initialState: ListFormState = { error: null, saved: false };

/**
 * One row of a settings list: its own form, Save button and error message.
 * React resets the form after every submit; after a rejected save the fields are
 * given what was typed, so it isn't lost.
 */
function RowForm({
  action,
  columns,
  muted,
  submitLabel,
  children,
}: {
  action: ListAction;
  columns: string;
  muted?: boolean;
  submitLabel: string;
  children: (typed: Typed) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form
      action={formAction}
      className={cn("grid items-center gap-2 border-b border-gray-100 py-2", columns, muted && "opacity-60")}
    >
      {children(state.error ? state.values : undefined)}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
      {state.error && <p className="col-span-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

function MonthSelect({ name, value, label }: { name: string; value: number | string | null; label: string }) {
  return (
    <Select name={name} defaultValue={value ?? ""} aria-label={label}>
      <option value="">—</option>
      {MONTH_NAMES.map((m, i) => (
        <option key={m} value={i + 1}>
          {m.slice(0, 3)}
        </option>
      ))}
    </Select>
  );
}

function ActiveCheckbox({ checked }: { checked: boolean }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-gray-700">
      <input type="checkbox" name="active" defaultChecked={checked} />
      Active
    </label>
  );
}

const TYPE_COLUMNS = "grid-cols-[1fr_5.5rem_5.5rem_4.5rem_5rem_auto]";
const TASK_COLUMNS = "grid-cols-[1fr_4.5rem_5rem_auto]";

function Header({ columns, labels }: { columns: string; labels: string[] }) {
  return (
    <div
      className={cn(
        "grid gap-2 border-b border-gray-200 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500",
        columns
      )}
    >
      {labels.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  );
}

export function ServiceTypesList({ types, saveAction }: { types: ServiceType[]; saveAction: SaveAction }) {
  return (
    <div className="text-sm">
      <Header columns={TYPE_COLUMNS} labels={["Name", "Season from", "to", "Order", "", ""]} />
      {types.map((t) => (
        <RowForm key={t.id} action={saveAction.bind(null, t.id)} columns={TYPE_COLUMNS} muted={!t.active} submitLabel="Save">
          {(typed) => (
            <>
              <Input name="name" defaultValue={typed?.name ?? t.name} required aria-label="Name" />
              <MonthSelect
                name="default_start_month"
                value={typed ? typed.default_start_month : t.default_start_month}
                label="Season from"
              />
              <MonthSelect
                name="default_end_month"
                value={typed ? typed.default_end_month : t.default_end_month}
                label="Season to"
              />
              <Input
                name="sort_order"
                type="number"
                min={0}
                step={1}
                defaultValue={typed?.sort_order ?? t.sort_order}
                aria-label="Order"
              />
              <ActiveCheckbox checked={typed ? typed.active === "on" : t.active} />
            </>
          )}
        </RowForm>
      ))}
      <RowForm action={saveAction.bind(null, null)} columns={TYPE_COLUMNS} submitLabel="Add">
        {(typed) => (
          <>
            <Input
              name="name"
              placeholder="New service type"
              defaultValue={typed?.name}
              required
              aria-label="New service type"
            />
            <MonthSelect name="default_start_month" value={typed?.default_start_month ?? null} label="Season from" />
            <MonthSelect name="default_end_month" value={typed?.default_end_month ?? null} label="Season to" />
            <Input
              name="sort_order"
              type="number"
              min={0}
              step={1}
              placeholder="Last"
              defaultValue={typed?.sort_order}
              aria-label="Order"
            />
            <input type="hidden" name="active" value="on" />
            <span />
          </>
        )}
      </RowForm>
    </div>
  );
}

export function ServiceTasksList({ tasks, saveAction }: { tasks: ServiceTask[]; saveAction: SaveAction }) {
  return (
    <div className="text-sm">
      <Header columns={TASK_COLUMNS} labels={["Name", "Order", "", ""]} />
      {tasks.map((t) => (
        <RowForm key={t.id} action={saveAction.bind(null, t.id)} columns={TASK_COLUMNS} muted={!t.active} submitLabel="Save">
          {(typed) => (
            <>
              <Input name="name" defaultValue={typed?.name ?? t.name} required aria-label="Name" />
              <Input
                name="sort_order"
                type="number"
                min={0}
                step={1}
                defaultValue={typed?.sort_order ?? t.sort_order}
                aria-label="Order"
              />
              <ActiveCheckbox checked={typed ? typed.active === "on" : t.active} />
            </>
          )}
        </RowForm>
      ))}
      <RowForm action={saveAction.bind(null, null)} columns={TASK_COLUMNS} submitLabel="Add">
        {(typed) => (
          <>
            <Input name="name" placeholder="New task" defaultValue={typed?.name} required aria-label="New task" />
            <Input
              name="sort_order"
              type="number"
              min={0}
              step={1}
              placeholder="Last"
              defaultValue={typed?.sort_order}
              aria-label="Order"
            />
            <input type="hidden" name="active" value="on" />
            <span />
          </>
        )}
      </RowForm>
    </div>
  );
}
