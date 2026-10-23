-- =========================================================
-- 005. 인기 오답노트 (구매 수)
-- 이미 운영 중인 DB에 이 파일만 실행한다. (새로 설치할 때는 schema.sql에 이미 포함됨)
--
-- 구매 기록(note_purchases)은 본인 것만 보여서(RLS) 다른 사람은 구매 수를 셀 수 없다.
-- notes에 purchase_count를 두고, 구매 기록이 생기거나 지워질 때 트리거가 자동으로 맞춘다.
-- =========================================================

alter table public.notes add column if not exists purchase_count integer not null default 0;

-- 기존 구매 기록으로 채우기
update public.notes n
set purchase_count = (select count(*) from public.note_purchases p where p.note_id = n.id);

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

drop trigger if exists on_note_purchase_change on public.note_purchases;
create trigger on_note_purchase_change
  after insert or delete on public.note_purchases
  for each row execute function public.sync_note_purchase_count();

create index if not exists notes_popular_idx on public.notes (purchase_count desc, created_at desc);

-- 노트를 만들 때 구매 수를 직접 넣지 못하게 입력 가능한 칸을 제한한다
revoke insert on public.notes from anon, authenticated;
grant insert (author_id, title, summary, industry, keywords, price_points, is_published) on public.notes to authenticated;
