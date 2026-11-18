// The business's time zone. Decides what "today" is for "12 days ago", the default
// contact date/time on the note form, and how back-dated contact times are read.
// Fixed (not the server's clock) so it stays right when the app is hosted in UTC.
// APP_TIME_ZONE can override it with any IANA name.

const BUSINESS_TIME_ZONE = "America/New_York";

function resolveTimeZone(): string {
  const configured = process.env.APP_TIME_ZONE?.trim();
  if (!configured) return BUSINESS_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configured });
  } catch {
    throw new Error(`APP_TIME_ZONE "${configured}" is not a valid IANA time zone`);
  }
  return configured;
}

export const APP_TIME_ZONE = resolveTimeZone();
