# Raqam Final PRD

Version: 2.0  
Project Type: Advanced Database Management System  
Platform: React + Vite frontend, Supabase Auth + Postgres backend  
Scope: Student-only wallet simulation with fake PKR balance, 4-digit wallet codes, QR transfers, concurrency-safe transactions

## 1. Product Summary

Raqam is a university wallet simulation. A student signs up with:
- `name`
- `email`
- `password`

After signup:
- a profile is created automatically
- a wallet is created automatically
- the wallet gets a unique public 4-digit code from `0000` to `9999`
- the wallet receives a starting fake balance of `PKR 10,000`
- an active QR token is generated for receive-money flows

Students can:
- log in with email and password
- view balance and recent activity
- edit their display name
- send money by 4-digit wallet code
- send money by QR code
- receive money by sharing wallet code or QR

The product is a fake-money academic simulation. No real payment rails are involved.

## 2. Academic Goal

The real value of the project is the database design and transaction correctness.

The system must clearly demonstrate:
- normalization
- triggers
- stored procedures / RPC functions
- row-level security
- transactional rollback
- concurrency control with row locking
- idempotency for weak networks
- joins, views, and reporting
- audit logging

## 3. Identity Model

There are three distinct identities:

1. `auth.users.id`
   This is the real authenticated user identity from Supabase Auth.

2. `profiles`
   Stores editable user profile fields like `name` and `email`.

3. `wallets.wallet_code`
   This is the public payment identity.
   It is always a unique 4-digit string such as `0421` or `9007`.

Important rule:
- names are not unique
- emails are unique for login
- wallet codes are unique for transfers

## 4. Core User Flows

### 4.1 Signup

1. Student enters name, email, password.
2. Supabase Auth creates the user.
3. DB trigger calls wallet-creation logic.
4. Profile row is inserted.
5. Wallet row is inserted with unique 4-digit code.
6. Starting balance `1000000 paisa` is assigned.
7. QR token is generated.
8. User lands on wallet dashboard.

### 4.2 Login

1. Student enters email and password.
2. Supabase Auth creates a session.
3. Frontend loads wallet dashboard from database RPC.

### 4.3 Send by Wallet Code

1. Student enters recipient 4-digit code.
2. Frontend resolves code to recipient preview.
3. Student enters amount in PKR.
4. Frontend generates `idempotency_key`.
5. Frontend calls `transfer_money_by_code(...)`.
6. DB locks both wallets with `FOR UPDATE`.
7. DB rechecks balances after lock.
8. DB inserts transaction + ledger rows.
9. DB commits or rolls back fully.

### 4.4 Send by QR

1. Student opens scan screen.
2. Camera scans QR payload.
3. QR resolves to active recipient token.
4. Frontend calls `transfer_money_by_qr(...)`.
5. Transfer uses the same locking and rollback rules as code-based transfer.

### 4.5 Receive Money

1. Student opens receive screen.
2. Screen shows:
   - display name
   - 4-digit wallet code
   - QR code generated from active QR token
3. Another student can pay by code or scan.

### 4.6 Edit Name

1. Student edits display name.
2. Frontend calls `update_profile_name(...)`.
3. Only that student can update their own profile through RLS + auth checks.

## 5. Database Design

### 5.1 `profiles`

Purpose:
- user-facing profile data

Fields:
- `id uuid primary key references auth.users(id)`
- `email text unique not null`
- `name text not null`
- `created_at timestamptz`
- `updated_at timestamptz`

### 5.2 `wallets`

Purpose:
- one wallet per student

Fields:
- `id uuid primary key`
- `user_id uuid unique not null references profiles(id)`
- `wallet_code text unique not null check 4 digits`
- `balance_paisa bigint not null default 1000000`
- `status text not null default 'active'`
- `created_at timestamptz`
- `updated_at timestamptz`

### 5.3 `transactions`

Purpose:
- canonical transfer record

Fields:
- `id uuid primary key`
- `sender_wallet_id uuid not null`
- `receiver_wallet_id uuid not null`
- `amount_paisa bigint not null`
- `status text not null`
- `channel text not null`
- `note text null`
- `idempotency_key text not null`
- `related_transaction_id uuid null`
- `created_at timestamptz`
- `reversed_at timestamptz null`

Important constraints:
- sender and receiver cannot be same wallet
- `(sender_wallet_id, idempotency_key)` is unique

### 5.4 `ledger_entries`

Purpose:
- accounting trail for every balance movement

Rule:
- every completed transfer inserts exactly 2 rows:
  - one `debit`
  - one `credit`

Fields:
- `transaction_id`
- `wallet_id`
- `entry_type`
- `amount_paisa`
- `balance_before_paisa`
- `balance_after_paisa`

### 5.5 `qr_tokens`

Purpose:
- QR receive-money identity

Fields:
- `wallet_id`
- `token`
- `is_active`
- `expires_at`
- `created_at`

### 5.6 `audit_logs`

Purpose:
- operational and academic audit trail

Tracks:
- wallet creation
- profile update
- transfer completion
- reversal

## 6. Normalization

The system is intentionally normalized for defense in viva:

- `auth.users` handles authentication only
- `profiles` handles editable identity data
- `wallets` handles payment state and balance
- `transactions` stores the business event
- `ledger_entries` stores accounting rows
- `qr_tokens` stores QR receive identities
- `audit_logs` stores operational evidence

