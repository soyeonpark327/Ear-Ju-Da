-- =========================================================
-- 이어주다 테이블 정의
-- 실행 순서: schema.sql → policies.sql → functions.sql
-- Supabase 대시보드 > SQL Editor에 붙여넣고 Run
-- =========================================================

-- ---------- 타입 ----------
create type public.user_role as enum ('youth', 'veteran');
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.booking_status as enum ('confirmed', 'completed', 'cancelled');


-- ---------- 회원 ----------
-- auth.users(Supabase 로그인 계정)와 1:1. 회원가입하면 트리거가 자동으로 만든다.
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null default 'youth',
  name        text not null,
  avatar_url  text,
  senior_mode boolean not null default false,
  points      integer not null default 10000 check (points >= 0),  -- 데모용 가입 보너스
  created_at  timestamptz not null default now()
);

-- 베테랑 전문가 정보. 베테랑 회원이 프로필을 작성하면 생긴다.
-- verification은 관리자가 대시보드 Table Editor에서 'approved'로 바꿔 승인한다.
create table public.experts (
  id               uuid primary key references public.profiles (id) on delete cascade,
  headline         text not null,                 -- 예) 자동차 부품사 구매팀 30년
  industry         text not null,                 -- 예) 제조
  career_years     integer not null check (career_years > 0),
  career_summary   text,                          -- 상세 경력
  keywords         text[] not null default '{}',  -- 예) {제조공정, 납품계약}
  price_points     integer not null default 0 check (price_points >= 0),  -- 상담 1회 가격
  verification     public.verification_status not null default 'pending',
  certificate_path text,                          -- Storage에 올린 경력 증명서 경로
  created_at       timestamptz not null default now()
);


-- ---------- 상담 예약 / 채팅 ----------
-- 베테랑이 열어둔 상담 가능 시간
create table public.availability_slots (
  id         bigint generated always as identity primary key,
  expert_id  uuid not null references public.experts (id) on delete cascade,
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  is_booked  boolean not null default false,
  check (end_at > start_at)
);

-- 예약. 직접 insert하지 않고 create_booking() 함수로만 만든다. (포인트 처리 때문)
create table public.bookings (
  id           bigint generated always as identity primary key,
  slot_id      bigint not null references public.availability_slots (id),
  youth_id     uuid not null references public.profiles (id),
  expert_id    uuid not null references public.experts (id),
  topic        text not null,                     -- 상담하고 싶은 고민
  price_points integer not null,                  -- 예약 당시 가격 (에스크로로 보관 중인 포인트)
  status       public.booking_status not null default 'confirmed',
  created_at   timestamptz not null default now()
);

create table public.messages (
  id         bigint generated always as identity primary key,
  booking_id bigint not null references public.bookings (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id),
  content    text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);

-- AI 전략 보고서. Edge Function이 상담 종료 후 만든다.
create table public.reports (
  booking_id bigint primary key references public.bookings (id) on delete cascade,
  summary    text not null,                       -- 핵심 조언
  checklist  jsonb not null default '[]',         -- 즉시 실행 체크리스트
  risks      jsonb not null default '[]',         -- 주의할 리스크
  created_at timestamptz not null default now()
);

-- 상담 후기
create table public.reviews (
  id         bigint generated always as identity primary key,
  booking_id bigint not null unique references public.bookings (id) on delete cascade,
  youth_id   uuid not null references public.profiles (id),
  expert_id  uuid not null references public.experts (id),
  rating     integer not null check (rating between 1 and 5),
  content    text,
  created_at timestamptz not null default now()
);


-- ---------- 오답 노트 ----------
-- 목록·미리보기용 정보 (누구나 볼 수 있음)
create table public.notes (
  id           bigint generated always as identity primary key,
  author_id    uuid not null references public.experts (id) on delete cascade,
  title        text not null,
  summary      text not null,                     -- 무료 미리보기
  industry     text not null,
  keywords     text[] not null default '{}',
  price_points integer not null default 0 check (price_points >= 0),
  is_published boolean not null default false,
  created_at   timestamptz not null default now()
);

-- 유료 본문. 구매자와 작성자만 볼 수 있도록 테이블을 따로 둔다.
create table public.note_contents (
  note_id bigint primary key references public.notes (id) on delete cascade,
  body    text not null
);

-- 구매 기록. 직접 insert하지 않고 purchase_note() 함수로만 만든다.
create table public.note_purchases (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  note_id      bigint not null references public.notes (id) on delete cascade,
  price_points integer not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, note_id)
);


-- ---------- 한 줄 조언 게시판 ----------
create table public.tips (
  id         bigint generated always as identity primary key,
  expert_id  uuid not null references public.experts (id) on delete cascade,
  content    text not null check (length(trim(content)) between 1 and 200),
  created_at timestamptz not null default now()
);


