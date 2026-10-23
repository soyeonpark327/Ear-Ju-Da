-- =========================================================
-- 012. 캘린더 보강 (기획서 외)
-- 이미 운영 중인 DB에 이 파일만 실행한다. 새로 설치할 때도 seed 전에 실행 (README "DB 설치·변경" 참고)
-- 009(kst_label)가 먼저 실행돼 있어야 한다.
--
-- 1) 같은 베테랑의 상담 시간은 겹칠 수 없다 (동시에 추가해도 DB에서 막음)
-- 2) 베테랑이 직접 여는 시간: 앞으로의 시간, 90일 이내, 길이 30분~3시간
-- 3) add_weekly_slots: "매주 화·목 14~18시, 1시간씩, 4주" 같은 반복 일정을 한 번에 만든다
--    이미 연 시간과 겹치거나 지난 시간은 건너뛰고 몇 개 만들었는지 알려준다
-- 4) delete_my_slots: 시간 삭제. 취소된 예약 기록이 남은 시간은 지우지 않고 닫는다
--    (예약 기록이 시간을 참조하고 있어서 지우면 오류가 났음)
--    "닫힌 시간" = is_booked = true 인데 진행 중·완료·노쇼 예약이 없는 시간. 목록·캘린더·겹침 검사에서 빠진다
-- 5) get_my_calendar: 베테랑 본인 일정 (열린 시간 + 예약 상태, 청년 이름, 상담 주제)
-- =========================================================

-- ---------- 1·2) 시간 추가·변경 검사 ----------
create or replace function public.check_availability_slot()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_len interval := new.end_at - new.start_at;
begin
  -- 사용자가 직접 추가할 때만 (seed·관리자 SQL은 지난 시간도 넣을 수 있게)
  if auth.uid() is not null then
    if new.start_at <= now() then
      raise exception '지난 시간은 열 수 없어요.';
    end if;
    if new.start_at > now() + interval '90 days' then
      raise exception '상담 시간은 오늘부터 90일 안으로만 열 수 있어요.';
    end if;
    if v_len < interval '30 minutes' or v_len > interval '3 hours' then
      raise exception '상담 시간은 30분에서 3시간 사이로 정해 주세요.';
    end if;
  end if;

  -- 같은 베테랑이 동시에 두 시간을 추가해도 하나씩 검사되도록 잠근다
  perform pg_advisory_xact_lock(hashtextextended(new.expert_id::text, 12));
  if exists (
    select 1 from public.availability_slots s
    where s.expert_id = new.expert_id
      and s.id is distinct from new.id
      and s.start_at < new.end_at and new.start_at < s.end_at
      and (not s.is_booked
           or exists (select 1 from public.bookings b where b.slot_id = s.id and b.status <> 'cancelled'))
  ) then
    raise exception using
      errcode = 'exclusion_violation',
      message = format('%s에 이미 열어 둔 상담 시간과 겹쳐요.', public.kst_label(new.start_at));
  end if;
  return new;
end;
$$;
revoke execute on function public.check_availability_slot() from public, anon, authenticated;

drop trigger if exists on_slot_check on public.availability_slots;
create trigger on_slot_check
  before insert or update of start_at, end_at on public.availability_slots
  for each row execute function public.check_availability_slot();

