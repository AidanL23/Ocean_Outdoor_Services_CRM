import { Label, Select, FieldGroup } from "@/components/ui/field";
import { CLIENT_STATUSES, type ClientStatus } from "@/lib/clients/status";

export function ClientStatusSelect({ defaultValue }: { defaultValue: ClientStatus }) {
  return (
    <FieldGroup>
      <Label htmlFor="status">Status</Label>
      <Select id="status" name="status" defaultValue={defaultValue}>
        {CLIENT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>
    </FieldGroup>
  );
}
