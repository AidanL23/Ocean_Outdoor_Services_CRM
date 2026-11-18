import { Td } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { tracksLastContact } from "@/lib/clients/status";
import { describeLastContact, type ContactThresholds } from "@/lib/contact/last-contact";
import { APP_TIME_ZONE } from "@/lib/time-zone";

type Props = {
  lastContactAt: string | null;
  clientStatus: string | null;
  thresholds: ContactThresholds;
  now: Date;
};

function describe({ lastContactAt, clientStatus, thresholds, now }: Props) {
  return describeLastContact(lastContactAt, now, APP_TIME_ZONE, thresholds, {
    tracked: tracksLastContact(clientStatus),
  });
}

/** Table cell with the whole background coloured, for scanning the clients list. */
export function LastContactCell(props: Props) {
  const lc = describe(props);
  return (
    <Td className={cn("whitespace-nowrap font-medium", lc.className)} title={lc.title}>
      {lc.text}
    </Td>
  );
}

/** Pill for the client page header. */
export function LastContactBadge(props: Props) {
  const lc = describe(props);
  return (
    <span
      className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", lc.className)}
      title={lc.title}
    >
      Last contact: {lc.text}
    </span>
  );
}
