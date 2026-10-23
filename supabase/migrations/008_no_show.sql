-- =========================================================
-- 008. 노쇼 처리 (기획서: 무단 불참 시 포인트 환급 불가 + 페널티)
-- 이미 운영 중인 DB에 이 파일만 실행한다. (새로 설치할 때는 schema·functions.sql에 이미 포함됨)
--
-- 상담 종료 30분 후(채팅이 닫힌 뒤)에도 '진행 중'인 예약을 10분마다 자동 정리한다. 채팅 참여로 판단:
--   둘 다 메시지를 보냄            → 자동 완료(completed), 베테랑에게 지급
--   베테랑이 안 옴(청년만/둘 다 X)  → 노쇼(no_show, no_show_by = 'expert' / 'both'), 청년에게 전액 환불
--   청년이 안 옴(베테랑만 보냄)     → 노쇼(no_show, no_show_by = 'youth'), 환불 없이 베테랑에게 지급
-- 페널티
--   베테랑: 노쇼 1회 → 신뢰 등급 한 단계 하락(최고 신뢰 → 신뢰 베테랑), 2회 이상 → 경력 인증
--   청년: 최근 30일 노쇼 2회 이상이면 새 예약 제한
-- =========================================================

alter type public.booking_status add value if not exists 'no_show';

alter table public.bookings add column if not exists no_show_by text
  check (no_show_by in ('youth', 'expert', 'both'));
alter table public.bookings add column if not exists settled_at timestamptz;  -- 자동 정리된 시각

-- ---------- 자동 정리 ----------
-- 'no_show'는 방금 추가한 값이라 같은 실행 안에서 바로 쓸 수 없어 plpgsql 안에서만 쓴다 (실행될 때 평가됨)
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
      update public.profiles set points = points + b.price_points where id = b.expert_id;
    elsif not v_expert_spoke then
      -- 베테랑 불참 → 청년에게 전액 환불
      update public.bookings
      set status = 'no_show', no_show_by = case when v_youth_spoke then 'expert' else 'both' end, settled_at = now()
      where id = b.id;
      update public.profiles set points = points + b.price_points where id = b.youth_id;
    else
      -- 청년 불참 → 환불 없이 베테랑에게 지급
      update public.bookings set status = 'no_show', no_show_by = 'youth', settled_at = now() where id = b.id;
      update public.profiles set points = points + b.price_points where id = b.expert_id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 사용자는 직접 부를 수 없다 (예약 실행·관리자만)
revoke execute on function public.settle_overdue_bookings() from public, anon, authenticated;

-- ---------- 베테랑 노쇼 수 (예약 상세는 비공개, 개수만) ----------
create or replace function public.expert_no_show_count(p_expert_id uuid)
returns integer
language plpgsql stable
security definer set search_path = ''
as $$
begin
  return (
    select count(*)::integer from public.bookings
    where expert_id = p_expert_id and status::text = 'no_show' and no_show_by in ('expert', 'both')
  );
end;
$$;

-- ---------- 신뢰 등급에 노쇼 반영 (기존 컬럼 순서 유지, no_show_count는 맨 뒤에 추가) ----------
create or replace view public.expert_cards
with (security_invoker = true) as
with base as (
  select
    e.id,
    p.name,
    p.avatar_url,
    e.headline,
    e.industry,
    e.career_years,
    e.keywords,
    e.price_points,
    coalesce(round(avg(r.rating), 1), 0) as rating,
    count(r.id) as review_count,
    concat_ws(' ', p.name, e.headline, e.industry, e.career_summary, array_to_string(e.keywords, ' ')) as search_text,
    public.expert_completed_count(e.id) as completed_count,
    public.expert_no_show_count(e.id) as no_show_count
  from public.experts e
  join public.profiles p on p.id = e.id
  left join public.reviews r on r.expert_id = e.id
  where e.verification = 'approved'
  group by e.id, p.id
),
graded as (
  select *,
    case
      when no_show_count >= 2 then 'bronze'
      when career_years >= 25 and completed_count >= 2 and rating >= 4.5 then
        case when no_show_count = 1 then 'silver' else 'gold' end
      when career_years >= 20 and completed_count >= 1 and rating >= 4.0 then
        case when no_show_count = 1 then 'bronze' else 'silver' end
      else 'bronze'
    end as trust_grade
  from base
)
select
  id, name, avatar_url, headline, industry, career_years, keywords, price_points,
  rating, review_count, search_text, completed_count,
  trust_grade,
  case trust_grade when 'gold' then '최고 신뢰' when 'silver' then '신뢰 베테랑' else '경력 인증' end as trust_label,
  array_remove(array[
    '경력 인증',
    case when career_years >= 30 then '30년+ 경력' when career_years >= 20 then '20년+ 경력' end,
    case when review_count >= 2 and rating >= 4.8 then '평점 최상위' end,
    case when completed_count >= 1 then '상담 ' || completed_count || '회' end
  ], null) as badges,
  no_show_count
from graded;

-- ---------- 청년: 최근 30일 노쇼 2회 이상이면 예약 제한 ----------
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

  update public.profiles set points = points - v_price
  where id = auth.uid() and points >= v_price;
  if not found then
    raise exception '포인트가 부족합니다.';
  end if;

  update public.availability_slots set is_booked = true where id = p_slot_id;

  insert into public.bookings (slot_id, youth_id, expert_id, topic, price_points)
  values (p_slot_id, auth.uid(), v_slot.expert_id, trim(p_topic), v_price)
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;

-- ---------- 10분마다 자동 정리 (pg_cron) ----------
-- @cron-start (로컬 테스트에서는 이 블록을 건너뜀)
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'settle-overdue-bookings';
select cron.schedule('settle-overdue-bookings', '*/10 * * * *', 'select public.settle_overdue_bookings()');
-- @cron-end
