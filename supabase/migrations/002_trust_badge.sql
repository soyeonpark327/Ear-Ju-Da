-- =========================================================
-- 002. 베테랑 신뢰 등급 · 뱃지
-- 이미 운영 중인 DB에 이 파일만 실행한다. (새로 설치할 때는 schema.sql에 이미 포함됨)
--
-- expert_cards 뷰에 아래 컬럼을 추가한다.
--   completed_count : 완료한 상담 수
--   trust_grade     : 'gold' | 'silver' | 'bronze'  (화면 색상용)
--   trust_label     : '최고 신뢰' | '신뢰 베테랑' | '경력 인증'
--   badges          : 화면에 칩으로 보여줄 뱃지 목록 예) {경력 인증, 30년+ 경력, 평점 최상위, 상담 2회}
--
-- 등급 기준
--   gold   : 경력 25년 이상 + 완료 상담 2회 이상 + 평점 4.5 이상
--   silver : 경력 20년 이상 + 완료 상담 1회 이상 + 평점 4.0 이상
--   bronze : 관리자 승인(경력 인증)을 받은 베테랑
-- =========================================================

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
