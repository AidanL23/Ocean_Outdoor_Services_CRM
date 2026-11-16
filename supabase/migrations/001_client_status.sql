-- 001_client_status.sql
-- Phase 1: client statuses become lead / active / declined / past.
--
-- Safe to run without checking the data first: if any client has a NULL or
-- unrecognised status after the mapping below, the script raises an error
-- listing those values and rolls back without changing anything.

begin;

-- Normalise case/whitespace, then map the old values.
update public.clients
set status = case lower(trim(status))
  when 'active'   then 'active'
  when 'inactive' then 'past'
  else status
end
where status is not null;

-- Stop if anything still doesn't fit the new list.
do $$
declare
  bad text;
begin
  select string_agg(coalesce(quote_literal(status), 'NULL') || ' (' || n || ')', ', ')
  into bad
  from (
    select status, count(*) as n
    from public.clients
    where status is null or status not in ('lead', 'active', 'declined', 'past')
    group by status
  ) s;

  if bad is not null then
    raise exception 'Unmapped client statuses: %. Nothing was changed. Decide what these should become, then re-run.', bad;
  end if;
end $$;

alter table public.clients
  alter column status set default 'lead',
  alter column status set not null,
  add constraint clients_status_check
    check (status in ('lead', 'active', 'declined', 'past'));

commit;
