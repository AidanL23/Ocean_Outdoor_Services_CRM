-- 002_last_contact.sql
-- Phase 2: Last Contact, derived from the activity log, with editable colour thresholds.
--
-- 1. activity_logs.contact_date: when the contact happened (can be back-dated).
--    Existing notes get their created_at. created_at itself is left alone.
-- 2. Notes that were saved with a job but no client get the job's client, so the
--    Last Contact view (which groups by client_id) counts them.
-- 3. client_last_contact view: newest contact_date per client. Nothing is stored,
--    so adding, editing or deleting a note can never leave it out of date.
-- 4. app_settings: one row of global settings (the Last Contact thresholds).
--
-- Safe to re-run: every step checks whether it has already been done.

begin;

-- 1. Contact date ------------------------------------------------------------
alter table public.activity_logs
  add column if not exists contact_date timestamptz;

update public.activity_logs
set contact_date = coalesce(created_at, now())
where contact_date is null;

alter table public.activity_logs
  alter column contact_date set default now(),
  alter column contact_date set not null;

-- 2. Give job notes their client ---------------------------------------------
update public.activity_logs a
set client_id = j.client_id
from public.jobs j
where a.job_id = j.id
  and a.client_id is null
  and j.client_id is not null;

create index if not exists activity_logs_client_id_contact_date_idx
  on public.activity_logs (client_id, contact_date);

-- 3. Last Contact view ---------------------------------------------------------
create or replace view public.client_last_contact
with (security_invoker = true) as
select
  client_id,
  max(contact_date) as last_contact_at
from public.activity_logs
where client_id is not null
group by client_id;

-- 4. Settings ------------------------------------------------------------------
-- id is always true, so the table can only ever hold one row.
create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  last_contact_green_days integer not null default 14,
  last_contact_yellow_days integer not null default 30,
  updated_at timestamptz not null default now(),
  constraint app_settings_last_contact_thresholds_check check (
    last_contact_green_days >= 0
    and last_contact_yellow_days > last_contact_green_days
  )
);

insert into public.app_settings (id) values (true)
on conflict (id) do nothing;

-- The app reads and writes with the service-role key, which bypasses RLS.
-- With RLS on and no policies, the public anon key cannot read or change it.
alter table public.app_settings enable row level security;

commit;
