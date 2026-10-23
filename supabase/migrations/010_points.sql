-- =========================================================
-- 010. 포인트 내역 + 데모 충전
-- 이미 운영 중인 DB에 이 파일만 실행한다. 새로 설치할 때도 seed 전에 실행 (README "DB 설치·변경" 참고)
--
-- point_transactions: 포인트가 바뀔 때마다 얼마나(amount, +/-), 왜(type) 바뀌었는지 자동 기록.
--   type: opening_balance(기존 잔액) | signup_bonus | bonus(이벤트·데모 지급) | charge | booking_hold | booking_refund | booking_payout
--         | note_purchase | note_sale | adjust(관리자가 직접 수정 등)
--   포인트를 바꾸는 함수가 바꾸기 직전에 set_point_reason()으로 이유를 남기면, profiles 트리거가 읽어서 기록한다.
-- charge_points(): 실제 결제 없는 데모 충전. 5,000 / 10,000 / 30,000P, 하루(한국 시간) 최대 50,000P
-- =========================================================

create table if not exists public.point_transactions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  amount        integer not null,                 -- +적립 / -사용
  balance_after integer not null,                 -- 바뀐 뒤 잔액
  type          text not null,
  ref           jsonb not null default '{}',      -- { booking_id } 또는 { note_id }
  created_at    timestamptz not null default now()
);
create index if not exists point_transactions_user_idx on public.point_transactions (user_id, created_at desc);

alter table public.point_transactions enable row level security;
drop policy if exists "본인 포인트 내역만 조회" on public.point_transactions;
create policy "본인 포인트 내역만 조회" on public.point_transactions for select to authenticated using (user_id = auth.uid());
revoke all on public.point_transactions from anon;
grant select on public.point_transactions to authenticated;
revoke insert, update, delete on public.point_transactions from authenticated;

-- 포인트를 바꾸기 직전에 이유를 남긴다 (이 트랜잭션 안에서만 유효)
create or replace function public.set_point_reason(p_reason text, p_ref jsonb default '{}')
returns void
language sql
security definer set search_path = ''
as $$
  select set_config('app.point_reason', p_reason, true), set_config('app.point_ref', coalesce(p_ref, '{}')::text, true);
$$;
revoke execute on function public.set_point_reason(text, jsonb) from public, anon, authenticated;

-- profiles.points가 바뀌면 내역 기록
create or replace function public.record_point_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_reason text := nullif(current_setting('app.point_reason', true), '');
  v_ref    jsonb := coalesce(nullif(current_setting('app.point_ref', true), '')::jsonb, '{}');
begin
  if tg_op = 'INSERT' then
    if new.points <> 0 then
      insert into public.point_transactions (user_id, amount, balance_after, type)
      values (new.id, new.points, new.points, 'signup_bonus');
    end if;
  elsif new.points <> old.points then
    insert into public.point_transactions (user_id, amount, balance_after, type, ref)
    values (new.id, new.points - old.points, new.points, coalesce(v_reason, 'adjust'), v_ref);
  end if;
  -- 같은 트랜잭션의 다음 변경이 이유를 잘못 물려받지 않게 비운다
  perform set_config('app.point_reason', '', true);
  perform set_config('app.point_ref', '', true);
  return new;
end;
$$;
drop trigger if exists on_points_change on public.profiles;
create trigger on_points_change
  after insert or update of points on public.profiles
  for each row execute function public.record_point_change();

-- 기존 회원: 지금 잔액을 첫 기록으로 (내역 합계 = 잔액이 되도록)
insert into public.point_transactions (user_id, amount, balance_after, type)
select p.id, p.points, p.points, 'opening_balance'
from public.profiles p
where p.points <> 0
  and not exists (select 1 from public.point_transactions t where t.user_id = p.id);

-- ---------- 데모 충전 ----------
create or replace function public.charge_points(p_amount integer)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_today integer;
  v_balance integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_amount not in (5000, 10000, 30000) then
    raise exception '5,000P, 10,000P, 30,000P 중에서 골라주세요.';
  end if;
  select coalesce(sum(amount), 0) into v_today
  from public.point_transactions
  where user_id = auth.uid() and type = 'charge'
    and created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  if v_today + p_amount > 50000 then
    raise exception '하루에 50,000P까지 충전할 수 있어요. (오늘 %P 충전함)', to_char(v_today, 'FM999,999,990');
  end if;
  perform public.set_point_reason('charge');
  update public.profiles set points = points + p_amount where id = auth.uid()
  returning points into v_balance;
  return v_balance;
end;
$$;
revoke execute on function public.charge_points(integer) from public, anon;
grant execute on function public.charge_points(integer) to authenticated;

-- ---------- 포인트를 바꾸는 기존 함수들: 바꾸기 직전에 이유를 남기도록 갱신 ----------
create or replace function public.purchase_note(p_note_id bigint)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_note public.notes%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_note from public.notes where id = p_note_id and is_published;
  if not found then
    raise exception '존재하지 않는 노트입니다.';
  end if;
  if v_note.author_id = auth.uid() then
    raise exception '본인이 작성한 노트입니다.';
  end if;
  if exists (select 1 from public.note_purchases where user_id = auth.uid() and note_id = p_note_id) then
    raise exception '이미 구매한 노트입니다.';
  end if;

  perform public.set_point_reason('note_purchase', jsonb_build_object('note_id', p_note_id));
  update public.profiles set points = points - v_note.price_points
  where id = auth.uid() and points >= v_note.price_points;
  if not found then
    raise exception '포인트가 부족합니다.';
  end if;

  perform public.set_point_reason('note_sale', jsonb_build_object('note_id', p_note_id));
  update public.profiles set points = points + v_note.price_points
  where id = v_note.author_id;

  insert into public.note_purchases (user_id, note_id, price_points)
  values (auth.uid(), p_note_id, v_note.price_points);
