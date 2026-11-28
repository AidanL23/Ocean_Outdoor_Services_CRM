-- robbie_CRM schema, reconstructed from information_schema and pg_constraint
-- exports of the live Supabase project. Structure only, no data.
-- Current as of supabase/migrations/003_service_agreements.sql. Every migration is
-- safe to re-run, so a database built from this file can still have them all applied.
-- Not captured: RLS settings, functions and triggers (app uses the service-role key).
-- The save_service_agreement() function is defined in migration 003.

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  status text not null default 'lead'
    constraint clients_status_check check (status in ('lead', 'active', 'declined', 'past')),
  created_at timestamptz default now()
);
-- ^ as of supabase/migrations/001_client_status.sql

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id),
  address text not null,
  site_instructions text,
  created_at timestamptz default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id),
  property_id uuid references public.properties (id),
  title text not null,
  status text default 'estimate',
  scope_of_work text,
  created_at timestamptz default now()
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs (id),
  client_id uuid references public.clients (id),
  content text not null,
  author text,
  created_at timestamptz default now(),
  contact_date timestamptz not null default now()
);
-- ^ contact_date as of supabase/migrations/002_last_contact.sql

create index activity_logs_client_id_contact_date_idx
  on public.activity_logs (client_id, contact_date);

-- invoice_number is an identity column (generation mode inferred as ALWAYS,
-- since the generated types forbid supplying it on insert/update).
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number integer generated always as identity unique,
  client_id uuid not null references public.clients (id),
  job_id uuid references public.jobs (id),
  invoice_date date not null default current_date,
  due_date date,
  message text,
  tax_rate numeric not null default 0.07,
  status text not null default 'unpaid',
  created_at timestamptz not null default now()
);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  line_date date,
  description text not null,
  action text,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  discount_pct numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Phase 2 (002_last_contact.sql) ---------------------------------------------------

create table public.app_settings (
  id boolean primary key default true check (id),
  last_contact_green_days integer not null default 14,
  last_contact_yellow_days integer not null default 30,
  updated_at timestamptz not null default now(),
  constraint app_settings_last_contact_thresholds_check check (
    last_contact_green_days >= 0
    and last_contact_yellow_days > last_contact_green_days
  )
);

create view public.client_last_contact
with (security_invoker = true) as
select client_id, max(contact_date) as last_contact_at
from public.activity_logs
where client_id is not null
group by client_id;

-- Phase 3a (003_service_agreements.sql) ----------------------------------------------

create table public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_start_month smallint,
  default_end_month smallint,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint service_types_name_check check (btrim(name) <> ''),
  constraint service_types_season_check check (
    (default_start_month is null and default_end_month is null)
    or (default_start_month between 1 and 12 and default_end_month between 1 and 12)
  )
);
create unique index service_types_name_key on public.service_types (lower(btrim(name)));

create table public.service_tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint service_tasks_name_check check (btrim(name) <> '')
);
create unique index service_tasks_name_key on public.service_tasks (lower(btrim(name)));

create table public.service_agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id),
  property_id uuid references public.properties (id),
  service_type_id uuid not null references public.service_types (id),
  billing_type text not null
    constraint service_agreements_billing_type_check
    check (billing_type in ('flat_monthly', 'per_visit')),
  status text not null default 'draft'
    constraint service_agreements_status_check
    check (status in ('draft', 'active', 'ended')),
  start_date date not null,
  end_date date not null,
  billing_months integer,
  monthly_price numeric(10, 2),
  price_per_visit numeric(10, 2),
  service_areas text,
  notes text,
  renewed_from_id uuid references public.service_agreements (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint service_agreements_dates_check check (end_date >= start_date),
  constraint service_agreements_billing_months_check
    check (billing_months is null or billing_months > 0),
  constraint service_agreements_prices_check check (
    (monthly_price is null or monthly_price >= 0)
    and (price_per_visit is null or price_per_visit >= 0)
  ),
  constraint service_agreements_flat_monthly_check check (
    case billing_type
      when 'flat_monthly' then
        billing_months is not null and monthly_price is not null and price_per_visit is null
      else billing_months is null and monthly_price is null
    end
  )
);
create index service_agreements_client_id_idx on public.service_agreements (client_id);

create table public.agreement_schedule_parts (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.service_agreements (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  interval_weeks smallint not null
    constraint agreement_schedule_parts_interval_check check (interval_weeks between 1 and 4),
  price_per_visit numeric(10, 2) not null
    constraint agreement_schedule_parts_price_check check (price_per_visit >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint agreement_schedule_parts_dates_check check (end_date >= start_date)
);
create index agreement_schedule_parts_agreement_id_idx
  on public.agreement_schedule_parts (agreement_id);

create table public.agreement_tasks (
  agreement_id uuid not null references public.service_agreements (id) on delete cascade,
  task_id uuid not null references public.service_tasks (id),
  primary key (agreement_id, task_id)
);

create table public.agreement_visits (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.service_agreements (id) on delete cascade,
  schedule_part_id uuid references public.agreement_schedule_parts (id) on delete set null,
  visit_date date not null,
  price numeric(10, 2) not null
    constraint agreement_visits_price_check check (price >= 0),
  created_at timestamptz not null default now(),
  constraint agreement_visits_agreement_date_key unique (agreement_id, visit_date)
);
