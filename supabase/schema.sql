-- robbie_CRM schema, reconstructed from information_schema and pg_constraint
-- exports of the live Supabase project. Structure only, no data.
-- Indexes: only the primary-key and invoice_number unique indexes exist (all implied below).
-- Not captured: RLS policies, triggers (app uses the service-role key).

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
  created_at timestamptz default now()
);

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
