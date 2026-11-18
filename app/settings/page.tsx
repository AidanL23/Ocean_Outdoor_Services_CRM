import { Card, CardTitle } from "@/components/ui/card";
import { getContactThresholds } from "@/lib/settings";
import { ThresholdsForm } from "./thresholds-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const thresholds = await getContactThresholds();

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Settings</h1>
      <Card>
        <CardTitle>Last Contact colours</CardTitle>
        <p className="mb-4 text-sm text-gray-600">
          Colours the Last Contact column by days since the most recent activity note. These
          colours apply to Leads and Active Clients. Declined and Past Clients stay grey.
        </p>
        <ThresholdsForm initial={thresholds} />
      </Card>
    </div>
  );
}
