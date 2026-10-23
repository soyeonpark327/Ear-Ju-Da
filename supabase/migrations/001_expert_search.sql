-- =========================================================
-- 001. 베테랑 검색 개선
-- 이미 schema.sql을 실행한 DB에 이 파일만 실행한다. (새로 설치할 때는 schema.sql에 이미 포함됨)
--
-- expert_cards 뷰에 search_text(이름·소개·업종·경력·키워드)를 추가해서
-- "계약", "이정훈", "부품" 처럼 일부만 입력해도 찾을 수 있게 한다.
-- =========================================================

create or replace view public.expert_cards
with (security_invoker = true) as
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
  concat_ws(' ', p.name, e.headline, e.industry, e.career_summary, array_to_string(e.keywords, ' ')) as search_text
from public.experts e
join public.profiles p on p.id = e.id
left join public.reviews r on r.expert_id = e.id
where e.verification = 'approved'
group by e.id, p.id;
