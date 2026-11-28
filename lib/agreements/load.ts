import "server-only";
import { supabase } from "@/lib/supabase/server";

/** An agreement with its client, property, type, parts (in order), visits (by date) and tasks. */
export async function loadAgreement(id: string) {
  const [agreementRes, partsRes, visitsRes, tasksRes] = await Promise.all([
    supabase
      .from("service_agreements")
      .select("*, clients(id, name), properties(id, address), service_types(id, name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("agreement_schedule_parts")
      .select("id, start_date, end_date, interval_weeks, price_per_visit, sort_order")
      .eq("agreement_id", id)
      .order("sort_order"),
    supabase
      .from("agreement_visits")
      .select("id, visit_date, price, schedule_part_id")
      .eq("agreement_id", id)
      .order("visit_date"),
    supabase
      .from("agreement_tasks")
      .select("task_id, service_tasks(name, sort_order)")
      .eq("agreement_id", id),
  ]);

  for (const res of [agreementRes, partsRes, visitsRes, tasksRes]) {
    if (res.error) throw new Error(res.error.message);
  }
  if (!agreementRes.data) return null;

  const tasks = (tasksRes.data ?? [])
    .map((t) => ({ id: t.task_id, name: t.service_tasks?.name ?? "", sortOrder: t.service_tasks?.sort_order ?? 0 }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return {
    agreement: agreementRes.data,
    parts: (partsRes.data ?? []).map((p) => ({ ...p, price_per_visit: Number(p.price_per_visit) })),
    visits: (visitsRes.data ?? []).map((v) => ({ ...v, price: Number(v.price) })),
    tasks,
  };
}