This separation supports clean 3NF-style reasoning.

## 7. Required Functions / RPCs

### 7.1 `generate_unique_wallet_code()`

Responsibilities:
- generate 4-digit code
- retry on collision
- fail only after retry threshold

### 7.2 `create_student_wallet(p_user_id, p_email, p_name)`

Responsibilities:
- create or sync profile
- create wallet
- assign starting balance
- generate wallet code
- generate QR token
- write audit log

### 7.3 `update_profile_name(p_name)`

Responsibilities:
- allow logged-in user to update own display name
- reject invalid names
- write audit log

### 7.4 `lookup_recipient_by_code(p_wallet_code)`

Responsibilities:
- resolve a 4-digit code to recipient preview
- reject self-transfer
- reject inactive wallet

### 7.5 `lookup_recipient_by_qr(p_qr_token)`

Responsibilities:
- resolve QR token to recipient preview
- reject inactive or expired QR token

### 7.6 `execute_wallet_transfer(...)`

Internal helper.

Responsibilities:
- resolve sender wallet from `auth.uid()`
- enforce idempotency
- lock wallets deterministically
- re-read balances after lock
- reject frozen wallets
- reject insufficient funds
- update balances
- insert transaction
- insert two ledger rows
- write audit log
- return structured result

### 7.7 `transfer_money_by_code(...)`

Public RPC.

Responsibilities:
- resolve recipient by wallet code
- call internal transfer logic

### 7.8 `transfer_money_by_qr(...)`

Public RPC.

Responsibilities:
- resolve recipient by QR token
- call internal transfer logic

### 7.9 `reverse_transaction(...)`

Internal/admin/demo RPC.

Responsibilities:
- reverse a completed transaction
- lock both wallets
- restore balances atomically
- mark original transaction as reversed
- insert reversal transaction
- write audit log

### 7.10 `get_wallet_dashboard()`

Responsibilities:
- return profile summary
- return wallet summary
- return QR payload
- return recent activity pre-shaped for frontend

## 8. Concurrency Strategy

This is one of the most important parts of the project.

Every transfer must run inside a single PostgreSQL transaction.

Required sequence:
1. Resolve sender and receiver wallets.
2. Lock both rows using `SELECT ... FOR UPDATE`.
3. Lock in deterministic order to reduce deadlocks.
4. Re-check balances after locks are acquired.
5. Apply debit and credit.
6. Insert transaction.
7. Insert ledger rows.
8. Commit.
9. On any error, roll back the whole transfer.

Expected guarantee:
- no negative balance
- no partial debit
- no partial credit
- no double-spend from race conditions

## 9. Weak Network / Offline Handling

This must be handled both in frontend and backend.

### Frontend rules

- if device is offline, show `No internet connection.`
- if request times out, show:
  `We couldn't confirm the transfer because the network is unstable. Refresh your wallet before retrying.`
- disable buttons while requests are pending
- never assume success after a timeout

### Backend rule

Use `idempotency_key` for every transfer request.

Why:
- bad internet may cause user to tap confirm again
- request may succeed server-side while client times out
- retrying with same idempotency key must not create duplicate transfer

Expected behavior:
- same sender + same idempotency key returns existing transaction result
- duplicate charging does not occur

## 10. QR Rules

- QR must not expose mutable balance data
- QR should identify the receiver through token mapping
- frontend encodes QR payload as `raqam:<token>`
- scanner accepts:
  - valid Raqam QR payload
  - manual 4-digit code fallback

## 11. Security Rules

### Row Level Security

Authenticated user may:
- read own profile
- update own profile
- read own wallet
- read transactions where their wallet is sender or receiver
- read own ledger entries
- read own QR token

Authenticated user may not:
- directly update wallet balances
- directly insert transaction rows
- directly insert ledger rows
- directly mutate another profile or wallet

All money movement must happen through RPC functions only.

## 12. Reporting / Advanced SQL

The project includes reporting-friendly database artifacts:

- `v_transaction_feed`
  flattened join across sender, receiver, wallet codes, names, amounts, channels, statuses

- `v_daily_wallet_activity`
  CTE-based daily sent/received aggregation

These support presentation, admin inspection, and academic discussion.

## 13. Frontend-Backend Contract

### Auth
- signup: `name + email + password`
- login: `email + password`

### Dashboard
- profile name
- profile email
- balance
- wallet code
- QR payload
- recent transactions

### Send flow
- lookup by code or QR
- transfer with `idempotency_key`
- show exact error messages from RPC

### Receive flow
- show wallet code
- show QR

### Profile
- user can edit name only

## 14. Success Criteria

The final project is successful if:

1. Signup creates auth user, profile, wallet, code, balance, and QR automatically.
2. Every user gets a unique 4-digit wallet code.
3. Names can repeat without affecting payment identity.
4. Send by code works.
5. Send by QR works.
6. Balance updates atomically.
7. Duplicate submit on weak network does not duplicate money movement.
8. Failed transfers roll back completely.
9. Dashboard shows real balance and history.
10. The schema and logic can be defended clearly as an Advanced DBMS project.

## 15. Supabase Commands

From the project root `raqam/`:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Optional local workflow:

```bash
supabase start
supabase db reset
supabase migration list
```

If a new migration is needed later:

```bash
supabase migration new migration_name
```
