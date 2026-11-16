import { createClient } from "@/app/clients/actions";
import { Card } from "@/components/ui/card";
import { Input, Label, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ClientStatusSelect } from "@/components/client-status-select";
import { DEFAULT_CLIENT_STATUS } from "@/lib/clients/status";

export default function NewClientPage() {
  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">New Client</h1>
      <Card>
        <form action={createClient}>
          <FieldGroup>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" />
          </FieldGroup>
          <FieldGroup>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </FieldGroup>
          <ClientStatusSelect defaultValue={DEFAULT_CLIENT_STATUS} />
          <Button type="submit">Create Client</Button>
        </form>
      </Card>
    </div>
  );
}
