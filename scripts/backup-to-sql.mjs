// Turns a backup folder (from `npm run backup`) into one data.sql that you paste
// into the SQL Editor of another Supabase project, after running supabase/schema.sql there.
// Usage: npm run backup:sql -- <backup-dir>
// Output: <backup-dir>/data.sql (stays outside the repo with the backup; it contains client data)
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Parents before children, so foreign keys are satisfied.
const TABLES = [
  "clients",
  "properties",
  "jobs",
  "invoices",
  "invoice_line_items",
  "activity_logs",
];

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: npm run backup:sql -- <backup-dir>");
  process.exit(1);
}

const parts = ["begin;", ""];
for (const table of TABLES) {
  const rows = JSON.parse(await readFile(join(dir, `${table}.json`), "utf8"));
  console.log(`${table}: ${rows.length} rows`);
  if (rows.length === 0) continue;

  // Same mapping as supabase/migrations/001_client_status.sql, so a backup taken
  // before that migration still loads into a database that has the new constraint.
  if (table === "clients") {
    const valid = new Set(["lead", "active", "declined", "past"]);
    const unmapped = new Map();
    for (const row of rows) {
      const s = typeof row.status === "string" ? row.status.trim().toLowerCase() : row.status;
      row.status = s === "inactive" ? "past" : s;
      if (!valid.has(row.status)) {
        const key = row.status === null || row.status === undefined ? "NULL" : `'${row.status}'`;
        unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
      }
    }
    if (unmapped.size > 0) {
      const list = [...unmapped].map(([k, n]) => `${k} (${n})`).join(", ");
      throw new Error(`Unmapped client statuses: ${list}. Decide what these should become, then re-run.`);
    }
  }

  // jsonb_populate_recordset maps JSON keys to columns by name, so types are cast by Postgres.
  // invoice_number is "generated always", so it needs OVERRIDING SYSTEM VALUE to keep its old values.
  const override = table === "invoices" ? " overriding system value" : "";
  const json = JSON.stringify(rows);
  const tag = `$d_${table}$`;
  if (json.includes(tag)) throw new Error(`${table}: data contains the delimiter ${tag}`);
  parts.push(
    `insert into public.${table}${override}`,
    `select * from jsonb_populate_recordset(null::public.${table}, ${tag}${json}${tag}::jsonb);`,
    ""
  );
}

// Make the next new invoice continue after the highest imported number.
parts.push(
  "select setval(",
  "  pg_get_serial_sequence('public.invoices', 'invoice_number'),",
  "  coalesce((select max(invoice_number) from public.invoices), 1),",
  "  (select count(*) > 0 from public.invoices)",
  ");",
  "",
  "commit;",
  ""
);

const out = join(dir, "data.sql");
await writeFile(out, parts.join("\n"));
console.log(`Wrote ${out}`);
