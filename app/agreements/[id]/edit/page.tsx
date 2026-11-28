import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import { getServiceTasks, getServiceTypes } from "@/lib/settings";
import { calendarDate } from "@/lib/contact/last-contact";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { agreedPrice, agreementToInput } from "@/lib/agreements/input";
import { isAgreementStatus } from "@/lib/agreements/constants";
import { loadAgreement } from "@/lib/agreements/load";
import { AgreementForm } from "../../agreement-form";

export const dynamic = "force-dynamic";

export default async function EditAgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadAgreement(id);
  if (!loaded) notFound();
  const { agreement, parts, visits, tasks: included } = loaded;

  const [{ data: properties, error }, serviceTypes, tasks] = await Promise.all([
    supabase.from("properties").select("id, address").eq("client_id", agreement.client_id).order("created_at"),
    getServiceTypes(),
    getServiceTasks(),
  ]);
  if (error) throw new Error(error.message);

  const initial = agreementToInput(
    agreement,
    parts,
    visits.map((v) => v.visit_date),
    included.map((t) => t.id)
  );

  return (
    <div className="max-w-4xl">
      <Link href={`/agreements/${id}`} className="text-sm text-gray-500 hover:underline">
        ← {agreement.service_types?.name ?? "Agreement"} · {agreement.clients?.name}
      </Link>
      <h1 className="mb-6 mt-1 text-xl font-semibold text-gray-900">Edit service agreement</h1>
      {agreement.status === "draft" && agreement.renewed_from_id && (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Renewal of{" "}
          <Link href={`/agreements/${agreement.renewed_from_id}`} className="underline">
            last year&apos;s agreement
          </Link>
          : every date moved to the same date next year, so visits may now fall on a different
          weekday. Check the day shown under each schedule part, and change its start date if the
          client should keep the same day.
        </p>
      )}
      <AgreementForm
        clientId={agreement.client_id}
        agreementId={id}
        status={isAgreementStatus(agreement.status) ? agreement.status : "draft"}
        initial={initial}
        properties={properties}
        serviceTypes={serviceTypes}
        tasks={tasks}
        today={calendarDate(new Date(), APP_TIME_ZONE)}
        cancelHref={`/agreements/${id}`}
        agreed={agreedPrice(agreement)}
      />
    </div>
  );
}
