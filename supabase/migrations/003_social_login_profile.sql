-- =========================================================
-- 003. 소셜·전화번호 가입자 프로필 자동 생성 개선
-- 이미 운영 중인 DB에 이 파일만 실행한다. (새로 설치할 때는 schema.sql에 이미 포함됨)
--
-- 구글·카카오로 가입하면 이름이 name이 아니라 full_name, nickname 등에 들어온다.
-- 여러 위치에서 이름을 찾고, 프로필 사진(https)도 함께 저장한다.
-- 전화번호 가입자(내부용 주소 @phone.invalid)는 주소 앞부분을 이름으로 쓰지 않는다.
-- =========================================================

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
