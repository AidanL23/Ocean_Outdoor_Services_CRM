import Link from "next/link";
import { supabase } from "@/lib/supabase/server";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ClientStatusBadge } from "@/components/ui/status-badge";
import { LinkButton } from "@/components/ui/button";
import { CLIENT_STATUSES, isClientStatus } from "@/lib/clients/status";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { status: statusParam } = await searchParams;
  const activeFilter = isClientStatus(statusParam) ? statusParam : null;

  // One query: the list is small, so counts and filtering are done in memory.
  const { data: allClients, error } = await supabase
    .from("clients")
    .select("id, name, phone, email, status")
    .order("name");

  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const c of allClients) {
    counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  }

  const clients = activeFilter
    ? allClients.filter((c) => c.status === activeFilter)
    : allClients;

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
              href={f.value ? `/clients?status=${f.value}` : "/clients"}
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

      {clients.length === 0 ? (
        <p className="text-sm text-gray-500">
          {activeLabel ? `No clients with status “${activeLabel}”.` : "No clients yet."}
        </p>
      ) : (
        <Table>
          <Thead>
            <Th>Name</Th>
            <Th>Phone</Th>
            <Th>Email</Th>
            <Th>Status</Th>
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
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
