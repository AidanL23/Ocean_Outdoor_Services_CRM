import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { AgreementStatusBadge } from "@/components/ui/status-badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { AgreementVisits } from "@/components/agreement-visits";
import { loadAgreement } from "@/lib/agreements/load";
import { intervalLabel } from "@/lib/agreements/constants";
import { agreementPriceLabel, formatMoney } from "@/lib/agreements/format";
import { formatDate, visitTotal } from "@/lib/agreements/schedule";
import { calendarDate } from "@/lib/contact/last-contact";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { supabase } from "@/lib/supabase/server";
import { endAgreement, renewAgreement } from "../actions";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right text-gray-900">{children}</dd>
    </div>
  );
}

export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadAgreement(id);
  if (!loaded) notFound();
  const { agreement: a, parts, visits, tasks } = loaded;

  const { data: renewals, error } = await supabase
    .from("service_agreements")
    .select("id, start_date, status")
    .eq("renewed_from_id", id)
    .order("start_date");
  if (error) throw new Error(error.message);

  const total = visitTotal(visits);
  const today = calendarDate(new Date(), APP_TIME_ZONE);
  const pastEnd = a.status === "active" && a.end_date < today;
  const priceLabel = agreementPriceLabel({ ...a, partPrices: parts.map((p) => p.price_per_visit) });
  const billed = a.monthly_price !== null && a.billing_months !== null ? Number(a.monthly_price) * a.billing_months : null;

  return (
    <div>
      <Link href={`/clients/${a.client_id}`} className="text-sm text-gray-500 hover:underline">
        ← {a.clients?.name}
      </Link>
      <div className="mb-6 mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{a.service_types?.name} agreement</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <AgreementStatusBadge status={a.status} />
            <span>{priceLabel}</span>
            <span>
              · {formatDate(a.start_date)} – {formatDate(a.end_date)}
            </span>
            {a.properties && <span>· {a.properties.address}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={`/agreements/${id}/edit`} variant="secondary">
            Edit
          </LinkButton>
          {renewals.length > 0 ? (
            <LinkButton
              href={renewals[0].status === "draft" ? `/agreements/${renewals[0].id}/edit` : `/agreements/${renewals[0].id}`}
              variant="secondary"
            >
              Open renewal
            </LinkButton>
          ) : (
            a.status !== "draft" && (
              <form action={renewAgreement.bind(null, id)}>
                <SubmitButton variant="secondary" pendingLabel="Renewing…">
                  Renew
                </SubmitButton>
              </form>
            )
          )}
          {a.status === "active" && (
            <ConfirmButton
              action={endAgreement.bind(null, id)}
              label="End"
              question="End this agreement? It stays on record as Ended."
              confirmLabel="End agreement"
            />
          )}
        </div>
      </div>

      {pastEnd && (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          This agreement&apos;s end date has passed. Renew it for the next season, or end it.
        </p>
      )}
      {a.status === "draft" && (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Draft: not shown on the clients list yet. Edit it and choose Activate when it&apos;s agreed.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Price</CardTitle>
          <dl className="text-sm">
            {a.billing_type === "flat_monthly" ? (
              <>
                <Row label="Monthly price">{priceLabel}</Row>
                <Row label="Billing months">{a.billing_months}</Row>
                <Row label="Planned visits">{visits.length}</Row>
                <Row label="Total of visits">{formatMoney(total)}</Row>
                {billed !== null && billed !== total && (
                  <Row label="Billed over the term">{formatMoney(billed)}</Row>
                )}
              </>
            ) : parts.length === 0 ? (
              <>
                <Row label="Billing">Per visit, on call</Row>
                <Row label="Price per visit">
                  {a.price_per_visit === null ? "—" : formatMoney(Number(a.price_per_visit))}
                </Row>
              </>
            ) : (
              <>
                <Row label="Billing">Per visit</Row>
                <Row label="Price">{priceLabel}</Row>
                <Row label="Planned visits">{visits.length}</Row>
                <Row label="Total of planned visits">{formatMoney(total)}</Row>
              </>
            )}
          </dl>
          {a.renewed_from_id && (
            <p className="mt-3 text-sm text-gray-500">
              Renewed from{" "}
              <Link href={`/agreements/${a.renewed_from_id}`} className="text-emerald-700 hover:underline">
                the previous agreement
              </Link>
              .
            </p>
          )}
          {renewals.map((r) => (
            <p key={r.id} className="mt-3 text-sm text-gray-500">
              Renewed as{" "}
              <Link href={`/agreements/${r.id}`} className="text-emerald-700 hover:underline">
                the agreement from {formatDate(r.start_date)}
              </Link>{" "}
              ({r.status}).
            </p>
          ))}
        </Card>

        <Card>
          <CardTitle>What&apos;s included</CardTitle>
          <dl className="text-sm">
            <Row label="Tasks">{tasks.length > 0 ? tasks.map((t) => t.name).join(", ") : "—"}</Row>
            <Row label="Service areas">
              <span className="whitespace-pre-line">{a.service_areas ?? "—"}</span>
            </Row>
            <Row label="Notes">
              <span className="whitespace-pre-line">{a.notes ?? "—"}</span>
            </Row>
          </dl>
        </Card>

        {parts.length > 0 && (
          <Card className="md:col-span-2">
            <CardTitle>Schedule</CardTitle>
            <Table>
              <Thead>
                <Th>From</Th>
                <Th>To</Th>
                <Th>How often</Th>
                <Th>Price per visit</Th>
                <Th>Visits</Th>
              </Thead>
              <tbody>
                {parts.map((p) => (
                  <Tr key={p.id}>
                    <Td>{formatDate(p.start_date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</Td>
                    <Td>{formatDate(p.end_date)}</Td>
                    <Td>{intervalLabel(p.interval_weeks)}</Td>
                    <Td>{formatMoney(p.price_per_visit)}</Td>
                    <Td>{visits.filter((v) => v.schedule_part_id === p.id).length}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}

        {parts.length > 0 && (
          <Card className="md:col-span-2">
            <CardTitle>Visits</CardTitle>
            <AgreementVisits
              visits={visits.map((v) => ({
                date: v.visit_date,
                price: v.price,
                added: v.schedule_part_id === null,
              }))}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
