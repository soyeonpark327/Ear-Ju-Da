-- =========================================================
-- 016. 신고 · 차단 · 찜 (기획서 외)
-- 이미 운영 중인 DB에 이 파일만 실행한다. 새로 설치할 때도 seed 전에 실행. 014(관리자)가 먼저 실행돼 있어야 한다.
--
-- user_reports: 사람·노트·채팅을 신고 → 관리자 화면에서 처리
-- blocks: 차단하면 그 사람과 채팅 메시지를 주고받을 수 없다 (양쪽 모두)
-- favorites: 베테랑·오답노트 찜 (본인만 보임)
-- =========================================================

create table if not exists public.user_reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('user', 'note', 'booking')),
  target_id   text not null,
  reason      text not null check (char_length(trim(reason)) between 2 and 500),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.user_reports enable row level security;
drop policy if exists "본인 신고 작성" on public.user_reports;
create policy "본인 신고 작성" on public.user_reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists "본인 신고·관리자 조회" on public.user_reports;
create policy "본인 신고·관리자 조회" on public.user_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
revoke all on public.user_reports from anon;
revoke update, delete on public.user_reports from authenticated;
create unique index if not exists user_reports_once on public.user_reports (reporter_id, target_type, target_id) where status = 'open';

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists "본인 차단 관리" on public.blocks;
create policy "본인 차단 관리" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
revoke all on public.blocks from anon;
revoke update on public.blocks from authenticated;

create table if not exists public.favorites (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('expert', 'note')),
  target_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
alter table public.favorites enable row level security;
drop policy if exists "본인 찜 관리" on public.favorites;
create policy "본인 찜 관리" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.favorites from anon;
revoke update on public.favorites from authenticated;

-- 차단 관계면 메시지 전송 불가 (기존 전송 정책에 추가로 걸리는 제한 정책)
create or replace function public.is_blocked_in_booking(p_booking_id bigint)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b join public.blocks k
      on (k.blocker_id = b.youth_id and k.blocked_id = b.expert_id)
      or (k.blocker_id = b.expert_id and k.blocked_id = b.youth_id)
    where b.id = p_booking_id
  );
$$;
drop policy if exists "차단 관계면 메시지 전송 불가" on public.messages;
create policy "차단 관계면 메시지 전송 불가" on public.messages as restrictive for insert to authenticated
  with check (not public.is_blocked_in_booking(booking_id));

-- 관리자: 신고 목록·처리
create or replace function public.admin_list_reports(p_status text default 'open')
returns table (id bigint, reporter_name text, target_type text, target_id text, target_label text,
               reason text, status text, admin_note text, created_at timestamptz)
language plpgsql stable
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요.'; end if;
  return query
    select r.id, p.name, r.target_type, r.target_id,
           case r.target_type
             when 'user' then (select '회원: ' || pr.name from public.profiles pr where pr.id::text = r.target_id)
             when 'note' then (select '노트: ' || n.title from public.notes n where n.id::text = r.target_id)
             else '상담 #' || r.target_id
           end,
           r.reason, r.status, r.admin_note, r.created_at
    from public.user_reports r join public.profiles p on p.id = r.reporter_id
    where p_status is null or r.status = p_status
    order by r.created_at desc;
end;
$$;
revoke execute on function public.admin_list_reports(text) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;

create or replace function public.admin_resolve_report(p_id bigint, p_status text, p_note text default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요.'; end if;
  if p_status not in ('resolved', 'dismissed') then raise exception '알 수 없는 상태예요.'; end if;
  update public.user_reports set status = p_status, admin_note = p_note, resolved_at = now() where id = p_id;
  if not found then raise exception '신고를 찾을 수 없어요.'; end if;
end;
$$;
revoke execute on function public.admin_resolve_report(bigint, text, text) from public, anon;
grant execute on function public.admin_resolve_report(bigint, text, text) to authenticated;
