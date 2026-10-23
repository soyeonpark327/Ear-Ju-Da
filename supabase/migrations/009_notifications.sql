-- =========================================================
-- 009. 알림함 (기획서: 예약 확정 시 양측에 알림)
-- 이미 운영 중인 DB에 이 파일만 실행한다. 새로 설치할 때도 seed 전에 실행 (README "DB 설치·변경" 참고)
--
-- 이메일은 소셜·휴대폰 가입자에게 실제 주소가 없어 보낼 수 없으므로, 화면 안 알림함(notifications)을 쓴다.
-- 알림은 DB가 자동으로 만든다 (트리거·예약 실행). 사용자는 본인 알림을 읽고 "읽음" 처리만 할 수 있다.
--
--   type                  받는 사람        언제
--   booking_new           베테랑           상담 예약됨
--   booking_confirmed     청년             상담 예약됨
--   booking_reminder      둘 다            상담 시작 30분 전 (5분마다 확인)
--   booking_cancelled     상대방           예약 취소
--   booking_completed     둘 다            상담 완료 (수동·자동)
--   booking_no_show       둘 다            노쇼 처리
--   report_ready          둘 다            AI 전략 보고서 생성
--   note_sold             작성자           오답노트 판매
--   review_new            베테랑           새 후기
--   verification_changed  베테랑           경력 인증 승인·반려
-- data: { booking_id, note_id } 등 화면 이동에 필요한 값
-- =========================================================

create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null default '',
  data       jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "본인 알림만 조회" on public.notifications;
create policy "본인 알림만 조회" on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists "본인 알림만 읽음 처리" on public.notifications;
create policy "본인 알림만 읽음 처리" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notifications from anon;
grant select on public.notifications to authenticated;
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- 실시간 수신 (알림 버튼 빨간 점)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

alter table public.bookings add column if not exists reminded_at timestamptz;  -- 30분 전 알림 보낸 시각

