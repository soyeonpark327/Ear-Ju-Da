-- =========================================================
-- 013. 예약 일정 변경 (기획서 외)
-- 이미 운영 중인 DB에 이 파일만 실행한다. 새로 설치할 때도 seed 전에 실행 (README "DB 설치·변경" 참고)
-- 009(알림), 012(캘린더)가 먼저 실행돼 있어야 한다.
--
-- 지금까지는 시간을 바꾸려면 취소 → 다시 예약해야 했다 (포인트가 환불됐다가 다시 빠지고, 채팅 기록도 따로 남음).
-- reschedule_booking: 같은 베테랑의 다른 빈 시간으로 예약을 옮긴다.
--   - 청년만 (베테랑은 채팅으로 요청 → 청년이 옮김)
--   - 상담 시작 전, 진행 중(confirmed) 예약만, 한 예약당 2번까지
--   - 포인트는 그대로 (예약 당시 가격 유지), 채팅방·메시지도 그대로
--   - 원래 시간은 다시 예약 가능해지고, 30분 전 알림은 새 시간 기준으로 다시 보낸다
--   - 양쪽에 알림 (booking_rescheduled)
-- =========================================================

alter table public.bookings add column if not exists reschedule_count integer not null default 0;
alter table public.bookings add column if not exists rescheduled_at timestamptz;

create or replace function public.reschedule_booking(p_booking_id bigint, p_new_slot_id bigint)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_booking  public.bookings%rowtype;
  v_old      public.availability_slots%rowtype;
  v_new      public.availability_slots%rowtype;
  v_youth    text;
  v_expert   text;
  v_data     jsonb := jsonb_build_object('booking_id', p_booking_id);
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or auth.uid() not in (v_booking.youth_id, v_booking.expert_id) then
    raise exception '본인의 예약만 변경할 수 있어요.';
  end if;
  if auth.uid() <> v_booking.youth_id then
    raise exception '일정 변경은 예약한 청년만 할 수 있어요. 채팅으로 원하는 시간을 알려 주세요.';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception '진행 중인 예약만 변경할 수 있어요.';
  end if;
  if v_booking.reschedule_count >= 2 then
    raise exception '일정은 한 예약당 2번까지 바꿀 수 있어요. 취소 후 다시 예약해 주세요.';
  end if;
  if v_booking.slot_id = p_new_slot_id then
    raise exception '지금 예약된 시간과 같은 시간이에요.';
  end if;

  -- 두 시간을 id 순서로 잠근다 (동시에 서로 바꾸려 할 때 교착 방지)
  perform 1 from public.availability_slots
  where id in (v_booking.slot_id, p_new_slot_id) order by id for update;
  select * into v_old from public.availability_slots where id = v_booking.slot_id;
  select * into v_new from public.availability_slots where id = p_new_slot_id;

  if v_old.start_at <= now() then
    raise exception '이미 시작된 상담은 변경할 수 없어요.';
  end if;
  if v_new.id is null or v_new.expert_id <> v_booking.expert_id then
    raise exception '같은 베테랑의 시간으로만 바꿀 수 있어요.';
  end if;
  if v_new.is_booked then
    raise exception '이미 예약된 시간이에요. 다른 시간을 골라 주세요.';
  end if;
  if v_new.start_at <= now() then
    raise exception '지난 시간으로는 바꿀 수 없어요.';
  end if;

  update public.availability_slots set is_booked = true where id = v_new.id;
  update public.availability_slots set is_booked = false where id = v_old.id;
  update public.bookings
  set slot_id = v_new.id,
      reschedule_count = reschedule_count + 1,
      rescheduled_at = now(),
      reminded_at = null
  where id = p_booking_id;

  select name into v_youth from public.profiles where id = v_booking.youth_id;
  select name into v_expert from public.profiles where id = v_booking.expert_id;
  perform public.notify(v_booking.expert_id, 'booking_rescheduled', '상담 시간이 바뀌었어요',
    format('%s님이 %s 상담 시간을 바꿨어요. 바뀐 시간: %s', v_youth, public.kst_label(v_old.start_at), public.kst_label(v_new.start_at)), v_data);
  perform public.notify(v_booking.youth_id, 'booking_rescheduled', '상담 시간을 바꿨어요',
    format('%s님과의 상담 시간: %s. 포인트는 그대로 보관돼요.', v_expert, public.kst_label(v_new.start_at)), v_data);
end;
$$;
revoke execute on function public.reschedule_booking(bigint, bigint) from public, anon;
grant execute on function public.reschedule_booking(bigint, bigint) to authenticated;
