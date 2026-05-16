create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  username text unique,
  full_name text not null,
  role text not null check (role in ('pharmacist', 'physician')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := lower(coalesce(new.raw_user_meta_data->>'role', 'physician'));
begin
  insert into public.profiles (user_id, email, username, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when requested_role in ('pharmacist', 'physician') then requested_role else 'physician' end
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    username = excluded.username,
    full_name = excluded.full_name,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid()
$$;

create or replace function public.is_clinical_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('pharmacist', 'physician')
$$;

create or replace function public.is_pharmacist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'pharmacist'
$$;

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.inventory enable row level security;
alter table public.prescriptions enable row level security;

drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles update own basic details" on public.profiles;
drop policy if exists "pharmacy dashboard read patients" on public.patients;
drop policy if exists "pharmacy dashboard write patients" on public.patients;
drop policy if exists "pharmacy dashboard update patients" on public.patients;
drop policy if exists "pharmacy dashboard delete patients" on public.patients;
drop policy if exists "pharmacy dashboard read inventory" on public.inventory;
drop policy if exists "pharmacy dashboard write inventory" on public.inventory;
drop policy if exists "pharmacy dashboard read prescriptions" on public.prescriptions;
drop policy if exists "pharmacy dashboard write prescriptions" on public.prescriptions;
drop policy if exists "pharmacy dashboard delete prescriptions" on public.prescriptions;

create policy "profiles read own"
on public.profiles for select
to authenticated
using (user_id = auth.uid());

create policy "profiles update own basic details"
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and role = public.current_user_role());

create policy "pharmacy dashboard read patients"
on public.patients for select
to authenticated
using (public.is_clinical_user());

create policy "pharmacy dashboard write patients"
on public.patients for insert
to authenticated
with check (public.is_clinical_user());

create policy "pharmacy dashboard update patients"
on public.patients for update
to authenticated
using (public.is_clinical_user())
with check (public.is_clinical_user());

create policy "pharmacy dashboard delete patients"
on public.patients for delete
to authenticated
using (public.is_pharmacist());

create policy "pharmacy dashboard read inventory"
on public.inventory for select
to authenticated
using (public.is_clinical_user());

create policy "pharmacy dashboard write inventory"
on public.inventory for all
to authenticated
using (public.is_pharmacist())
with check (public.is_pharmacist());

create policy "pharmacy dashboard read prescriptions"
on public.prescriptions for select
to authenticated
using (public.is_clinical_user());

create policy "pharmacy dashboard write prescriptions"
on public.prescriptions for insert
to authenticated
with check (public.is_clinical_user());

create policy "pharmacy dashboard delete prescriptions"
on public.prescriptions for delete
to authenticated
using (public.is_pharmacist());
