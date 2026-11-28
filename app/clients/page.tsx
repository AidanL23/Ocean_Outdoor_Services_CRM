import Link from "next/link";
import { supabase } from "@/lib/supabase/server";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ClientStatusBadge } from "@/components/ui/status-badge";
import { LinkButton } from "@/components/ui/button";
import { LastContactCell } from "@/components/last-contact";
import { CLIENT_STATUSES, isClientStatus } from "@/lib/clients/status";
import {
  calendarDate,
  parseClientSort,
  sortByLastContact,
  type ClientSort,
} from "@/lib/contact/last-contact";
import { getContactThresholds, getServiceTypes } from "@/lib/settings";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { agreementPriceLabel, agreementsSummary, currentPerType } from "@/lib/agreements/format";
import type { AgreementStatus } from "@/lib/agreements/constants";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function clientsHref(status: string | null, sort: ClientSort, type: string | null) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (sort !== "name") params.set("sort", sort);
  const query = params.toString();
  return query ? `/clients?${query}` : "/clients";
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { status: statusParam, sort: sortParam, type: typeParam } = await searchParams;
  const activeFilter = isClientStatus(statusParam) ? statusParam : null;
  const sort = parseClientSort(sortParam);

  // The list is small, so counts, filtering and sorting are done in memory.
  const [
    { data: everyClient, error },
    { data: lastContacts, error: lcError },
    { data: agreements, error: agError },
    thresholds,
    serviceTypes,
  ] = await Promise.all([
    supabase.from("clients").select("id, name, phone, email, status").order("name"),
    supabase.from("client_last_contact").select("client_id, last_contact_at"),
    supabase
      .from("service_agreements")
      .select(
        "client_id, service_type_id, billing_type, start_date, end_date, monthly_price, price_per_visit, service_types(name, sort_order), agreement_schedule_parts(price_per_visit)"
      )
      .eq("status", "active" satisfies AgreementStatus),
    getContactThresholds(),
    getServiceTypes(),
  ]);

  if (error) throw new Error(error.message);
  if (lcError) throw new Error(lcError.message);
  if (agError) throw new Error(agError.message);

  // Active agreements per client for the Agreement column: the current one of each
  // service type (not also next year's activated renewal), in service-type order.
  type ListedAgreement = {
    typeId: string;
    typeName: string;
    order: number;
    label: string;
    start_date: string;
    end_date: string;
  };
  const activeByClient = new Map<string, ListedAgreement[]>();
  for (const a of agreements) {
    const list = activeByClient.get(a.client_id) ?? [];
    list.push({
      typeId: a.service_type_id,
      typeName: a.service_types?.name ?? "",
      order: a.service_types?.sort_order ?? 0,
      label: agreementPriceLabel({
        ...a,
        partPrices: a.agreement_schedule_parts.map((p) => Number(p.price_per_visit)),
      }),
      start_date: a.start_date,
      end_date: a.end_date,
    });
    activeByClient.set(a.client_id, list);
  }
  const today = calendarDate(new Date(), APP_TIME_ZONE);
  const agreementsByClient = new Map(
    [...activeByClient].map(([clientId, list]) => [
      clientId,
      currentPerType(list, today).sort((x, y) => x.order - y.order),
    ])
  );

  // Filter by service type: clients with an active agreement of that type.
  const typeFilter = serviceTypes.find((t) => t.id === typeParam) ?? null;
  const typeId = typeFilter?.id ?? null;
  const allClients = typeId
    ? everyClient.filter((c) => agreementsByClient.get(c.id)?.some((a) => a.typeId === typeId))
    : everyClient;
  const typeCounts = new Map<string, number>();
  for (const list of agreementsByClient.values()) {
    for (const id of new Set(list.map((a) => a.typeId))) typeCounts.set(id, (typeCounts.get(id) ?? 0) + 1);
  }
  const typeFilters = [
    { value: null, label: "Any", count: null },
    ...serviceTypes
      .filter((t) => t.active || t.id === typeId)
      .map((t) => ({ value: t.id, label: t.name, count: typeCounts.get(t.id) ?? 0 })),
  ];

  const lastContactById = new Map(lastContacts.map((r) => [r.client_id, r.last_contact_at]));
  const now = new Date();

  const counts = new Map<string, number>();
  for (const c of allClients) {
    counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  }

  const clients = sortByLastContact(
    (activeFilter ? allClients.filter((c) => c.status === activeFilter) : allClients).map(
      (c) => ({ ...c, lastContactAt: lastContactById.get(c.id) ?? null })
    ),
    sort
  );

  const nextContactSort: ClientSort = sort === "last_contact" ? "-last_contact" : "last_contact";
  const contactSortArrow = sort === "last_contact" ? " ↓" : sort === "-last_contact" ? " ↑" : "";

  const filters = [
    { value: null, label: "All", count: allClients.length },
    ...CLIENT_STATUSES.map((s) => ({
      value: s.value,
      label: s.label,
      count: counts.get(s.value) ?? 0,
    })),
  ];

  const activeLabel = CLIENT_STATUSES.find((s) => s.value === activeFilter)?.label;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Clients</h1>
        <LinkButton href="/clients/new">New Client</LinkButton>
      </div>

      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const selected = f.value === activeFilter;
          return (
            <Link
              key={f.label}
              href={clientsHref(f.value, sort, typeId)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                selected
                  ? "border-emerald-700 bg-emerald-700 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  selected ? "bg-emerald-800 text-emerald-50" : "bg-gray-100 text-gray-600"
                )}
              >
                {f.count}
              </span>
            </Link>
          );
        })}
      </nav>

      <nav aria-label="Filter by agreement" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">Active agreement:</span>
        {typeFilters.map((f) => {
          const selected = f.value === typeId;
          return (
            <Link
              key={f.label}
              href={clientsHref(activeFilter, sort, f.value)}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-medium transition-colors",
                selected
                  ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {f.label}
              {f.count !== null && <span className="ml-1 text-xs tabular-nums text-gray-500">{f.count}</span>}
            </Link>
          );
        })}
      </nav>

      {clients.length === 0 ? (
        <p className="text-sm text-gray-500">
          {typeFilter
            ? `No ${activeLabel ? `“${activeLabel}” ` : ""}clients with an active ${typeFilter.name} agreement.`
            : activeLabel
              ? `No clients with status “${activeLabel}”.`
              : "No clients yet."}
        </p>
      ) : (
        <Table>
          <Thead>
            <Th aria-sort={sort === "name" ? "ascending" : undefined}>
              <Link href={clientsHref(activeFilter, "name", typeId)} className="hover:text-gray-800">
                Name
              </Link>
            </Th>
            <Th>Phone</Th>
            <Th>Email</Th>
            <Th>Status</Th>
            <Th>Agreement</Th>
            <Th
              aria-sort={
                sort === "name" ? undefined : sort === "last_contact" ? "ascending" : "descending"
              }
            >
              <Link
                href={clientsHref(activeFilter, nextContactSort, typeId)}
                className="whitespace-nowrap hover:text-gray-800"
                title={
                  nextContactSort === "last_contact"
                    ? "Sort: longest since contact first"
                    : "Sort: most recent contact first"
                }
              >
                Last Contact{contactSortArrow}
              </Link>
            </Th>
          </Thead>
          <tbody>
            {clients.map((client) => (
              <Tr key={client.id}>
                <Td>
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium text-emerald-700 hover:underline"
                  >
                    {client.name}
                  </Link>
                </Td>
                <Td>{client.phone ?? "—"}</Td>
                <Td>{client.email ?? "—"}</Td>
                <Td>
                  <ClientStatusBadge status={client.status} />
                </Td>
                <Td className="text-gray-700">
                  {agreementsByClient.has(client.id)
                    ? agreementsSummary(agreementsByClient.get(client.id)!)
                    : "—"}
                </Td>
                <LastContactCell
                  lastContactAt={client.lastContactAt}
                  clientStatus={client.status}
                  thresholds={thresholds}
                  now={now}
                />
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