-- ---------- 인덱스 ----------
create index on public.experts using gin (keywords);
create index on public.notes using gin (keywords);
create index on public.availability_slots (expert_id, start_at);
-- 한 시간대에는 진행 중(취소 안 된) 예약이 하나만 (취소 후 다시 예약은 가능)
create unique index on public.bookings (slot_id) where status <> 'cancelled';
create index on public.bookings (youth_id);
create index on public.bookings (expert_id);
create index on public.messages (booking_id, created_at);
create index on public.tips (expert_id, created_at desc);


-- ---------- 회원가입 시 profiles 자동 생성 ----------
-- 이메일·전화번호 가입: 프론트에서 signUp 할 때 options.data에 { name, role } 을 넘긴다.
-- 구글·카카오 가입: 이름은 full_name·nickname 등에서 찾고, 역할은 청년(youth)으로 시작한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- 카카오는 사진 주소를 http://로 주기도 해서 https://로 바꾼다
  v_avatar text  := regexp_replace(coalesce(v_meta ->> 'avatar_url', v_meta ->> 'picture', ''), '^http://', 'https://');
begin
  insert into public.profiles (id, name, role, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(v_meta ->> 'name'), ''),
      nullif(trim(v_meta ->> 'full_name'), ''),
      nullif(trim(v_meta ->> 'nickname'), ''),
      nullif(trim(v_meta ->> 'user_name'), ''),
      nullif(trim(v_meta ->> 'preferred_username'), ''),
      case when new.email not like '%@phone.invalid' then nullif(split_part(new.email, '@', 1), '') end,
      '회원'
    ),
    case when v_meta ->> 'role' = 'veteran' then 'veteran'::public.user_role else 'youth'::public.user_role end,
    case when v_avatar like 'https://%' then v_avatar end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------- 화면용 뷰 ----------
-- 베테랑 목록 카드: 승인된 베테랑 + 이름 + 평점 + 검색용 텍스트 + 신뢰 등급·뱃지
-- 등급 기준 (gold / silver / bronze)
--   gold   : 경력 25년 이상 + 완료 상담 2회 이상 + 평점 4.5 이상
--   silver : 경력 20년 이상 + 완료 상담 1회 이상 + 평점 4.0 이상
--   bronze : 관리자 승인(경력 인증)을 받은 베테랑
-- 완료한 상담 수. bookings는 당사자만 볼 수 있어서(RLS) 개수만 공개하는 함수로 센다.
create or replace function public.expert_completed_count(p_expert_id uuid)
returns integer
language sql stable
security definer set search_path = ''
as $$
  select count(*)::integer from public.bookings
  where expert_id = p_expert_id and status = 'completed';
$$;

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
    public.expert_completed_count(e.id) as completed_count
  from public.experts e
  join public.profiles p on p.id = e.id
  left join public.reviews r on r.expert_id = e.id
  where e.verification = 'approved'
  group by e.id, p.id
),
graded as (
  select *,
    case
      when career_years >= 25 and completed_count >= 2 and rating >= 4.5 then 'gold'
      when career_years >= 20 and completed_count >= 1 and rating >= 4.0 then 'silver'
      else 'bronze'
    end as trust_grade
  from base
)
select *,
  case trust_grade when 'gold' then '최고 신뢰' when 'silver' then '신뢰 베테랑' else '경력 인증' end as trust_label,
  array_remove(array[
    '경력 인증',
    case when career_years >= 30 then '30년+ 경력' when career_years >= 20 then '20년+ 경력' end,
    case when review_count >= 2 and rating >= 4.8 then '평점 최상위' end,
    case when completed_count >= 1 then '상담 ' || completed_count || '회' end
  ], null) as badges
from graded;


-- ---------- 테이블 권한 ----------
-- 기본 권한: 비로그인(anon)은 읽기만, 로그인(authenticated)은 읽기·쓰기.
-- 실제로 어떤 행을 읽고 쓸 수 있는지는 policies.sql의 RLS가 정한다.
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke insert, update, delete on all tables in schema public from anon;

-- 포인트·역할·승인 상태처럼 사용자가 마음대로 바꾸면 안 되는 컬럼은 수정 권한을 뺀다.
revoke insert, update on public.profiles from anon, authenticated;
grant update (name, avatar_url, senior_mode) on public.profiles to authenticated;

revoke insert, update on public.experts from anon, authenticated;
grant insert (id, headline, industry, career_years, career_summary, keywords, price_points, certificate_path)
  on public.experts to authenticated;
grant update (headline, industry, career_years, career_summary, keywords, price_points, certificate_path)
  on public.experts to authenticated;

revoke update on public.availability_slots from anon, authenticated;  -- is_booked는 함수로만 변경
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.reports from anon, authenticated;
revoke insert, update, delete on public.note_purchases from anon, authenticated;

revoke update on public.notes from anon, authenticated;
grant update (title, summary, industry, keywords, price_points, is_published) on public.notes to authenticated;


-- ---------- 실시간 채팅 ----------
alter publication supabase_realtime add table public.messages;
