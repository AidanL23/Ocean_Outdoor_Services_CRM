// Exports every table to JSON, outside the repo (client data must not be committed).
// Usage: npm run backup            -> ~/robbie_CRM_backups/<timestamp>/
//        npm run backup -- <dir>   -> <dir>/<timestamp>/
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const TABLES = [
  "clients",
  "properties",
  "jobs",
  "invoices",
  "invoice_line_items",
  "activity_logs",
];
// Added by later migrations. Skipped (with a note) when backing up a database that
// hasn't had that migration yet, e.g. Robbie's before the handover.
const OPTIONAL_TABLES = new Set(["app_settings"]);
TABLES.push(...OPTIONAL_TABLES);
const PAGE_SIZE = 1000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      const missing = error.code === "PGRST205" || error.code === "42P01";
      if (missing && OPTIONAL_TABLES.has(table)) return null;
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

const baseDir = process.argv[2] ?? join(homedir(), "robbie_CRM_backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(baseDir, stamp);
await mkdir(outDir, { recursive: true });

for (const table of TABLES) {
  const rows = await fetchAll(table);
  if (rows === null) {
    console.log(`${table}: skipped (not in this database yet)`);
    continue;
  }
  await writeFile(join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
  console.log(`${table}: ${rows.length} rows`);
}
console.log(`Saved to ${outDir}`);
