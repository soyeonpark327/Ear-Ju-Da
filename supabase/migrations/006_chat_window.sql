-- =========================================================
-- 006. 예약 시간에만 채팅 (기획서: "정해진 시간에 채팅방이 활성화")
-- 이미 운영 중인 DB에 이 파일만 실행한다. (새로 설치할 때는 policies.sql에 이미 포함됨)
--
-- 메시지 "보내기"는 상담 시작 10분 전 ~ 종료 30분 후, 진행 중(confirmed) 예약의 당사자만.
-- 지난 대화 "읽기"는 언제든 가능 (기존 정책 그대로).
-- =========================================================

-- 지금 이 예약에서 메시지를 보낼 수 있는가
create or replace function public.can_send_message(p_booking_id bigint)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    join public.availability_slots s on s.id = b.slot_id
    where b.id = p_booking_id
      and auth.uid() in (b.youth_id, b.expert_id)
      and b.status = 'confirmed'
      and now() between s.start_at - interval '10 minutes' and s.end_at + interval '30 minutes'
  );
$$;

drop policy if exists "예약 당사자만 본인 이름으로 메시지 전송" on public.messages;
create policy "상담 시간에 예약 당사자만 본인 이름으로 메시지 전송"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send_message(booking_id));
