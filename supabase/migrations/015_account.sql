-- =========================================================
-- 015. 회원 탈퇴 (기획서 외, 개인정보 보호)
-- 이미 운영 중인 DB에 이 파일만 실행한다. 새로 설치할 때도 seed 전에 실행 (README "DB 설치·변경" 참고)
-- 010(포인트 내역), 014(관리자)가 먼저 실행돼 있어야 한다.
--
-- delete_my_account(): 본인 탈퇴
--   - 진행 중인(시작 전·상담 중) 예약이 있으면 막는다 → 먼저 취소하거나 상담을 마쳐야 함
--   - 활동 기록이 없으면 계정을 완전히 지운다 (프로필·알림·포인트 내역 등 연쇄 삭제)
--   - 상담·채팅·후기·노트 판매 기록이 있으면 상대방의 기록을 지키기 위해 "익명 처리"한다
--       이름 → '탈퇴한 회원', 사진·이메일·전화번호·소셜 연결 삭제, 다시 로그인 불가
--       베테랑: 목록에서 내림, 빈 상담 시간·한 줄 조언 삭제, 노트는 비공개 (이미 산 사람은 계속 열람)
--       남은 포인트는 소멸 (포인트 내역에 '포인트 조정'으로 기록)
--   - 경력 증명서 파일은 화면(js/api/auth.js deleteMyAccount)에서 먼저 지운다
-- =========================================================

alter table public.profiles add column if not exists deleted_at timestamptz;

create or replace function public.delete_my_account()
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_has_history boolean;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if exists (select 1 from public.bookings where status = 'confirmed' and v_uid in (youth_id, expert_id)) then
    raise exception '진행 중인 상담이 있어요. 예약을 취소하거나 상담을 마친 뒤 탈퇴해 주세요.';
  end if;

  v_has_history :=
       exists (select 1 from public.bookings where v_uid in (youth_id, expert_id))
    or exists (select 1 from public.messages where sender_id = v_uid)
    or exists (select 1 from public.reviews where youth_id = v_uid)
    or exists (select 1 from public.note_purchases np join public.notes n on n.id = np.note_id
               where n.author_id = v_uid and np.user_id <> v_uid);

  if not v_has_history then
    delete from auth.users where id = v_uid;  -- 프로필부터 알림·포인트 내역·노트·시간까지 연쇄 삭제
    return 'deleted';
  end if;

  -- ---------- 익명 처리 ----------
  -- 베테랑 활동 정리
  delete from public.availability_slots where expert_id = v_uid and not is_booked;
  delete from public.tips where expert_id = v_uid;
  update public.notes set is_published = false where author_id = v_uid;
  update public.experts
  set verification = 'rejected', rejection_reason = '회원 탈퇴', certificate_path = null,
      career_summary = null, keywords = '{}'
  where id = v_uid;

  -- 포인트 소멸 (내역에 남김)
  if (select points from public.profiles where id = v_uid) <> 0 then
    perform public.set_point_reason('adjust', jsonb_build_object('reason', 'account_deleted'));
    update public.profiles set points = 0 where id = v_uid;
  end if;

  update public.profiles
  set name = '탈퇴한 회원', avatar_url = null, senior_mode = false, is_admin = false, deleted_at = now()
  where id = v_uid;
  delete from public.notifications where user_id = v_uid;

  -- 로그인 정보 삭제 + 다시 로그인 불가
  update auth.users
  set email = 'deleted-' || v_uid || '@deleted.invalid',
      phone = null,
      encrypted_password = '',
      raw_user_meta_data = '{}'::jsonb,
      banned_until = 'infinity'
  where id = v_uid;
  delete from auth.identities where user_id = v_uid;
  delete from auth.sessions where user_id = v_uid;
  return 'anonymized';
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
