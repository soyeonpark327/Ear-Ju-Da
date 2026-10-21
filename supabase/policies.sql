-- =========================================================
-- RLS(Row Level Security) 정책
-- "누가 어떤 행을 읽고 쓸 수 있는가"를 정한다.
-- RLS를 켠 테이블은 정책에 맞는 행만 보이고, 정책이 없는 동작은 전부 막힌다.
-- =========================================================

alter table public.profiles           enable row level security;
alter table public.experts            enable row level security;
alter table public.availability_slots enable row level security;
alter table public.bookings           enable row level security;
alter table public.messages           enable row level security;
alter table public.reports            enable row level security;
alter table public.reviews            enable row level security;
alter table public.notes              enable row level security;
alter table public.note_contents      enable row level security;
alter table public.note_purchases     enable row level security;
alter table public.tips               enable row level security;


-- ---------- 도우미 함수 ----------
-- 로그인한 사용자의 역할
create function public.my_role()
returns public.user_role
language sql stable
security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- 로그인한 사용자가 이 예약의 청년 또는 베테랑인가
create function public.is_booking_participant(p_booking_id bigint)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.bookings
    where id = p_booking_id
      and auth.uid() in (youth_id, expert_id)
  );
$$;


-- ---------- profiles ----------
create policy "누구나 프로필 조회"
  on public.profiles for select
  using (true);

create policy "본인 프로필만 수정"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ---------- experts ----------
create policy "승인된 베테랑 또는 본인 조회"
  on public.experts for select
  using (verification = 'approved' or id = auth.uid());

create policy "베테랑 회원만 본인 전문가 정보 작성"
  on public.experts for insert to authenticated
  with check (id = auth.uid() and public.my_role() = 'veteran');

create policy "본인 전문가 정보만 수정"
  on public.experts for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());


-- ---------- availability_slots ----------
create policy "누구나 상담 가능 시간 조회"
  on public.availability_slots for select
  using (true);

create policy "베테랑 본인만 시간 추가"
  on public.availability_slots for insert to authenticated
  with check (expert_id = auth.uid() and is_booked = false);

create policy "예약 안 된 본인 시간만 삭제"
  on public.availability_slots for delete to authenticated
  using (expert_id = auth.uid() and is_booked = false);


-- ---------- bookings ----------
-- 생성·변경은 create_booking / complete_booking / cancel_booking 함수로만
create policy "예약 당사자만 조회"
  on public.bookings for select to authenticated
  using (auth.uid() in (youth_id, expert_id));


-- ---------- messages ----------
create policy "예약 당사자만 메시지 조회"
  on public.messages for select to authenticated
  using (public.is_booking_participant(booking_id));

create policy "예약 당사자만 본인 이름으로 메시지 전송"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_booking_participant(booking_id)
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.status = 'confirmed'
    )
  );


-- ---------- reports ----------
-- 생성은 Edge Function(service role)이 한다
create policy "예약 당사자만 보고서 조회"
  on public.reports for select to authenticated
  using (public.is_booking_participant(booking_id));


-- ---------- reviews ----------
create policy "누구나 후기 조회"
  on public.reviews for select
  using (true);

create policy "완료된 상담의 청년만 후기 작성"
  on public.reviews for insert to authenticated
  with check (
    youth_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.youth_id = auth.uid()
        and b.expert_id = reviews.expert_id
        and b.status = 'completed'
    )
  );


-- ---------- notes ----------
create policy "공개된 노트 또는 본인 노트 조회"
  on public.notes for select
  using (is_published or author_id = auth.uid());

create policy "베테랑 본인만 노트 작성"
  on public.notes for insert to authenticated
  with check (author_id = auth.uid());

create policy "본인 노트만 수정"
  on public.notes for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "본인 노트만 삭제"
  on public.notes for delete to authenticated
  using (author_id = auth.uid());


-- ---------- note_contents ----------
create policy "작성자 또는 구매자만 본문 조회"
  on public.note_contents for select to authenticated
  using (
    exists (select 1 from public.notes n where n.id = note_id and n.author_id = auth.uid())
    or exists (select 1 from public.note_purchases np where np.note_id = note_contents.note_id and np.user_id = auth.uid())
  );

create policy "작성자만 본문 작성"
  on public.note_contents for insert to authenticated
  with check (exists (select 1 from public.notes n where n.id = note_id and n.author_id = auth.uid()));

create policy "작성자만 본문 수정"
  on public.note_contents for update to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id and n.author_id = auth.uid()))
  with check (exists (select 1 from public.notes n where n.id = note_id and n.author_id = auth.uid()));


-- ---------- note_purchases ----------
-- 생성은 purchase_note 함수로만
create policy "본인 구매 기록만 조회"
  on public.note_purchases for select to authenticated
  using (user_id = auth.uid());


-- ---------- tips ----------
create policy "누구나 한 줄 조언 조회"
  on public.tips for select
  using (true);

create policy "승인된 베테랑 본인만 작성"
  on public.tips for insert to authenticated
  with check (
    expert_id = auth.uid()
    and exists (select 1 from public.experts e where e.id = auth.uid() and e.verification = 'approved')
  );

create policy "본인 조언만 삭제"
  on public.tips for delete to authenticated
  using (expert_id = auth.uid());
