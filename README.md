# TimeBank 🏦

**Version:** 1.0  
**Project Type:** Advanced Database Management System  
**Platform:** React + Vite frontend, Supabase Auth + Postgres backend  
**Scope:** Student-only bank account simulation with fake PKR balance, 8-digit account numbers, deposits, withdrawals, and inter-account transfers

---

## 1. Product Summary

TimeBank is a university bank account simulation. A student signs up with:
- `name`
- `email`
- `password`

After signup:
- a profile is created automatically
- a bank account is created automatically
- the account gets a unique 8-digit account number
- the account receives a starting fake balance of `PKR 5,000`

Students can:
- log in with email and password
- view balance and transaction history
- deposit fake PKR into their account
- withdraw fake PKR from their account
- transfer money to another account by account number
- edit their display name

> **Similar project:** [Raqam](https://raqam-bank.vercel.app/) — a digital wallet simulation using 4-digit wallet codes and QR payments. TimeBank follows the same database engineering patterns but models a traditional bank rather than a mobile wallet.

---

## 2. Academic Goal

The real value of this project is the database design and transaction correctness.

The system demonstrates:
- normalization
- triggers
- stored procedures / RPC functions
- row-level security
- transactional rollback
- concurrency control with row locking
- idempotency for weak networks
- joins, views, and reporting
- audit logging

---

## 3. Identity Model

There are three distinct identities:

1. `auth.users.id` — the real authenticated user identity from Supabase Auth
2. `profiles` — stores editable user fields like `name` and `email`
3. `accounts.account_number` — the public payment identity, always a unique 8-digit string such as `00421987` or `90071234`

Important rule:
- names are not unique
- emails are unique for login
- account numbers are unique for transfers

---

## 4. Database Schema

### 4.1 `profiles`

Purpose: user-facing profile data

```sql
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  name       text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
```

### 4.2 `accounts`

Purpose: one bank account per student

```sql
create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.profiles(id) on delete cascade,
  account_number text not null unique check (account_number ~ '^[0-9]{8}$'),
  balance_paisa  bigint not null default 500000 check (balance_paisa >= 0),
  account_type   text not null default 'savings' check (account_type in ('savings', 'current')),
  status         text not null default 'active' check (status in ('active', 'frozen')),
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);
```

### 4.3 `transactions`

Purpose: canonical record for every money movement

```sql
create table if not exists public.transactions (
  id                     uuid primary key default gen_random_uuid(),
  account_id             uuid not null references public.accounts(id) on delete restrict,
  counterpart_account_id uuid null references public.accounts(id) on delete restrict,
  transaction_type       text not null check (
    transaction_type in ('deposit', 'withdrawal', 'transfer_out', 'transfer_in')
  ),
  amount_paisa     bigint not null check (amount_paisa > 0),
  status           text not null default 'completed'
                   check (status in ('completed', 'failed', 'reversed')),
  note             text null,
  idempotency_key  text not null,
  created_at       timestamptz not null default timezone('utc', now()),
  constraint transactions_account_idempotency_unique
    unique (account_id, idempotency_key)
);
```

### 4.4 `ledger_entries`

Purpose: double-entry accounting trail for every balance movement

Rule: every completed transaction inserts exactly one row per account involved.

```sql
create table if not exists public.ledger_entries (
  id                   uuid primary key default gen_random_uuid(),
  transaction_id       uuid not null references public.transactions(id) on delete cascade,
  account_id           uuid not null references public.accounts(id) on delete cascade,
  entry_type           text not null check (entry_type in ('debit', 'credit')),
  amount_paisa         bigint not null check (amount_paisa > 0),
  balance_before_paisa bigint not null,
  balance_after_paisa  bigint not null,
  created_at           timestamptz not null default timezone('utc', now())
);
```

### 4.5 `audit_logs`

Purpose: auditable operational events for every account action

```sql
create table if not exists public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  event_type    text not null,
  entity_type   text not null,
  entity_id     uuid null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default timezone('utc', now())
);
```

---

## 5. Core User Flows

### 5.1 Signup

1. Student enters name, email, password.
2. Supabase Auth creates the user.
3. DB trigger calls account-creation logic.
4. Profile row is inserted.
5. Account row is inserted with unique 8-digit number.
6. Starting balance `500000 paisa` (PKR 5,000) is assigned.
7. User lands on account dashboard.

### 5.2 Deposit

1. Student enters an amount in PKR.
2. Frontend generates `idempotency_key`.
3. Frontend calls `deposit_funds(amount_paisa, idempotency_key)`.
4. DB locks the account row with `FOR UPDATE`.
5. DB inserts transaction + ledger row and updates balance atomically.

### 5.3 Withdrawal

1. Student enters an amount in PKR.
2. DB checks sufficient balance after acquiring lock.
3. If insufficient funds — full rollback, error returned.
4. Otherwise DB inserts transaction + ledger row and updates balance.

### 5.4 Transfer by Account Number

1. Student enters recipient 8-digit account number.
2. Frontend calls `lookup_recipient_by_account(p_account_number)` for preview.
3. Student enters amount and optional note.
4. Frontend generates `idempotency_key` and calls `transfer_funds_by_account(...)`.
5. DB locks both accounts with `FOR UPDATE` in deterministic UUID order.
6. DB rechecks balances after lock.
7. DB inserts two transaction rows and two ledger rows.
8. DB commits or rolls back fully.

### 5.5 Edit Name

1. Student edits display name.
2. Frontend calls `update_profile_name(p_name)`.
3. Only that student can update their own profile through RLS + auth checks.

---

## 6. Required Functions / RPCs

### 6.1 `generate_unique_account_number()`

Generates an 8-digit account number with collision-safe retry logic.

```sql
create or replace function public.generate_unique_account_number()
returns text language plpgsql security definer
set search_path = public as $$
declare
  v_number   text;
  v_attempts integer := 0;
begin
  loop
    v_attempts := v_attempts + 1;
    v_number := lpad(floor(random() * 100000000)::int::text, 8, '0');
    if not exists (
      select 1 from public.accounts where account_number = v_number
    ) then
      return v_number;
    end if;
    if v_attempts >= 100 then
      raise exception 'Unable to generate unique account number';
    end if;
  end loop;
end;
$$;
```

### 6.2 `create_student_account(p_user_id, p_email, p_name)`

Creates profile and account together, writes audit log. Called by signup trigger.

### 6.3 `deposit_funds(p_amount_paisa, p_idempotency_key)`

Locks account row, validates amount, updates balance, inserts transaction and ledger row.

### 6.4 `withdraw_funds(p_amount_paisa, p_idempotency_key)`

Same flow as deposit but debit. Raises `Insufficient Funds` if balance too low.

### 6.5 `transfer_funds_by_account(p_account_number, p_amount_paisa, p_note, p_idempotency_key)`

Resolves recipient account number then calls internal transfer logic with deterministic locking.

```sql
-- Deadlock prevention: always lock lower UUID first
if v_sender.id::text < v_receiver.id::text then
  perform 1 from public.accounts where id = v_sender.id for update;
  perform 1 from public.accounts where id = v_receiver.id for update;
else
  perform 1 from public.accounts where id = v_receiver.id for update;
  perform 1 from public.accounts where id = v_sender.id for update;
end if;

-- Re-read balances after lock
select * into v_sender   from public.accounts where id = v_sender.id;
select * into v_receiver from public.accounts where id = v_receiver.id;
```

### 6.6 `get_account_dashboard()`

Returns full dashboard payload in one DB call: profile, account summary, recent transactions.

---

## 7. Signup Trigger

```sql
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform public.create_student_account(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', 'Student')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
```

---

## 8. Row Level Security

```sql
-- Users read only their own profile
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (auth.uid() = id);

-- Users read only their own account
alter table public.accounts enable row level security;
create policy "accounts_select_own" on public.accounts
for select to authenticated using (user_id = auth.uid());

-- Users read only their own transactions
alter table public.transactions enable row level security;
create policy "transactions_select_own" on public.transactions
for select to authenticated using (
  exists (
    select 1 from public.accounts a
    where a.id = account_id and a.user_id = auth.uid()
  )
);
```

All balance updates happen through RPC functions only. No direct `INSERT` or `UPDATE` on accounts or transactions is allowed from the client.

---

## 9. Concurrency Strategy

Every transfer runs inside a single PostgreSQL transaction:

1. Resolve sender and receiver accounts.
2. Lock both rows using `SELECT ... FOR UPDATE`.
3. Lock in deterministic UUID order to prevent deadlocks.
4. Re-check balances after locks are acquired.
5. Apply debit and credit.
6. Insert transaction rows.
7. Insert ledger rows.
8. Commit — or roll back everything on any error.

**Guarantee:** no negative balance, no partial transfer, no double-spend from race conditions.

---

## 10. Weak Network / Offline Handling

### Frontend rules

- If device is offline, show `No internet connection.`
- If request times out, show: `We couldn't confirm the transaction. Refresh your account before retrying.`
- Disable buttons while requests are pending.
- Never assume success after a timeout.

### Backend rule

Use `idempotency_key` for every transaction request. Retrying with the same key returns the existing result — no duplicate charge.

---

## 11. Normalization

The system is intentionally normalized:

- `auth.users` — authentication only
- `profiles` — editable identity data
- `accounts` — payment state and balance
- `transactions` — business event record
- `ledger_entries` — accounting rows
- `audit_logs` — operational evidence

---

## 12. Comparison with Raqam

| Feature | TimeBank | Raqam |
|---|---|---|
| Account identifier | 8-digit account number | 4-digit wallet code |
| Starting balance | PKR 5,000 | PKR 10,000 |
| Deposit / Withdraw | ✅ | ❌ |
| QR payments | ❌ | ✅ |
| Account types | Savings / Current | Single wallet |
| Transfer method | Account number only | Code + QR |
| Tech stack | React + Vite + Supabase | React + Vite + Supabase |
| Core DB patterns | Same | Same |

---

## 13. Setup

```bash
# Clone the repo
git clone https://github.com/usmaniqbalkhan/TimeBank.git
cd TimeBank

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Push schema to Supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push

# Start dev server
npm run dev
```

---

## Author

**Muhammad Usman Iqbal** — FA24-BSCS-137  
Lahore Garrison University, Section D  
Advanced Database Management Systems Project
