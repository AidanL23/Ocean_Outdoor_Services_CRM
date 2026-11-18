"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import { parseThresholds } from "@/lib/contact/last-contact";

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
