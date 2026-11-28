"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import { parseThresholds } from "@/lib/contact/last-contact";
import {
  listErrorMessage,
  parseServiceTaskForm,
  parseServiceTypeForm,
  submittedListValues,
} from "@/lib/agreements/service-lists";

export type ThresholdsFormState = { error: string | null; saved: boolean };

export async function saveContactThresholds(
  _prev: ThresholdsFormState,
  formData: FormData
): Promise<ThresholdsFormState> {
  const parsed = parseThresholds(formData);
  if (!parsed.ok) return { error: parsed.error, saved: false };

  const { error } = await supabase.from("app_settings").upsert({
    id: true,
    last_contact_green_days: parsed.value.greenDays,
    last_contact_yellow_days: parsed.value.yellowDays,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message, saved: false };

  // Colours appear on the clients list and every client page.
  revalidatePath("/", "layout");
  return { error: null, saved: true };
}

// --- Service types and tasks (agreements) -------------------------------------

export type ListFormState = {
  error: string | null;
  saved: boolean;
  /** What was submitted, so a rejected row shows what was typed rather than snapping back. */
  values?: Record<string, string>;
};

/** Next sort_order for a new entry: after the last one. */
async function nextSortOrder(table: "service_types" | "service_tasks"): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.sort_order ?? 0) + 1;
}

/** id null adds a type. Entries are deactivated, never deleted, so old agreements keep their label. */
export async function saveServiceType(
  id: string | null,
  _prev: ListFormState,
  formData: FormData
): Promise<ListFormState> {
  const parsed = parseServiceTypeForm(formData);
  if (!parsed.ok) return { error: parsed.error, saved: false, values: submittedListValues(formData) };
  const { sort_order, ...fields } = parsed.value;

  const { error } = id
    ? await supabase
        .from("service_types")
        .update(sort_order === null ? fields : { ...fields, sort_order })
        .eq("id", id)
    : await supabase
        .from("service_types")
        .insert({ ...fields, sort_order: sort_order ?? (await nextSortOrder("service_types")) });

  if (error) return { error: listErrorMessage(error), saved: false, values: submittedListValues(formData) };
  // Type names appear on the clients list, client pages and agreement pages.
  revalidatePath("/", "layout");
  return { error: null, saved: true };
}

export async function saveServiceTask(
  id: string | null,
  _prev: ListFormState,
  formData: FormData
): Promise<ListFormState> {
  const parsed = parseServiceTaskForm(formData);
  if (!parsed.ok) return { error: parsed.error, saved: false, values: submittedListValues(formData) };
  const { sort_order, ...fields } = parsed.value;

  const { error } = id
    ? await supabase
        .from("service_tasks")
        .update(sort_order === null ? fields : { ...fields, sort_order })
        .eq("id", id)
    : await supabase
        .from("service_tasks")
        .insert({ ...fields, sort_order: sort_order ?? (await nextSortOrder("service_tasks")) });

  if (error) return { error: listErrorMessage(error), saved: false, values: submittedListValues(formData) };
  revalidatePath("/", "layout");
  return { error: null, saved: true };
}