-- ---------- 도우미 ----------
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void
language sql
security definer set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, data) values (p_user, p_type, p_title, p_body, coalesce(p_data, '{}'));
$$;
revoke execute on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- 한국 시간 "11월 1일 14:00"
create or replace function public.kst_label(p_at timestamptz)
returns text
language sql stable
as $$
  select to_char(p_at at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일" HH24:MI');
$$;

-- ---------- 예약 ----------
create or replace function public.notify_booking()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_youth  text;
  v_expert text;
  v_start  timestamptz;
  v_when   text;
  v_data   jsonb := jsonb_build_object('booking_id', new.id);
  v_status text := new.status::text;  -- 'no_show'은 008에서 추가한 값이라 text로 비교
  v_pts    text := to_char(new.price_points, 'FM999,999,990');  -- 3,000
begin
  select name into v_youth from public.profiles where id = new.youth_id;
  select name into v_expert from public.profiles where id = new.expert_id;
  select start_at into v_start from public.availability_slots where id = new.slot_id;
  v_when := public.kst_label(v_start);

  if tg_op = 'INSERT' then
    if v_status <> 'confirmed' then return new; end if;  -- 지난 상담 데이터(데모 등)는 알리지 않는다
    perform public.notify(new.expert_id, 'booking_new', '새 상담 예약',
      format('%s님이 %s 상담을 예약했어요. "%s"', v_youth, v_when, left(new.topic, 60)), v_data);
    perform public.notify(new.youth_id, 'booking_confirmed', '예약이 확정됐어요',
      format('%s님과 %s 상담이에요. %sP는 상담이 끝날 때까지 보관돼요.', v_expert, v_when, v_pts), v_data);
    return new;
  end if;

  -- 상태가 바뀐 경우만 (confirmed → 다른 상태)
  if old.status::text <> 'confirmed' or v_status = 'confirmed' then return new; end if;

  if v_status = 'cancelled' then
    perform public.notify(new.youth_id, 'booking_cancelled', '상담이 취소됐어요',
      format('%s님과의 %s 상담이 취소됐어요. %sP가 환불됐어요.', v_expert, v_when, v_pts), v_data);
    perform public.notify(new.expert_id, 'booking_cancelled', '상담이 취소됐어요',
      format('%s님과의 %s 상담이 취소됐어요. 이 시간은 다시 예약을 받을 수 있어요.', v_youth, v_when), v_data);
  elsif v_status = 'completed' then
    perform public.notify(new.expert_id, 'booking_completed', '상담이 완료됐어요',
      format('%s님과의 상담이 끝났어요. %sP가 지급됐어요.', v_youth, v_pts), v_data);
    perform public.notify(new.youth_id, 'booking_completed', '상담이 완료됐어요',
      format('%s님과의 상담 내용을 AI 전략 보고서로 정리하고 후기를 남겨 보세요.', v_expert), v_data);
  elsif v_status = 'no_show' then
    if new.no_show_by = 'youth' then
      perform public.notify(new.youth_id, 'booking_no_show', '상담에 참여하지 않았어요',
        format('%s 상담에 참여하지 않아 %sP가 베테랑에게 지급됐어요.', v_when, v_pts), v_data);
      perform public.notify(new.expert_id, 'booking_no_show', '청년이 상담에 오지 않았어요',
        format('%s님이 %s 상담에 참여하지 않았어요. %sP가 지급됐어요.', v_youth, v_when, v_pts), v_data);
    else
      perform public.notify(new.youth_id, 'booking_no_show', '베테랑이 상담에 오지 않았어요',
        format('%s님이 %s 상담에 참여하지 않아 %sP가 전액 환불됐어요.', v_expert, v_when, v_pts), v_data);
      perform public.notify(new.expert_id, 'booking_no_show', '상담에 참여하지 않았어요',
        format('%s 상담이 노쇼로 처리됐어요. 신뢰 등급에 반영될 수 있어요.', v_when), v_data);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_booking_notify on public.bookings;
create trigger on_booking_notify
  after insert or update of status on public.bookings
  for each row execute function public.notify_booking();

-- ---------- 상담 30분 전 알림 (5분마다) ----------
create or replace function public.send_booking_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  b record;
  v_count integer := 0;
begin
  for b in
    select bk.id, bk.youth_id, bk.expert_id, s.start_at,
           (select name from public.profiles where id = bk.youth_id) as youth_name,
           (select name from public.profiles where id = bk.expert_id) as expert_name
    from public.bookings bk
    join public.availability_slots s on s.id = bk.slot_id
    where bk.status = 'confirmed' and bk.reminded_at is null
      and s.start_at between now() and now() + interval '30 minutes'
    for update of bk skip locked
  loop
    perform public.notify(b.youth_id, 'booking_reminder', '곧 상담이 시작돼요',
      format('%s %s님과의 상담이 곧 시작돼요. 10분 전부터 채팅할 수 있어요.', public.kst_label(b.start_at), b.expert_name),
      jsonb_build_object('booking_id', b.id));
    perform public.notify(b.expert_id, 'booking_reminder', '곧 상담이 시작돼요',
      format('%s %s님과의 상담이 곧 시작돼요. 10분 전부터 채팅할 수 있어요.', public.kst_label(b.start_at), b.youth_name),
      jsonb_build_object('booking_id', b.id));
    update public.bookings set reminded_at = now() where id = b.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.send_booking_reminders() from public, anon, authenticated;

-- ---------- AI 보고서 ----------
create or replace function public.notify_report()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  b record;
begin
  select youth_id, expert_id into b from public.bookings where id = new.booking_id;
  perform public.notify(b.youth_id, 'report_ready', 'AI 전략 보고서가 도착했어요',
    '상담 핵심 조언, 바로 실행할 체크리스트, 주의할 리스크를 정리했어요.', jsonb_build_object('booking_id', new.booking_id));
  perform public.notify(b.expert_id, 'report_ready', 'AI 전략 보고서가 만들어졌어요',
    '상담 내용을 정리한 보고서를 확인해 보세요.', jsonb_build_object('booking_id', new.booking_id));
  return new;
end;
$$;
drop trigger if exists on_report_notify on public.reports;
create trigger on_report_notify after insert on public.reports
  for each row execute function public.notify_report();

-- ---------- 오답노트 판매 ----------
create or replace function public.notify_note_sold()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  n record;
begin
  select author_id, title into n from public.notes where id = new.note_id;
  perform public.notify(n.author_id, 'note_sold', '오답노트가 판매됐어요',
    format('"%s" +%sP', left(n.title, 40), to_char(new.price_points, 'FM999,999,990')), jsonb_build_object('note_id', new.note_id));
  return new;
end;
$$;
drop trigger if exists on_note_sold_notify on public.note_purchases;
create trigger on_note_sold_notify after insert on public.note_purchases
  for each row execute function public.notify_note_sold();

-- ---------- 새 후기 ----------
create or replace function public.notify_review()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_youth text;
begin
  select name into v_youth from public.profiles where id = new.youth_id;
  perform public.notify(new.expert_id, 'review_new', '새 후기가 달렸어요',
    format('%s님 ★%s %s', v_youth, new.rating, coalesce(left(new.content, 50), '')),
    jsonb_build_object('booking_id', new.booking_id));
  return new;
end;
$$;
drop trigger if exists on_review_notify on public.reviews;
create trigger on_review_notify after insert on public.reviews
  for each row execute function public.notify_review();

-- ---------- 경력 인증 승인·반려 ----------
create or replace function public.notify_verification()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.verification is not distinct from old.verification then return new; end if;
  if new.verification = 'approved' then
    perform public.notify(new.id, 'verification_changed', '경력 인증이 완료됐어요',
      '이제 베테랑 목록에 노출되고 상담 예약을 받을 수 있어요.', '{}');
  elsif new.verification = 'rejected' then
    perform public.notify(new.id, 'verification_changed', '경력 증명서를 다시 확인해 주세요',
      '증명서로 경력을 확인하지 못했어요. 새 증명서를 올리면 다시 검토해요.', '{}');
  end if;
  return new;
end;
$$;
drop trigger if exists on_verification_notify on public.experts;
create trigger on_verification_notify after update of verification on public.experts
  for each row execute function public.notify_verification();

-- ---------- 5분마다 30분 전 알림 (pg_cron) ----------
-- @cron-start (로컬 테스트에서는 이 블록을 건너뜀)
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'booking-reminders';
select cron.schedule('booking-reminders', '*/5 * * * *', 'select public.send_booking_reminders()');
-- @cron-end