-- ---------- 3) 매주 반복 일정 ----------
-- p_weekdays: 0=일 1=월 ... 6=토 (JS getDay()와 같음)
-- p_start, p_end: 한국 시간 '14:00', '18:00'  /  p_minutes: 한 번 상담 길이  /  p_weeks: 몇 주 반복
-- p_from: 시작 날짜 (기본 오늘, 한국 날짜)
-- 반환: { created, skipped_overlap, skipped_past }
create or replace function public.add_weekly_slots(
  p_weekdays integer[],
  p_start    time,
  p_end      time,
  p_minutes  integer default 60,
  p_weeks    integer default 4,
  p_from     date default null
)
returns jsonb
language plpgsql
security invoker set search_path = ''
as $$
declare
  v_today   date := (now() at time zone 'Asia/Seoul')::date;
  v_from    date := coalesce(p_from, v_today);
  v_len     interval := make_interval(mins => p_minutes);
  v_per_day integer;
  v_day     date;
  v_t       time;
  v_start   timestamptz;
  v_created integer := 0;
  v_overlap integer := 0;
  v_past    integer := 0;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (select 1 from public.experts where id = auth.uid()) then
    raise exception '베테랑 프로필을 먼저 등록해 주세요.';
  end if;
  if coalesce(cardinality(p_weekdays), 0) = 0
     or exists (select 1 from unnest(p_weekdays) w where w is null or w not between 0 and 6) then
    raise exception '요일을 하나 이상 골라 주세요.';
  end if;
  if p_minutes is null or p_minutes not between 30 and 180 then
    raise exception '한 번 상담 길이는 30분에서 3시간 사이로 정해 주세요.';
  end if;
  if p_weeks is null or p_weeks not between 1 and 12 then
    raise exception '반복은 1주에서 12주까지 할 수 있어요.';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception '끝나는 시각이 시작 시각보다 늦어야 해요.';
  end if;
  v_per_day := floor(extract(epoch from (p_end - p_start)) / 60 / p_minutes);
  if v_per_day = 0 then
    raise exception '시간 범위가 상담 길이보다 짧아요.';
  end if;
  if v_from < v_today or v_from > v_today + 60 then
    raise exception '시작 날짜는 오늘부터 60일 안으로 골라 주세요.';
  end if;
  if (select count(distinct w) from unnest(p_weekdays) w) * p_weeks * v_per_day > 300 then
    raise exception '한 번에 300개까지 만들 수 있어요. 기간이나 시간 범위를 줄여 주세요.';
  end if;

  for v_day in select generate_series(v_from, v_from + p_weeks * 7 - 1, interval '1 day')::date loop
    continue when not (extract(dow from v_day)::integer = any (p_weekdays));
    for i in 0 .. v_per_day - 1 loop
      v_t := p_start + i * v_len;
      v_start := (v_day + v_t) at time zone 'Asia/Seoul';
      if v_start <= now() then
        v_past := v_past + 1;
        continue;
      end if;
      begin
        insert into public.availability_slots (expert_id, start_at, end_at)
        values (auth.uid(), v_start, v_start + v_len);
        v_created := v_created + 1;
      exception when exclusion_violation then
        v_overlap := v_overlap + 1;
      end;
    end loop;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped_overlap', v_overlap, 'skipped_past', v_past);
end;
$$;
revoke execute on function public.add_weekly_slots(integer[], time, time, integer, integer, date) from public, anon;
grant execute on function public.add_weekly_slots(integer[], time, time, integer, integer, date) to authenticated;

-- ---------- 4) 시간 삭제 ----------
-- 예약이 잡혀 있는 시간은 건드리지 않는다. 반환: 지우거나 닫은 개수
create or replace function public.delete_my_slots(p_ids bigint[])
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_closed  integer;
  v_deleted integer;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  -- 취소된 예약 기록이 있는 시간 → 닫기
  update public.availability_slots s set is_booked = true
  where s.id = any (p_ids) and s.expert_id = auth.uid() and not s.is_booked
    and exists (select 1 from public.bookings b where b.slot_id = s.id);
  get diagnostics v_closed = row_count;
  -- 나머지 열린 시간 → 삭제
  delete from public.availability_slots s
  where s.id = any (p_ids) and s.expert_id = auth.uid() and not s.is_booked;
  get diagnostics v_deleted = row_count;
  return v_closed + v_deleted;
end;
$$;
revoke execute on function public.delete_my_slots(bigint[]) from public, anon;
grant execute on function public.delete_my_slots(bigint[]) to authenticated;

-- ---------- 5) 베테랑 본인 일정 ----------
-- state: open(예약 가능) / confirmed(예약됨) / completed(완료) / no_show(노쇼)
-- 기간은 최대 62일 (한 달 화면 + 앞뒤 주)
create or replace function public.get_my_calendar(p_from timestamptz, p_to timestamptz)
returns table (
  slot_id    bigint,
  start_at   timestamptz,
  end_at     timestamptz,
  state      text,
  booking_id bigint,
  youth_name text,
  topic      text
)
language sql stable
security definer set search_path = ''
as $$
  select s.id, s.start_at, s.end_at,
         coalesce(b.status::text, 'open'),
         b.id, p.name, b.topic
  from public.availability_slots s
  left join public.bookings b on b.slot_id = s.id and b.status <> 'cancelled'
  left join public.profiles p on p.id = b.youth_id
  where s.expert_id = auth.uid()
    and s.start_at < p_to and s.end_at > p_from
    and p_to - p_from <= interval '62 days'
    and (not s.is_booked or b.id is not null)
  order by s.start_at;
$$;
revoke execute on function public.get_my_calendar(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_my_calendar(timestamptz, timestamptz) to authenticated;
