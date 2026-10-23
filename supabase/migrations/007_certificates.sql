-- =========================================================
-- 007. 경력 증명서 업로드 (기획서: 허위 스펙 방지 1단계 — 파일 업로드 + 관리자 승인)
-- 이미 운영 중인 DB에 이 파일만 실행한다. (새로 설치할 때도 schema → policies → functions 다음에 이 파일 실행)
--
-- - Storage 비공개 버킷 certificates: 공개 주소 없음. 10MB 이하 PDF·이미지만.
-- - 파일 경로는 "<본인 id>/<파일 이름>". 각자 자기 폴더에만 올리고·보고·지울 수 있다.
-- - 관리자는 Supabase 대시보드 Storage에서 모든 파일을 보고, Table Editor에서 experts.verification을 바꿔 승인한다.
-- - 반려(rejected)된 베테랑이 증명서를 새로 올리면 자동으로 승인 대기(pending)로 돌아간다.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificates', 'certificates', false, 10 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "베테랑은 본인 폴더에 증명서 업로드" on storage.objects;
create policy "베테랑은 본인 폴더에 증명서 업로드"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'certificates'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_role() = 'veteran'
  );

drop policy if exists "본인 증명서만 조회" on storage.objects;
create policy "본인 증명서만 조회"
  on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "본인 증명서만 삭제" on storage.objects;
create policy "본인 증명서만 삭제"
  on storage.objects for delete to authenticated
  using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);

-- 전문가 정보의 증명서 경로는 본인 폴더 파일만 가리킬 수 있다
alter table public.experts drop constraint if exists experts_certificate_path_own_folder;
alter table public.experts add constraint experts_certificate_path_own_folder
  check (certificate_path is null or certificate_path like id::text || '/%');

-- 반려된 상태에서 증명서를 새로 올리면 다시 승인 대기로
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
  end if;
  return new;
end;
$$;

drop trigger if exists on_certificate_change on public.experts;
create trigger on_certificate_change
  before update of certificate_path on public.experts
  for each row execute function public.reset_verification_on_new_certificate();
