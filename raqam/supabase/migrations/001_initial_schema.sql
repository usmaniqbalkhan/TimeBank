-- Enable crypto helpers for UUID generation and QR token creation.
create extension if not exists pgcrypto;

-- Store editable user profile data separately from auth and wallet state.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Store one wallet per user with a unique 4-digit public payment code.
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  wallet_code text not null unique check (wallet_code ~ '^[0-9]{4}$'),
  balance_paisa bigint not null default 1000000 check (balance_paisa >= 0),
  status text not null default 'active' check (status in ('active', 'frozen')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Store the canonical transfer record for every money movement.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  sender_wallet_id uuid not null references public.wallets (id) on delete restrict,
  receiver_wallet_id uuid not null references public.wallets (id) on delete restrict,
  amount_paisa bigint not null check (amount_paisa > 0),
  status text not null default 'completed' check (status in ('completed', 'failed', 'reversed')),
  channel text not null check (channel in ('code', 'qr', 'admin')),
  note text null,
  idempotency_key text not null,
  related_transaction_id uuid null references public.transactions (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  reversed_at timestamptz null,
  constraint transactions_sender_receiver_different check (sender_wallet_id <> receiver_wallet_id),
  constraint transactions_sender_idempotency_key_unique unique (sender_wallet_id, idempotency_key)
);

-- Store double-entry style debit and credit rows for every completed transfer.
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  entry_type text not null check (entry_type in ('debit', 'credit')),
  amount_paisa bigint not null check (amount_paisa > 0),
  balance_before_paisa bigint not null,
  balance_after_paisa bigint not null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Store active QR identities that map scan payloads to wallets.
create table if not exists public.qr_tokens (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  expires_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Store auditable operational events for admin review and viva explanation.
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid null references public.profiles (id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- Speed up wallet lookups by owner.
create index if not exists wallets_user_id_idx on public.wallets (user_id);
-- Speed up transaction lookups by sender.
create index if not exists transactions_sender_wallet_idx on public.transactions (sender_wallet_id);
-- Speed up transaction lookups by receiver.
create index if not exists transactions_receiver_wallet_idx on public.transactions (receiver_wallet_id);
-- Speed up recent activity queries.
create index if not exists transactions_created_at_idx on public.transactions (created_at desc);
-- Speed up ledger lookups by transaction.
create index if not exists ledger_entries_transaction_idx on public.ledger_entries (transaction_id);
-- Speed up ledger history queries per wallet.
create index if not exists ledger_entries_wallet_idx on public.ledger_entries (wallet_id, created_at desc);
-- Speed up QR lookups per wallet.
create index if not exists qr_tokens_wallet_idx on public.qr_tokens (wallet_id);
-- Enforce only one active QR token per wallet.
create unique index if not exists qr_tokens_one_active_per_wallet_idx on public.qr_tokens (wallet_id) where is_active = true;

-- done
-- Auto-maintain updated_at on mutable tables.
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Refresh profile updated_at before any profile update.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();

-- Refresh wallet updated_at before any wallet update.
drop trigger if exists wallets_set_updated_at on public.wallets;
create trigger wallets_set_updated_at
before update on public.wallets
for each row
execute function public.handle_updated_at();

-- Write a reusable audit log entry from business functions.
create or replace function public.write_audit_log(
  p_actor_user_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_logs (actor_user_id, event_type, entity_type, entity_id, payload)
  values (p_actor_user_id, p_event_type, p_entity_type, p_entity_id, coalesce(p_payload, '{}'::jsonb));
$$;

-- Generate a collision-safe 4-digit public wallet code.
create or replace function public.generate_unique_wallet_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_attempts integer := 0;
begin
  loop
    v_attempts := v_attempts + 1;
    v_code := lpad(floor(random() * 10000)::int::text, 4, '0');

    if not exists (
      select 1
      from public.wallets w
      where w.wallet_code = v_code
    ) then
      return v_code;
    end if;

    if v_attempts >= 100 then
      raise exception 'Unable to generate unique wallet code';
    end if;
  end loop;
end;
$$;

-- Generate a random QR token for receive-money identity.
create or replace function public.generate_qr_token()
returns text
language sql
security definer
set search_path = public
as $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

-- Create a full student wallet package after auth signup or backfill.
create or replace function public.create_student_wallet(
  p_user_id uuid,
  p_email text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_wallet_code text;
  v_qr_token text;
begin
  insert into public.profiles (id, email, name)
  values (
    p_user_id,
    lower(trim(p_email)),
    coalesce(nullif(trim(p_name), ''), 'Student')
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(excluded.name, ''), public.profiles.name);

  select w.id
  into v_wallet_id
  from public.wallets w
  where w.user_id = p_user_id;

  if v_wallet_id is null then
    v_wallet_code := public.generate_unique_wallet_code();

    insert into public.wallets (user_id, wallet_code, balance_paisa, status)
    values (p_user_id, v_wallet_code, 1000000, 'active')
    returning id into v_wallet_id;

    v_qr_token := public.generate_qr_token();

    insert into public.qr_tokens (wallet_id, token, is_active)
    values (v_wallet_id, v_qr_token, true);

    perform public.write_audit_log(
      p_user_id,
      'wallet_created',
      'wallet',
      v_wallet_id,
      jsonb_build_object(
        'wallet_code', v_wallet_code,
        'starting_balance_paisa', 1000000
      )
    );
  end if;

  return v_wallet_id;
end;
$$;

-- Automatically create profile, wallet, and QR identity for new auth users.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_student_wallet(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', 'Student')
  );

  return new;
end;
$$;

-- Attach the auto-wallet creation trigger to Supabase auth signups.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Let the logged-in user update only their own display name.
create or replace function public.update_profile_name(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to update your profile.';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Name must be at least 2 characters long.';
  end if;

  update public.profiles
  set name = trim(p_name)
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found.';
  end if;

  perform public.write_audit_log(
    auth.uid(),
    'profile_updated',
    'profile',
    v_profile.id,
    jsonb_build_object('name', v_profile.name)
  );

  return jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'email', v_profile.email,
    'updated_at', v_profile.updated_at
  );
end;
$$;

-- Resolve a 4-digit wallet code into a safe recipient preview.
create or replace function public.lookup_recipient_by_code(p_wallet_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient record;
begin
  select
    p.id,
    p.name,
    w.wallet_code
  into v_recipient
  from public.wallets w
  join public.profiles p on p.id = w.user_id
  where w.wallet_code = trim(p_wallet_code)
    and w.status = 'active'
    and w.user_id <> auth.uid()
  limit 1;

  if not found then
    raise exception 'Invalid ID';
  end if;

  return jsonb_build_object(
    'id', v_recipient.id,
    'name', v_recipient.name,
    'wallet_code', v_recipient.wallet_code
  );
end;
$$;

-- Resolve a QR token into a safe recipient preview.
create or replace function public.lookup_recipient_by_qr(p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := regexp_replace(trim(p_qr_token), '^raqam:', '', 'i');
  v_recipient record;
begin
  select
    p.id,
    p.name,
    w.wallet_code
  into v_recipient
  from public.qr_tokens q
  join public.wallets w on w.id = q.wallet_id
  join public.profiles p on p.id = w.user_id
  where q.token = v_token
    and q.is_active = true
    and (q.expires_at is null or q.expires_at > timezone('utc', now()))
    and w.status = 'active'
    and w.user_id <> auth.uid()
  order by q.created_at desc
  limit 1;

  if not found then
    raise exception 'Invalid QR code.';
  end if;

  return jsonb_build_object(
    'id', v_recipient.id,
    'name', v_recipient.name,
    'wallet_code', v_recipient.wallet_code
  );
end;
$$;

-- Perform the atomic transfer with locking, idempotency, audit, and ledger writes.
create or replace function public.execute_wallet_transfer(
  p_receiver_wallet_id uuid,
  p_amount_paisa bigint,
  p_channel text,
  p_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_wallet public.wallets%rowtype;
  v_receiver_wallet public.wallets%rowtype;
  v_existing public.transactions%rowtype;
  v_transaction_id uuid;
  v_sender_before bigint;
  v_receiver_before bigint;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to send money.';
  end if;

  if p_amount_paisa is null or p_amount_paisa <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'Missing idempotency key.';
  end if;

  select *
  into v_sender_wallet
  from public.wallets
  where user_id = auth.uid();

  if not found then
    raise exception 'Sender wallet not found.';
  end if;

  select *
  into v_existing
  from public.transactions
  where sender_wallet_id = v_sender_wallet.id
    and idempotency_key = trim(p_idempotency_key)
  limit 1;

  if found then
    return jsonb_build_object(
      'transaction_id', v_existing.id,
      'status', v_existing.status,
      'duplicate', true,
      'sender_balance_paisa', (select balance_paisa from public.wallets where id = v_sender_wallet.id),
      'receiver_balance_paisa', (select balance_paisa from public.wallets where id = v_existing.receiver_wallet_id)
    );
  end if;

  select *
  into v_receiver_wallet
  from public.wallets
  where id = p_receiver_wallet_id;

  if not found then
    raise exception 'Recipient wallet not found.';
  end if;

  if v_sender_wallet.id = v_receiver_wallet.id then
    raise exception 'You cannot send money to your own wallet.';
  end if;

  if v_sender_wallet.id::text < v_receiver_wallet.id::text then
    perform 1 from public.wallets where id = v_sender_wallet.id for update;
    perform 1 from public.wallets where id = v_receiver_wallet.id for update;
  else
    perform 1 from public.wallets where id = v_receiver_wallet.id for update;
    perform 1 from public.wallets where id = v_sender_wallet.id for update;
  end if;

  select * into v_sender_wallet from public.wallets where id = v_sender_wallet.id;
  select * into v_receiver_wallet from public.wallets where id = v_receiver_wallet.id;

  if v_sender_wallet.status <> 'active' then
    raise exception 'Your wallet is currently frozen.';
  end if;

  if v_receiver_wallet.status <> 'active' then
    raise exception 'The recipient wallet is unavailable.';
  end if;

  if v_sender_wallet.balance_paisa < p_amount_paisa then
    raise exception 'Insufficient Funds';
  end if;

  v_sender_before := v_sender_wallet.balance_paisa;
  v_receiver_before := v_receiver_wallet.balance_paisa;

  update public.wallets
  set balance_paisa = balance_paisa - p_amount_paisa
  where id = v_sender_wallet.id;

  update public.wallets
  set balance_paisa = balance_paisa + p_amount_paisa
  where id = v_receiver_wallet.id;

  insert into public.transactions (
    sender_wallet_id,
    receiver_wallet_id,
    amount_paisa,
    status,
    channel,
    note,
    idempotency_key
  )
  values (
    v_sender_wallet.id,
    v_receiver_wallet.id,
    p_amount_paisa,
    'completed',
    p_channel,
    nullif(trim(coalesce(p_note, '')), ''),
    trim(p_idempotency_key)
  )
  returning id into v_transaction_id;

  insert into public.ledger_entries (
    transaction_id,
    wallet_id,
    entry_type,
    amount_paisa,
    balance_before_paisa,
    balance_after_paisa
  )
  values
    (
      v_transaction_id,
      v_sender_wallet.id,
      'debit',
      p_amount_paisa,
      v_sender_before,
      v_sender_before - p_amount_paisa
    ),
    (
      v_transaction_id,
      v_receiver_wallet.id,
      'credit',
      p_amount_paisa,
      v_receiver_before,
      v_receiver_before + p_amount_paisa
    );

  perform public.write_audit_log(
    auth.uid(),
    'transfer_completed',
    'transaction',
    v_transaction_id,
    jsonb_build_object(
      'channel', p_channel,
      'amount_paisa', p_amount_paisa,
      'sender_wallet_id', v_sender_wallet.id,
      'receiver_wallet_id', v_receiver_wallet.id
    )
  );

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'status', 'completed',
    'duplicate', false,
    'sender_balance_paisa', v_sender_before - p_amount_paisa,
    'receiver_balance_paisa', v_receiver_before + p_amount_paisa
  );
exception
  when unique_violation then
    select *
    into v_existing
    from public.transactions
    where sender_wallet_id = v_sender_wallet.id
      and idempotency_key = trim(p_idempotency_key)
    limit 1;

    if found then
      return jsonb_build_object(
        'transaction_id', v_existing.id,
        'status', v_existing.status,
        'duplicate', true,
        'sender_balance_paisa', (select balance_paisa from public.wallets where id = v_sender_wallet.id),
        'receiver_balance_paisa', (select balance_paisa from public.wallets where id = v_existing.receiver_wallet_id)
      );
    end if;

    raise;
end;
$$;

-- Public RPC to transfer money using the recipient's 4-digit wallet code.
create or replace function public.transfer_money_by_code(
  p_receiver_code text,
  p_amount_paisa bigint,
  p_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_wallet_id uuid;
begin
  select w.id
  into v_receiver_wallet_id
  from public.wallets w
  where w.wallet_code = trim(p_receiver_code);

  if not found then
    raise exception 'Invalid ID';
  end if;

  return public.execute_wallet_transfer(
    v_receiver_wallet_id,
    p_amount_paisa,
    'code',
    p_note,
    p_idempotency_key
  );
end;
$$;

-- Public RPC to transfer money using the recipient's QR token.
create or replace function public.transfer_money_by_qr(
  p_qr_token text,
  p_amount_paisa bigint,
  p_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := regexp_replace(trim(p_qr_token), '^raqam:', '', 'i');
  v_receiver_wallet_id uuid;
begin
  select q.wallet_id
  into v_receiver_wallet_id
  from public.qr_tokens q
  join public.wallets w on w.id = q.wallet_id
  where q.token = v_token
    and q.is_active = true
    and (q.expires_at is null or q.expires_at > timezone('utc', now()))
    and w.status = 'active';

  if not found then
    raise exception 'Invalid QR code.';
  end if;

  return public.execute_wallet_transfer(
    v_receiver_wallet_id,
    p_amount_paisa,
    'qr',
    p_note,
    p_idempotency_key
  );
end;
$$;

-- Admin/demo RPC to reverse a previously completed transaction safely.
create or replace function public.reverse_transaction(
  p_transaction_id uuid,
  p_reason text default 'Manual reversal'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.transactions%rowtype;
  v_sender_wallet public.wallets%rowtype;
  v_receiver_wallet public.wallets%rowtype;
  v_reversal_tx_id uuid;
  v_sender_before bigint;
  v_receiver_before bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user <> 'postgres' then
    raise exception 'Only admin can reverse transactions.';
  end if;

  select *
  into v_original
  from public.transactions
  where id = p_transaction_id;

  if not found then
    raise exception 'Original transaction not found.';
  end if;

  if v_original.status <> 'completed' then
    raise exception 'Only completed transactions can be reversed.';
  end if;

  select * into v_sender_wallet from public.wallets where id = v_original.sender_wallet_id;
  select * into v_receiver_wallet from public.wallets where id = v_original.receiver_wallet_id;

  if v_sender_wallet.id::text < v_receiver_wallet.id::text then
    perform 1 from public.wallets where id = v_sender_wallet.id for update;
    perform 1 from public.wallets where id = v_receiver_wallet.id for update;
  else
    perform 1 from public.wallets where id = v_receiver_wallet.id for update;
    perform 1 from public.wallets where id = v_sender_wallet.id for update;
  end if;

  select * into v_sender_wallet from public.wallets where id = v_original.sender_wallet_id;
  select * into v_receiver_wallet from public.wallets where id = v_original.receiver_wallet_id;

  if v_receiver_wallet.balance_paisa < v_original.amount_paisa then
    raise exception 'Receiver balance is too low to reverse this transaction.';
  end if;

  v_sender_before := v_sender_wallet.balance_paisa;
  v_receiver_before := v_receiver_wallet.balance_paisa;

  update public.wallets
  set balance_paisa = balance_paisa + v_original.amount_paisa
  where id = v_sender_wallet.id;

  update public.wallets
  set balance_paisa = balance_paisa - v_original.amount_paisa
  where id = v_receiver_wallet.id;

  insert into public.transactions (
    sender_wallet_id,
    receiver_wallet_id,
    amount_paisa,
    status,
    channel,
    note,
    idempotency_key,
    related_transaction_id
  )
  values (
    v_receiver_wallet.id,
    v_sender_wallet.id,
    v_original.amount_paisa,
    'completed',
    'admin',
    nullif(trim(coalesce(p_reason, 'Manual reversal')), ''),
    concat('reversal-', p_transaction_id::text),
    v_original.id
  )
  returning id into v_reversal_tx_id;

  insert into public.ledger_entries (
    transaction_id,
    wallet_id,
    entry_type,
    amount_paisa,
    balance_before_paisa,
    balance_after_paisa
  )
  values
    (
      v_reversal_tx_id,
      v_receiver_wallet.id,
      'debit',
      v_original.amount_paisa,
      v_receiver_before,
      v_receiver_before - v_original.amount_paisa
    ),
    (
      v_reversal_tx_id,
      v_sender_wallet.id,
      'credit',
      v_original.amount_paisa,
      v_sender_before,
      v_sender_before + v_original.amount_paisa
    );

  update public.transactions
  set status = 'reversed',
      reversed_at = timezone('utc', now())
  where id = v_original.id;

  perform public.write_audit_log(
    null,
    'transaction_reversed',
    'transaction',
    p_transaction_id,
    jsonb_build_object(
      'reversal_transaction_id', v_reversal_tx_id,
      'reason', p_reason
    )
  );

  return jsonb_build_object(
    'original_transaction_id', p_transaction_id,
    'reversal_transaction_id', v_reversal_tx_id,
    'status', 'reversed'
  );
end;
$$;

-- Return the full wallet dashboard payload in one database call.
create or replace function public.get_wallet_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_wallet public.wallets%rowtype;
  v_qr public.qr_tokens%rowtype;
  v_recent_transactions jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to view the wallet.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  select * into v_wallet from public.wallets where user_id = auth.uid();

  if v_profile.id is null or v_wallet.id is null then
    raise exception 'Wallet not found for current user.';
  end if;

  select *
  into v_qr
  from public.qr_tokens
  where wallet_id = v_wallet.id
    and is_active = true
    and (expires_at is null or expires_at > timezone('utc', now()))
  order by created_at desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', recent.id,
        'amount_paisa', recent.amount_paisa,
        'status', recent.status,
        'channel', recent.channel,
        'note', recent.note,
        'created_at', recent.created_at,
        'direction', recent.direction,
        'counterpart_name', recent.counterpart_name,
        'counterpart_wallet_code', recent.counterpart_wallet_code
      )
      order by recent.created_at desc
    ),
    '[]'::jsonb
  )
  into v_recent_transactions
  from (
    select
      t.id,
      t.amount_paisa,
      t.status,
      t.channel,
      t.note,
      t.created_at,
      case
        when t.receiver_wallet_id = v_wallet.id then 'credit'
        else 'debit'
      end as direction,
      cp.name as counterpart_name,
      cw.wallet_code as counterpart_wallet_code
    from public.transactions t
    join public.wallets cw
      on cw.id = case
        when t.receiver_wallet_id = v_wallet.id then t.sender_wallet_id
        else t.receiver_wallet_id
      end
    join public.profiles cp on cp.id = cw.user_id
    where t.sender_wallet_id = v_wallet.id
       or t.receiver_wallet_id = v_wallet.id
    order by t.created_at desc
    limit 20
  ) as recent;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'name', v_profile.name,
      'email', v_profile.email
    ),
    'wallet', jsonb_build_object(
      'id', v_wallet.id,
      'wallet_code', v_wallet.wallet_code,
      'balance_paisa', v_wallet.balance_paisa,
      'status', v_wallet.status
    ),
    'qr', jsonb_build_object(
      'token', v_qr.token,
      'payload', concat('raqam:', v_qr.token)
    ),
    'recent_transactions', v_recent_transactions
  );
end;
$$;

-- Expose a readable joined transaction feed for reporting and demos.
create or replace view public.v_transaction_feed as
select
  t.id,
  t.amount_paisa,
  t.status,
  t.channel,
  t.note,
  t.created_at,
  sw.wallet_code as sender_wallet_code,
  sp.name as sender_name,
  rw.wallet_code as receiver_wallet_code,
  rp.name as receiver_name
from public.transactions t
join public.wallets sw on sw.id = t.sender_wallet_id
join public.profiles sp on sp.id = sw.user_id
join public.wallets rw on rw.id = t.receiver_wallet_id
join public.profiles rp on rp.id = rw.user_id;

-- Expose daily sent/received aggregates using a CTE-based movement stream.
create or replace view public.v_daily_wallet_activity as
with movement_stream as (
  select
    w.user_id,
    t.created_at::date as activity_date,
    'debit'::text as movement_type,
    t.amount_paisa
  from public.transactions t
  join public.wallets w on w.id = t.sender_wallet_id
  where t.status = 'completed'

  union all

  select
    w.user_id,
    t.created_at::date as activity_date,
    'credit'::text as movement_type,
    t.amount_paisa
  from public.transactions t
  join public.wallets w on w.id = t.receiver_wallet_id
  where t.status = 'completed'
)
select
  user_id,
  activity_date,
  sum(case when movement_type = 'credit' then amount_paisa else 0 end) as total_received_paisa,
  sum(case when movement_type = 'debit' then amount_paisa else 0 end) as total_sent_paisa,
  count(*) as movement_count
from movement_stream
group by user_id, activity_date;

-- Turn on row-level security for profiles.
alter table public.profiles enable row level security;
-- Turn on row-level security for wallets.
alter table public.wallets enable row level security;
-- Turn on row-level security for transactions.
alter table public.transactions enable row level security;
-- Turn on row-level security for ledger entries.
alter table public.ledger_entries enable row level security;
-- Turn on row-level security for QR tokens.
alter table public.qr_tokens enable row level security;
-- Turn on row-level security for audit logs.
alter table public.audit_logs enable row level security;

-- Allow users to read only their own profile row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

-- Allow users to update only their own profile row.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Allow users to read only their own wallet row.
drop policy if exists "wallets_select_own" on public.wallets;
create policy "wallets_select_own"
on public.wallets
for select
to authenticated
using (user_id = auth.uid());

-- Allow users to read only transactions involving their wallet.
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
on public.transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.wallets w
    where (w.id = sender_wallet_id or w.id = receiver_wallet_id)
      and w.user_id = auth.uid()
  )
);

-- Allow users to read only ledger entries tied to their wallet.
drop policy if exists "ledger_entries_select_own" on public.ledger_entries;
create policy "ledger_entries_select_own"
on public.ledger_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.wallets w
    where w.id = wallet_id
      and w.user_id = auth.uid()
  )
);

-- Allow users to read only QR tokens belonging to their wallet.
drop policy if exists "qr_tokens_select_own" on public.qr_tokens;
create policy "qr_tokens_select_own"
on public.qr_tokens
for select
to authenticated
using (
  exists (
    select 1
    from public.wallets w
    where w.id = wallet_id
      and w.user_id = auth.uid()
  )
);

-- Backfill profile and wallet records for any auth users that already exist.
do $$
declare
  auth_user record;
begin
  for auth_user in
    select
      u.id,
      u.email,
      coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1), 'Student') as display_name
    from auth.users u
  loop
    perform public.create_student_wallet(auth_user.id, auth_user.email, auth_user.display_name);
  end loop;
end;
$$;
