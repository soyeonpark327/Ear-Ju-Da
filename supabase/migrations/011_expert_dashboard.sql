-- =========================================================
-- 011. 베테랑 대시보드 (기획서: 은퇴 베테랑의 수익 창출·평판)
-- 이미 운영 중인 DB에 이 파일만 실행한다. 새로 설치할 때도 010 다음에 실행 (README "DB 설치·변경" 참고)
--
-- get_my_expert_dashboard(): 로그인한 베테랑 본인의 활동 요약을 한 번에 돌려준다.
--   전문가 정보가 없으면 { registered: false }
-- + 005 버그 수정: 계정 삭제로 노트가 연쇄 삭제될 때 구매 수 트리거가 에러를 내던 문제 (seed 재실행 시)
-- =========================================================

create or replace function public.get_my_expert_dashboard()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_me      uuid := auth.uid();
  v_expert  public.experts%rowtype;
  v_card    record;
  v_kst_day timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_month   timestamptz := date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  v_result  jsonb;
begin
  if v_me is null then
    raise exception '로그인이 필요합니다.';
  end if;
  select * into v_expert from public.experts where id = v_me;
  if not found then
    return jsonb_build_object('registered', false);
  end if;
  select trust_grade, trust_label, badges, rating, review_count, no_show_count
    into v_card from public.expert_cards where id = v_me;  -- 승인 전이면 없음

  select jsonb_build_object(
    'registered', true,
    'profile', jsonb_build_object(
      'name', (select name from public.profiles where id = v_me),
      'headline', v_expert.headline,
      'verification', v_expert.verification,
      'has_certificate', v_expert.certificate_path is not null,
      'trust_grade', v_card.trust_grade,
      'trust_label', v_card.trust_label,
      'badges', coalesce(to_jsonb(v_card.badges), '[]'::jsonb),
      'rating', coalesce(v_card.rating, 0),
      'review_count', coalesce(v_card.review_count, 0),
      'no_show_count', coalesce(v_card.no_show_count, 0)
    ),
    'bookings', (
      select jsonb_build_object(
        'today',     count(*) filter (where b.status = 'confirmed' and s.start_at >= v_kst_day and s.start_at < v_kst_day + interval '1 day'),
        'this_week', count(*) filter (where b.status = 'confirmed' and s.start_at >= now() and s.start_at < now() + interval '7 days'),
        'upcoming',  count(*) filter (where b.status = 'confirmed' and s.end_at >= now()),
        'completed', count(*) filter (where b.status = 'completed'),
        'no_show',   count(*) filter (where b.status::text = 'no_show' and b.no_show_by in ('expert', 'both'))
      )
      from public.bookings b join public.availability_slots s on s.id = b.slot_id
      where b.expert_id = v_me
    ),
    'next_booking', (
      select jsonb_build_object('id', b.id, 'start_at', s.start_at, 'end_at', s.end_at, 'topic', b.topic,
                                'youth_name', (select name from public.profiles where id = b.youth_id))
      from public.bookings b join public.availability_slots s on s.id = b.slot_id
      where b.expert_id = v_me and b.status = 'confirmed' and s.end_at >= now()
      order by s.start_at limit 1
    ),
    'points', jsonb_build_object(
      'balance', (select points from public.profiles where id = v_me),
      'pending', (select coalesce(sum(price_points), 0) from public.bookings where expert_id = v_me and status = 'confirmed'),
      'earned_total', (select coalesce(sum(amount), 0) from public.point_transactions
                       where user_id = v_me and type in ('booking_payout', 'note_sale')),
      'earned_this_month', (select coalesce(sum(amount), 0) from public.point_transactions
                            where user_id = v_me and type in ('booking_payout', 'note_sale') and created_at >= v_month)
    ),
    'notes', (
      select jsonb_build_object(
        'published', count(*) filter (where n.is_published),
        'drafts', count(*) filter (where not n.is_published),
        'sold_count', coalesce(sum(n.purchase_count), 0),
        'sales_total', (select coalesce(sum(np.price_points), 0) from public.note_purchases np
                        join public.notes n2 on n2.id = np.note_id where n2.author_id = v_me)
      )
      from public.notes n where n.author_id = v_me
    ),
    'recent_reviews', coalesce((
      select jsonb_agg(r order by r.created_at desc) from (
        select rv.rating, rv.content, rv.created_at, (select name from public.profiles where id = rv.youth_id) as youth_name
        from public.reviews rv where rv.expert_id = v_me
        order by rv.created_at desc limit 3
      ) r
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.get_my_expert_dashboard() from public, anon;
grant execute on function public.get_my_expert_dashboard() to authenticated;

-- ---------- 005 버그 수정 ----------
create or replace function public.sync_note_purchase_count()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.notes set purchase_count = purchase_count + 1 where id = new.note_id;
  elsif tg_op = 'DELETE' then
    -- 계정 삭제로 노트까지 연쇄 삭제되는 중이면(작성자가 이미 없음) 건너뛴다
    update public.notes n set purchase_count = greatest(n.purchase_count - 1, 0)
    where n.id = old.note_id and exists (select 1 from public.experts e where e.id = n.author_id);
  end if;
  return null;
end;
$$;
