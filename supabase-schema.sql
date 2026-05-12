create extension if not exists pgcrypto;

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  mrn text not null unique,
  name text not null,
  created_at date not null default current_date,
  last_visit date not null default current_date
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  stock integer not null default 0 check (stock >= 0),
  threshold integer not null default 0 check (threshold >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  date date not null default current_date,
  drug_name text not null,
  frequency text not null,
  duration text not null,
  prescriber text not null,
  created_at timestamptz not null default now()
);

create index if not exists patients_mrn_idx on public.patients (mrn);
create index if not exists prescriptions_patient_id_idx on public.prescriptions (patient_id);
create index if not exists prescriptions_date_idx on public.prescriptions (date desc);

alter table public.patients enable row level security;
alter table public.inventory enable row level security;
alter table public.prescriptions enable row level security;

drop policy if exists "pharmacy dashboard read patients" on public.patients;
drop policy if exists "pharmacy dashboard write patients" on public.patients;
drop policy if exists "pharmacy dashboard read inventory" on public.inventory;
drop policy if exists "pharmacy dashboard write inventory" on public.inventory;
drop policy if exists "pharmacy dashboard read prescriptions" on public.prescriptions;
drop policy if exists "pharmacy dashboard write prescriptions" on public.prescriptions;

create policy "pharmacy dashboard read patients"
on public.patients for select
to anon
using (true);

create policy "pharmacy dashboard write patients"
on public.patients for all
to anon
using (true)
with check (true);

create policy "pharmacy dashboard read inventory"
on public.inventory for select
to anon
using (true);

create policy "pharmacy dashboard write inventory"
on public.inventory for all
to anon
using (true)
with check (true);

create policy "pharmacy dashboard read prescriptions"
on public.prescriptions for select
to anon
using (true);

create policy "pharmacy dashboard write prescriptions"
on public.prescriptions for all
to anon
using (true)
with check (true);
