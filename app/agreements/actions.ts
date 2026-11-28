"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import {
  isAgreementStatus,
  statusAfterSave,
  type AgreementStatus,
  type SaveIntent,
} from "@/lib/agreements/constants";
import {
  agreedPrice,
  agreementToInput,
  keepAgreedPrice,
  renewalInput,
  validateAgreement,
  type AgreementInput,
  type ValidAgreement,
} from "@/lib/agreements/input";
import { loadAgreement } from "@/lib/agreements/load";

export type SaveAgreementResult = { errors: string[] };

const SAVE_INTENTS: readonly SaveIntent[] = ["draft", "activate", "save"];

/** Writes the agreement with its parts, tasks and visits in one transaction. Returns its id. */
async function writeAgreement(
  id: string | null,
  clientId: string,
  status: AgreementStatus,
  value: ValidAgreement,
  renewedFromId: string | null = null
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase.rpc("save_service_agreement", {
    p_id: id,
    p_agreement: {
      client_id: clientId,
      property_id: value.propertyId,
      service_type_id: value.serviceTypeId,
      billing_type: value.billingType,
      status,
      start_date: value.startDate,
      end_date: value.endDate,
      billing_months: value.billingMonths,
      monthly_price: value.monthlyPrice,
      price_per_visit: value.pricePerVisit,
      service_areas: value.serviceAreas,
      notes: value.notes,
      renewed_from_id: renewedFromId,
    },
    p_parts: value.parts.map((p) => ({
      start_date: p.startDate,
      end_date: p.endDate,
      interval_weeks: p.intervalWeeks,
      price_per_visit: p.pricePerVisit,
    })),
    p_task_ids: value.taskIds,
    p_visits: value.visits.map((v) => ({
      visit_date: v.date,
      price: v.price,
      part_index: v.partIndex,
    })),
  });
  if (error) return { error: `Couldn't save the agreement: ${error.message}` };
  return { id: data };
}

function revalidateAgreement(clientId: string, agreementId: string) {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/agreements/${agreementId}`);
}

/**
 * Creates (agreementId null, for clientId) or updates an agreement from the form.
 * Drafts are saved as drafts or activated; active and ended agreements keep their status
 * and their agreed monthly price, unless `recalculatePrice` is set.
 */
export async function saveAgreement(
  agreementId: string | null,
  clientId: string,
  intent: SaveIntent,
  input: AgreementInput,
  recalculatePrice: boolean = false
): Promise<SaveAgreementResult> {
  if (!SAVE_INTENTS.includes(intent)) return { errors: ["Unknown save action."] };

  const parsed = validateAgreement(input);
  if (!parsed.ok) return { errors: parsed.errors };
  let value = parsed.value;

  let current: AgreementStatus | null = null;
  if (agreementId) {
    const { data, error } = await supabase
      .from("service_agreements")
      .select("client_id, status, billing_type, billing_months, monthly_price")
      .eq("id", agreementId)
      .maybeSingle();
    if (error) return { errors: [error.message] };
    if (!data) return { errors: ["This agreement no longer exists."] };
    clientId = data.client_id; // never moves to another client
    current = isAgreementStatus(data.status) ? data.status : "draft";
    value = keepAgreedPrice(value, agreedPrice(data), recalculatePrice === true);
  } else {
    const { data, error } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (error) return { errors: [error.message] };
    if (!data) return { errors: ["This client no longer exists."] };
  }

  if (value.propertyId) {
    const { data, error } = await supabase
      .from("properties")
      .select("id")
      .eq("id", value.propertyId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (error) return { errors: [error.message] };
    if (!data) return { errors: ["Choose one of this client's properties."] };
  }

  const saved = await writeAgreement(agreementId, clientId, statusAfterSave(current, intent), value);
  if ("error" in saved) return { errors: [saved.error] };

  revalidateAgreement(clientId, saved.id);
  redirect(`/agreements/${saved.id}`);
}

/** Ends an active agreement. It stays on the client page, marked Ended. */
export async function endAgreement(agreementId: string) {
  const { data, error } = await supabase
    .from("service_agreements")
    .update({ status: "ended" satisfies AgreementStatus })
    .eq("id", agreementId)
    .eq("status", "active" satisfies AgreementStatus)
    .select("client_id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) revalidateAgreement(data.client_id, agreementId);
}

/**
 * Copies an agreement as a new draft for the same dates next year (see renewalInput),
 * then opens it for editing. An agreement is renewed only once: if a renewal already
 * exists, it opens that one instead of making another.
 */
export async function renewAgreement(agreementId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("service_agreements")
    .select("id, status")
    .eq("renewed_from_id", agreementId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) {
    redirect(existing.status === "draft" ? `/agreements/${existing.id}/edit` : `/agreements/${existing.id}`);
  }

  const loaded = await loadAgreement(agreementId);
  if (!loaded) throw new Error("This agreement no longer exists.");
  const { agreement, parts, visits, tasks } = loaded;

  const input = renewalInput(
    agreementToInput(
      agreement,
      parts,
      visits.map((v) => v.visit_date),
      tasks.map((t) => t.id)
    )
  );
  const parsed = validateAgreement(input);
  if (!parsed.ok) throw new Error(`Couldn't renew: ${parsed.errors.join(" ")}`);

  const saved = await writeAgreement(null, agreement.client_id, "draft", parsed.value, agreementId);
  if ("error" in saved) throw new Error(saved.error);

  revalidateAgreement(agreement.client_id, saved.id);
  revalidatePath(`/agreements/${agreementId}`);
  redirect(`/agreements/${saved.id}/edit`);
}
