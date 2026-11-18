import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ActivityNotes, ActivityNoteForm, ACTIVITY_NOTE_COLUMNS } from "@/components/activity-log";
import { StatusBadge } from "@/components/ui/status-badge";
import { addActivityNote } from "@/app/clients/actions";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: job } = await supabase
    .from("jobs")
    .select("*, clients(id, name), properties(id, address)")
    .eq("id", id)
    .single();

  if (!job) notFound();

  const { data: notes } = await supabase
    .from("activity_logs")
    .select(ACTIVITY_NOTE_COLUMNS)
    .eq("job_id", id)
    .order("contact_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{job.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <StatusBadge status={job.status} />
            {job.clients && (
              <Link href={`/clients/${job.clients.id}`} className="hover:underline">
                {job.clients.name}
              </Link>
            )}
            {job.properties && <span>· {job.properties.address}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {job.clients && (
            <LinkButton
              href={`/invoices/new?client_id=${job.clients.id}&job_id=${job.id}`}
              variant="primary"
            >
              Generate Invoice
            </LinkButton>
          )}
          <LinkButton href={`/jobs/${job.id}/edit`} variant="secondary">
            Edit
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Scope of Work</CardTitle>
          <p className="text-sm text-gray-700">
            {job.scope_of_work || "No scope of work recorded."}
          </p>
        </Card>

        <Card>
          <CardTitle>Activity Log</CardTitle>
          <ActivityNotes notes={notes} />
          <ActivityNoteForm action={addActivityNote.bind(null, job.client_id!, job.id)} />
        </Card>
      </div>
    </div>
  );
}
