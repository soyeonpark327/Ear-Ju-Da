-- =========================================================
-- 014. 관리자: 베테랑 경력 인증 승인·반려 (기획서: 허위 스펙 방지 — 증명서 업로드 + 관리자 승인)
-- 이미 운영 중인 DB에 이 파일만 실행한다. 새로 설치할 때도 seed 전에 실행 (README "DB 설치·변경" 참고)
-- 007(증명서), 009(알림)가 먼저 실행돼 있어야 한다.
--
-- - profiles.is_admin: 관리자 여부. 사용자는 바꿀 수 없고(SQL로만), 화면은 관리자에게만 열린다
--     관리자 지정: update public.profiles set is_admin = true
--                  where id = (select id from auth.users where email = '관리자 이메일');
-- - experts.rejection_reason: 반려 사유 (베테랑 화면·알림에 보여줌, 승인되면 지움)
-- - admin_list_experts: 승인 대기·승인·반려 베테랑 목록 (이메일·증명서 경로 포함, 관리자만)
-- - admin_set_verification: 승인 / 반려(사유 필수) / 대기로 되돌리기
-- - admin_stats: 관리자 첫 화면 숫자 (회원·베테랑·상담·노트)
-- - 관리자는 모든 경력 증명서를 볼 수 있다 (Storage, 1분짜리 링크)
-- =========================================================

alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.experts add column if not exists rejection_reason text;
alter table public.experts add column if not exists reviewed_at timestamptz;

-- 사용자가 직접 바꿀 수 있는 컬럼은 그대로 (is_admin·rejection_reason은 함수로만)
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_url, senior_mode) on public.profiles to authenticated;

create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- 증명서: 관리자는 모두 조회 ----------
drop policy if exists "관리자는 모든 증명서 조회" on storage.objects;
create policy "관리자는 모든 증명서 조회"
  on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and public.is_admin());

-- ---------- 베테랑 목록 ----------
-- p_status: 'pending' | 'approved' | 'rejected' | null(전체)
create or replace function public.admin_list_experts(p_status text default 'pending')
returns table (
  id               uuid,
  name             text,
  email            text,
  headline         text,
  industry         text,
  career_years     integer,
  career_summary   text,
  keywords         text[],
  price_points     integer,
  verification     text,
  rejection_reason text,
  certificate_path text,
  created_at       timestamptz,
  reviewed_at      timestamptz
)
language plpgsql stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있어요.';
  end if;
  return query
    select e.id, p.name, u.email::text, e.headline, e.industry, e.career_years, e.career_summary, e.keywords,
           e.price_points, e.verification::text, e.rejection_reason, e.certificate_path, e.created_at, e.reviewed_at
    from public.experts e
    join public.profiles p on p.id = e.id
    left join auth.users u on u.id = e.id
    where p_status is null or e.verification::text = p_status
    order by (e.verification = 'pending') desc, e.created_at;
end;
$$;
revoke execute on function public.admin_list_experts(text) from public, anon;
grant execute on function public.admin_list_experts(text) to authenticated;

-- ---------- 승인·반려 ----------
create or replace function public.admin_set_verification(p_expert_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있어요.';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception '알 수 없는 상태예요.';
  end if;
  if p_status = 'rejected' and coalesce(trim(p_reason), '') = '' then
    raise exception '반려 사유를 적어 주세요. 베테랑에게 그대로 전달돼요.';
  end if;
  update public.experts
  set verification = p_status::public.verification_status,
      rejection_reason = case when p_status = 'rejected' then left(trim(p_reason), 300) end,
      reviewed_at = now()
  where id = p_expert_id;
  if not found then
    raise exception '베테랑 정보를 찾을 수 없어요.';
  end if;
end;
$$;
revoke execute on function public.admin_set_verification(uuid, text, text) from public, anon;
grant execute on function public.admin_set_verification(uuid, text, text) to authenticated;

-- 반려 알림에 사유를 담는다 (009의 알림 함수를 바꿈)
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
      coalesce('반려 사유: ' || new.rejection_reason || E'\n', '') || '새 증명서를 올리면 다시 검토해요.', '{}');
  end if;
  return new;
end;
$$;

-- 반려 후 새 증명서를 올리면 다시 대기 + 사유 지움 (007의 함수를 바꿈)
create or replace function public.reset_verification_on_new_certificate()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.certificate_path is distinct from old.certificate_path
     and new.certificate_path is not null
     and old.verification = 'rejected' then
    new.verification := 'pending';
    new.rejection_reason := null;
  end if;
  return new;
end;
$$;

-- ---------- 관리자 첫 화면 숫자 ----------
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 볼 수 있어요.';
  end if;
  return jsonb_build_object(
    'users',            (select count(*) from public.profiles),
    'youth',            (select count(*) from public.profiles where role = 'youth'),
    'veterans',         (select count(*) from public.profiles where role = 'veteran'),
    'experts_pending',  (select count(*) from public.experts where verification = 'pending'),
    'experts_approved', (select count(*) from public.experts where verification = 'approved'),
    'bookings_upcoming', (select count(*) from public.bookings where status = 'confirmed'),
    'bookings_completed', (select count(*) from public.bookings where status = 'completed'),
    'bookings_no_show', (select count(*) from public.bookings where status::text = 'no_show'),
    'notes_published',  (select count(*) from public.notes where is_published),
    'note_sales',       (select count(*) from public.note_purchases)
  );
end;
$$;
revoke execute on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
