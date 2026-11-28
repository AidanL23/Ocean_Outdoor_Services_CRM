import { Card, CardTitle } from "@/components/ui/card";
import { getContactThresholds, getServiceTasks, getServiceTypes } from "@/lib/settings";
import { ThresholdsForm } from "./thresholds-form";
import { ServiceTasksList, ServiceTypesList } from "./service-lists";
import { saveServiceTask, saveServiceType } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [thresholds, serviceTypes, serviceTasks] = await Promise.all([
    getContactThresholds(),
    getServiceTypes(),
    getServiceTasks(),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Settings</h1>
      <div className="space-y-6">
        <Card>
          <CardTitle>Last Contact colours</CardTitle>
          <p className="mb-4 text-sm text-gray-600">
            Colours the Last Contact column by days since the most recent activity note. These
            colours apply to Leads and Active Clients. Declined and Past Clients stay grey.
          </p>
          <ThresholdsForm initial={thresholds} />
        </Card>

        <Card>
          <CardTitle>Service types</CardTitle>
          <p className="mb-4 text-sm text-gray-600">
            Offered on maintenance agreements. The season pre-fills a new agreement&apos;s dates
            (a season ending before it starts, like Oct–Jan, runs into the next year). Untick
            Active to stop offering a type; agreements that already use it keep its name.
          </p>
          <ServiceTypesList types={serviceTypes} saveAction={saveServiceType} />
        </Card>

        <Card>
          <CardTitle>Service tasks</CardTitle>
          <p className="mb-4 text-sm text-gray-600">
            The tasks an agreement can include (shown to whoever does the visit). Untick Active to
            stop offering a task; agreements that already include it keep it.
          </p>
          <ServiceTasksList tasks={serviceTasks} saveAction={saveServiceTask} />
        </Card>
      </div>
    </div>
  );
}
