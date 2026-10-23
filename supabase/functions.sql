-- =========================================================
-- 포인트가 오가는 동작은 전부 이 함수들로만 처리한다.
-- 프론트에서 테이블을 직접 고치면 포인트를 조작할 수 있기 때문.
-- 호출 예) await supabase.rpc('purchase_note', { p_note_id: 3 })
-- =========================================================

-- ---------- 오답 노트 구매 ----------
-- 구매자 포인트 차감 → 작성자에게 지급 → 구매 기록
create function public.purchase_note(p_note_id bigint)
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


-- ---------- 상담 예약 ----------
-- 청년 포인트를 차감해서 보관(에스크로)하고 예약을 확정한다. 반환값: 예약 id
-- 최근 30일 노쇼 2회 이상이면 예약 제한
create function public.create_booking(p_slot_id bigint, p_topic text)
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


-- ---------- 상담 완료 ----------
-- 청년이 "상담 완료"를 누르면 보관 중이던 포인트를 베테랑에게 지급한다.
create function public.complete_booking(p_booking_id bigint)
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


-- ---------- 상담 취소 ----------
-- 상담 시작 전에만 취소 가능. 청년에게 포인트를 돌려주고 시간을 다시 연다.
create function public.cancel_booking(p_booking_id bigint)
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


-- ---------- 소셜 가입자 역할 선택 ----------
-- 역할 선택 (한 번만)
create or replace function public.choose_my_role(p_role public.user_role)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  update public.profiles set role = p_role, role_confirmed = true
  where id = auth.uid() and not role_confirmed;
  if not found then
    raise exception '이미 역할을 선택했습니다.';
  end if;
end;
$$;


-- ---------- 권한 ----------
-- 로그인한 사용자만 호출 가능
revoke execute on function public.purchase_note(bigint)        from public, anon;
revoke execute on function public.create_booking(bigint, text) from public, anon;
revoke execute on function public.complete_booking(bigint)     from public, anon;
revoke execute on function public.cancel_booking(bigint)       from public, anon;
grant  execute on function public.purchase_note(bigint)        to authenticated;
grant  execute on function public.create_booking(bigint, text) to authenticated;
grant  execute on function public.complete_booking(bigint)     to authenticated;
grant  execute on function public.cancel_booking(bigint)       to authenticated;
revoke execute on function public.choose_my_role(public.user_role) from public, anon;
grant  execute on function public.choose_my_role(public.user_role) to authenticated;


-- ---------- 노쇼 처리: 상담이 끝났는데 진행 중인 예약 자동 정리 ----------
create function public.settle_overdue_bookings()
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

-- 사용자는 직접 부를 수 없다 (예약 실행·관리자만)
revoke execute on function public.settle_overdue_bookings() from public, anon, authenticated;

-- ---------- 10분마다 자동 정리 (pg_cron) ----------
-- @cron-start (로컬 테스트에서는 이 블록을 건너뜀)
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'settle-overdue-bookings';
select cron.schedule('settle-overdue-bookings', '*/10 * * * *', 'select public.settle_overdue_bookings()');
-- @cron-end
