import "server-only";
import { supabase } from "@/lib/supabase/server";
import { DEFAULT_CONTACT_THRESHOLDS, type ContactThresholds } from "@/lib/contact/last-contact";

/** Last Contact colour thresholds from the single app_settings row (defaults if the row is missing). */
export async function getContactThresholds(): Promise<ContactThresholds> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("last_contact_green_days, last_contact_yellow_days")
    .eq("id", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_CONTACT_THRESHOLDS;

  return {
    greenDays: data.last_contact_green_days,
    yellowDays: data.last_contact_yellow_days,
  };
}

/** Service types for agreements, in list order (inactive ones included, for old agreements' labels). */
export async function getServiceTypes() {
  const { data, error } = await supabase
    .from("service_types")
    .select("id, name, default_start_month, default_end_month, sort_order, active")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

/** Tasks an agreement can include, in list order (inactive ones included). */
export async function getServiceTasks() {
  const { data, error } = await supabase
    .from("service_tasks")
    .select("id, name, sort_order, active")
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}
