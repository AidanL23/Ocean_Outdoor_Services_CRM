"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import { DEFAULT_CLIENT_STATUS, parseClientStatus } from "@/lib/clients/status";
import { parseContactDateTime } from "@/lib/contact/last-contact";
import { APP_TIME_ZONE } from "@/lib/time-zone";

export async function createClient(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const status = parseClientStatus(formData.get("status") ?? DEFAULT_CLIENT_STATUS);

  if (!name) throw new Error("Name is required");

  const { data, error } = await supabase
    .from("clients")
    .insert({ name, phone, email, status })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClient(clientId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const status = parseClientStatus(formData.get("status"));

  if (!name) throw new Error("Name is required");

  const { error } = await supabase
    .from("clients")
    .update({ name, phone, email, status })
    .eq("id", clientId);

  if (error) throw new Error(error.message);

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

export async function addProperty(clientId: string, formData: FormData) {
  const address = String(formData.get("address") ?? "").trim();
  const siteInstructions =
    String(formData.get("site_instructions") ?? "").trim() || null;

  if (!address) throw new Error("Address is required");

  const { error } = await supabase.from("properties").insert({
    client_id: clientId,
    address,
    site_instructions: siteInstructions,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/clients/${clientId}`);
}

export type NoteFormState = {
  error: string | null;
  /** What was submitted, so a rejected note isn't lost when the form resets. */
  values?: { content: string; author: string; contact_date: string };
};

export async function addActivityNote(
  clientId: string,
  jobId: string | null,
  _prev: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const values = {
    content: String(formData.get("content") ?? ""),
    author: String(formData.get("author") ?? ""),
    contact_date: String(formData.get("contact_date") ?? ""),
  };
  const content = values.content.trim();
  const author = values.author.trim() || null;

  if (!content) return { error: "Write a note before saving.", values };

  let contactDate: Date;
  try {
    contactDate = parseContactDateTime(
      formData.get("contact_date"),
      formData.get("contact_date_changed") === "1",
      new Date(),
      APP_TIME_ZONE
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid contact date", values };
  }

  const { error } = await supabase.from("activity_logs").insert({
    client_id: clientId,
    job_id: jobId,
    content,
    author,
    contact_date: contactDate.toISOString(),
  });

  if (error) return { error: `Couldn't save the note: ${error.message}`, values };

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  if (jobId) revalidatePath(`/jobs/${jobId}`);
  return { error: null };
}
