-- =========================================================
-- 004. 소셜 가입자 역할 선택
-- 이미 운영 중인 DB에 이 파일만 실행한다. (새로 설치할 때는 schema.sql·functions.sql에 이미 포함됨)
--
-- 구글·카카오·네이버로 가입하면 역할(청년/베테랑)을 고르지 못한 채 청년으로 시작한다.
-- role_confirmed가 false인 사람만 choose_my_role()로 역할을 한 번 고를 수 있다.
-- =========================================================

alter table public.profiles add column if not exists role_confirmed boolean not null default false;

-- 기존 회원: 가입할 때 역할을 넘긴 사람(이메일·휴대폰·데모)은 확정, 소셜 가입자는 미확정
update public.profiles p
set role_confirmed = (u.raw_user_meta_data ? 'role')
from auth.users u
where u.id = p.id;

-- 가입 트리거: 가입 정보에 role이 있으면 확정으로 저장
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
  insert into public.profiles (id, name, role, role_confirmed, avatar_url)
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
    v_meta ? 'role',
    case when v_avatar like 'https://%' then v_avatar end
  );
  return new;
end;
$$;

-- 역할 선택 (한 번만)
create or replace function public.choose_my_role(p_role public.user_role)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  update public.profiles set role = p_role, role_confirmed = true
  where id = auth.uid() and not role_confirmed;
  if not found then
    raise exception '이미 역할을 선택했습니다.';
  end if;
end;
$$;

revoke execute on function public.choose_my_role(public.user_role) from public, anon;
grant  execute on function public.choose_my_role(public.user_role) to authenticated;
