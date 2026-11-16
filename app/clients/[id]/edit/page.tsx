import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
import { updateClient } from "@/app/clients/actions";
import { Card } from "@/components/ui/card";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ClientStatusSelect } from "@/components/client-status-select";
import { DEFAULT_CLIENT_STATUS, isClientStatus } from "@/lib/clients/status";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Edit Client</h1>
      <Card>
        <form action={updateClient.bind(null, client.id)}>
          <FieldGroup>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={client.name} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={client.phone ?? ""} />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={client.email ?? ""} />
          </FieldGroup>
          <ClientStatusSelect
            defaultValue={isClientStatus(client.status) ? client.status : DEFAULT_CLIENT_STATUS}
          />
          <Button type="submit">Save Changes</Button>
        </form>
      </Card>
    </div>
  );
}
