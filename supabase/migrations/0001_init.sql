-- Dinary cloud backup schema.
--
-- The local SQLite database stays the operational source of truth; these tables
-- are the authenticated backup / multi-device copy described in product-spec 7.3.
--
-- Identifiers mirror the local SQLite text ids (for example 'cash' or
-- 'txn_1717…') instead of being rewritten to UUIDs, so existing on-device
-- records sync without a destructive id migration. Because seeded ids such as
-- 'cash' are identical for every user, each table is keyed on (user_id, id).

-- `synced_at` is written by a trigger and is the only cursor the client pulls
-- against. `updated_at` comes from the device and cannot be trusted for
-- ordering, because device clocks drift.
create or replace function public.touch_synced_at()
returns trigger
language plpgsql
as $$
begin
  new.synced_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- accounts --

create table if not exists public.accounts (
  user_id                  uuid        not null references auth.users (id) on delete cascade,
  id                       text        not null,
  name                     text        not null,
  type                     text        not null check (type in ('cash', 'bank_card', 'bank_account', 'e_wallet', 'other')),
  opening_balance_millimes bigint      not null default 0,
  is_archived              boolean     not null default false,
  created_at               timestamptz not null,
  updated_at               timestamptz not null,
  deleted_at               timestamptz,
  synced_at                timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists accounts_sync_idx on public.accounts (user_id, synced_at);

create trigger accounts_touch_synced_at
  before insert or update on public.accounts
  for each row execute function public.touch_synced_at();

-- ------------------------------------------------------------ transactions --

create table if not exists public.transactions (
  user_id           uuid        not null references auth.users (id) on delete cascade,
  id                text        not null,
  account_id        text        not null,
  type              text        not null check (type in ('income', 'expense', 'transfer')),
  amount_millimes   bigint      not null check (amount_millimes > 0),
  category          text        not null,
  title             text        not null,
  note              text,
  transfer_group_id text,
  occurred_at       timestamptz not null,
  source            text        not null default 'manual',
  status            text        not null default 'confirmed' check (status in ('confirmed', 'voided')),
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  deleted_at        timestamptz,
  synced_at         timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, account_id) references public.accounts (user_id, id)
);

create index if not exists transactions_sync_idx on public.transactions (user_id, synced_at);
create index if not exists transactions_occurred_idx on public.transactions (user_id, occurred_at desc);
create index if not exists transactions_transfer_group_idx on public.transactions (user_id, transfer_group_id);

create trigger transactions_touch_synced_at
  before insert or update on public.transactions
  for each row execute function public.touch_synced_at();

-- --------------------------------------------------------- recurring_rules --

create table if not exists public.recurring_rules (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  id              text        not null,
  type            text        not null check (type in ('income', 'expense')),
  amount_millimes bigint,
  account_id      text        not null,
  day_of_month    smallint    not null check (day_of_month between 1 and 31),
  description     text        not null,
  is_active       boolean     not null default true,
  created_at      timestamptz not null,
  updated_at      timestamptz not null,
  deleted_at      timestamptz,
  synced_at       timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, account_id) references public.accounts (user_id, id)
);

create index if not exists recurring_rules_sync_idx on public.recurring_rules (user_id, synced_at);

create trigger recurring_rules_touch_synced_at
  before insert or update on public.recurring_rules
  for each row execute function public.touch_synced_at();

-- -------------------------------------------------------- category_budgets --

create table if not exists public.category_budgets (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  id              text        not null,
  category        text        not null,
  amount_millimes bigint      not null check (amount_millimes > 0),
  month_key       text,
  created_at      timestamptz not null,
  updated_at      timestamptz not null,
  deleted_at      timestamptz,
  synced_at       timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists category_budgets_sync_idx on public.category_budgets (user_id, synced_at);

create trigger category_budgets_touch_synced_at
  before insert or update on public.category_budgets
  for each row execute function public.touch_synced_at();

-- ---------------------------------------------------- row level security --

-- Every policy authorises against auth.uid() only. A user_id supplied by the
-- client is never trusted on its own: the WITH CHECK clause rejects any row
-- whose user_id does not match the caller's verified JWT subject.

alter table public.accounts         enable row level security;
alter table public.transactions     enable row level security;
alter table public.recurring_rules  enable row level security;
alter table public.category_budgets enable row level security;

drop policy if exists accounts_select on public.accounts;
drop policy if exists accounts_insert on public.accounts;
drop policy if exists accounts_update on public.accounts;
drop policy if exists accounts_delete on public.accounts;

create policy accounts_select on public.accounts
  for select to authenticated using (auth.uid() = user_id);
create policy accounts_insert on public.accounts
  for insert to authenticated with check (auth.uid() = user_id);
create policy accounts_update on public.accounts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy accounts_delete on public.accounts
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;

create policy transactions_select on public.transactions
  for select to authenticated using (auth.uid() = user_id);
create policy transactions_insert on public.transactions
  for insert to authenticated with check (auth.uid() = user_id);
create policy transactions_update on public.transactions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy transactions_delete on public.transactions
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists recurring_rules_select on public.recurring_rules;
drop policy if exists recurring_rules_insert on public.recurring_rules;
drop policy if exists recurring_rules_update on public.recurring_rules;
drop policy if exists recurring_rules_delete on public.recurring_rules;

create policy recurring_rules_select on public.recurring_rules
  for select to authenticated using (auth.uid() = user_id);
create policy recurring_rules_insert on public.recurring_rules
  for insert to authenticated with check (auth.uid() = user_id);
create policy recurring_rules_update on public.recurring_rules
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy recurring_rules_delete on public.recurring_rules
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists category_budgets_select on public.category_budgets;
drop policy if exists category_budgets_insert on public.category_budgets;
drop policy if exists category_budgets_update on public.category_budgets;
drop policy if exists category_budgets_delete on public.category_budgets;

create policy category_budgets_select on public.category_budgets
  for select to authenticated using (auth.uid() = user_id);
create policy category_budgets_insert on public.category_budgets
  for insert to authenticated with check (auth.uid() = user_id);
create policy category_budgets_update on public.category_budgets
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy category_budgets_delete on public.category_budgets
  for delete to authenticated using (auth.uid() = user_id);