end;
$$;

create or replace function public.create_booking(p_slot_id bigint, p_topic text)
returns bigint
language plpgsql
security definer set search_path = ''
as $$
declare
  v_slot       public.availability_slots%rowtype;
  v_price      integer;
  v_booking_id bigint;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if coalesce(trim(p_topic), '') = '' then
    raise exception '상담 주제를 입력해 주세요.';
  end if;
  if (
    select count(*) from public.bookings
    where youth_id = auth.uid() and status::text = 'no_show' and no_show_by in ('youth', 'both')
      and settled_at > now() - interval '30 days'
  ) >= 2 then
    raise exception '최근 30일 동안 상담에 2번 이상 참여하지 않아 예약이 제한됐어요.';
  end if;

  -- for update: 두 사람이 동시에 같은 시간을 예약하는 것을 막는다
  select * into v_slot from public.availability_slots where id = p_slot_id for update;
  if not found then
    raise exception '존재하지 않는 시간입니다.';
  end if;
  if v_slot.is_booked then
    raise exception '이미 예약된 시간입니다.';
  end if;
  if v_slot.start_at <= now() then
    raise exception '지난 시간은 예약할 수 없습니다.';
  end if;
  if v_slot.expert_id = auth.uid() then
    raise exception '본인에게는 예약할 수 없습니다.';
  end if;

  select price_points into v_price from public.experts
  where id = v_slot.expert_id and verification = 'approved';
  if not found then
    raise exception '승인되지 않은 베테랑입니다.';
  end if;

  update public.availability_slots set is_booked = true where id = p_slot_id;

  insert into public.bookings (slot_id, youth_id, expert_id, topic, price_points)
  values (p_slot_id, auth.uid(), v_slot.expert_id, trim(p_topic), v_price)
  returning id into v_booking_id;

  -- 포인트가 부족하면 예외 → 위의 예약 생성도 함께 취소된다
  perform public.set_point_reason('booking_hold', jsonb_build_object('booking_id', v_booking_id));
  update public.profiles set points = points - v_price
  where id = auth.uid() and points >= v_price;
  if not found then
    raise exception '포인트가 부족합니다.';
  end if;

  return v_booking_id;
end;
$$;

create or replace function public.complete_booking(p_booking_id bigint)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and youth_id = auth.uid()
  for update;
  if not found then
    raise exception '본인의 예약만 완료할 수 있습니다.';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception '진행 중인 예약이 아닙니다.';
  end if;

  update public.bookings set status = 'completed' where id = p_booking_id;
  perform public.set_point_reason('booking_payout', jsonb_build_object('booking_id', p_booking_id));
  update public.profiles set points = points + v_booking.price_points
  where id = v_booking.expert_id;
end;
$$;

create or replace function public.cancel_booking(p_booking_id bigint)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_start   timestamptz;
begin
  select * into v_booking from public.bookings
  where id = p_booking_id and auth.uid() in (youth_id, expert_id)
  for update;
  if not found then
    raise exception '본인의 예약만 취소할 수 있습니다.';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception '진행 중인 예약이 아닙니다.';
  end if;

  select start_at into v_start from public.availability_slots where id = v_booking.slot_id;
  if v_start <= now() then
    raise exception '이미 시작된 상담은 취소할 수 없습니다.';
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;
  perform public.set_point_reason('booking_refund', jsonb_build_object('booking_id', p_booking_id));
  update public.profiles set points = points + v_booking.price_points
  where id = v_booking.youth_id;
  update public.availability_slots set is_booked = false where id = v_booking.slot_id;
end;
$$;

create or replace function public.settle_overdue_bookings()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  b record;
  v_youth_spoke boolean;
  v_expert_spoke boolean;
  v_count integer := 0;
begin
  for b in
    select bk.*, s.start_at, s.end_at
    from public.bookings bk
    join public.availability_slots s on s.id = bk.slot_id
    where bk.status = 'confirmed'
      and s.end_at + interval '30 minutes' < now()
    for update of bk skip locked
  loop
    select
      bool_or(m.sender_id = b.youth_id),
      bool_or(m.sender_id = b.expert_id)
    into v_youth_spoke, v_expert_spoke
    from public.messages m
    where m.booking_id = b.id
      and m.created_at between b.start_at - interval '10 minutes' and b.end_at + interval '30 minutes';
    v_youth_spoke := coalesce(v_youth_spoke, false);
    v_expert_spoke := coalesce(v_expert_spoke, false);

    if v_youth_spoke and v_expert_spoke then
      -- 상담은 했는데 완료 버튼만 안 누름 → 자동 완료
      update public.bookings set status = 'completed', settled_at = now() where id = b.id;
      perform public.set_point_reason('booking_payout', jsonb_build_object('booking_id', b.id));
      update public.profiles set points = points + b.price_points where id = b.expert_id;
    elsif not v_expert_spoke then
      -- 베테랑 불참 → 청년에게 전액 환불
      update public.bookings
      set status = 'no_show', no_show_by = case when v_youth_spoke then 'expert' else 'both' end, settled_at = now()
      where id = b.id;
      perform public.set_point_reason('booking_refund', jsonb_build_object('booking_id', b.id));
      update public.profiles set points = points + b.price_points where id = b.youth_id;
    else
      -- 청년 불참 → 환불 없이 베테랑에게 지급
      update public.bookings set status = 'no_show', no_show_by = 'youth', settled_at = now() where id = b.id;
      perform public.set_point_reason('booking_payout', jsonb_build_object('booking_id', b.id));
      update public.profiles set points = points + b.price_points where id = b.expert_id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
