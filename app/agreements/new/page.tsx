import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import { getServiceTasks, getServiceTypes } from "@/lib/settings";
import { calendarDate } from "@/lib/contact/last-contact";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { emptyAgreementInput } from "@/lib/agreements/input";
import { AgreementForm } from "../agreement-form";

export const dynamic = "force-dynamic";

export default async function NewAgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { client_id: clientId } = await searchParams;
  if (!clientId) notFound();

  const [{ data: client }, { data: properties, error }, serviceTypes, tasks] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
    supabase.from("properties").select("id, address").eq("client_id", clientId).order("created_at"),
    getServiceTypes(),
    getServiceTasks(),
  ]);
  if (error) throw new Error(error.message);
  if (!client) notFound();

  const initial = emptyAgreementInput();
  // Most clients have one property; pick it so it isn't forgotten.
  if (properties.length === 1) initial.propertyId = properties[0].id;

  return (
    <div className="max-w-4xl">
      <Link href={`/clients/${client.id}`} className="text-sm text-gray-500 hover:underline">
        ← {client.name}
      </Link>
      <h1 className="mb-6 mt-1 text-xl font-semibold text-gray-900">New service agreement</h1>
      <AgreementForm
        clientId={client.id}
        agreementId={null}
        status={null}
        initial={initial}
        properties={properties}
        serviceTypes={serviceTypes}
        tasks={tasks}
        today={calendarDate(new Date(), APP_TIME_ZONE)}
        cancelHref={`/clients/${client.id}`}
        agreed={null}
      />
    </div>
  );
}
