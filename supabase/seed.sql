-- =========================================================
-- 데모용 샘플 데이터
-- schema.sql → policies.sql → functions.sql 을 먼저 실행한 뒤 실행한다.
-- 다시 실행하면 기존 데모 데이터를 지우고 새로 만든다. (상담 시간은 실행 시점 기준 내일부터)
--
-- 데모 계정 (비밀번호 모두 demo1234!)
--   청년  kim@example.com   김대표 (기획서 시나리오 주인공)
--   청년  park@example.com  박청년
--   베테랑 lee@example.com   이정훈 (제조·납품계약)  외 베테랑 5명은 아래 참고
--   베테랑 oh@example.com    오명수 (승인 대기 상태 → 관리자 승인 데모용)
--   관리자 admin@example.com 관리자 (014 적용 후, 경력 인증 승인 화면 admin.html)
-- =========================================================

-- ---------- 기존 데모 데이터 삭제 ----------
-- @example.com 계정과 관련된 예약을 먼저 지우고, 계정을 지우면 나머지는 연쇄 삭제된다.
delete from public.bookings
where youth_id in (select id from auth.users where email like '%@example.com')
   or expert_id in (select id from auth.users where email like '%@example.com');
delete from public.note_purchases
where user_id in (select id from auth.users where email like '%@example.com')
   or note_id in (select n.id from public.notes n join auth.users u on u.id = n.author_id where u.email like '%@example.com');
delete from auth.users where email like '%@example.com';


-- ---------- 도우미 함수 (이 실행에서만 쓰고 사라짐) ----------
-- 로그인 가능한 데모 계정 생성. 트리거가 profiles도 자동으로 만든다.
create or replace function pg_temp.demo_user(p_email text, p_name text, p_role text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('demo1234!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', p_name, 'role', p_role), now(), now(),
    '', '', '', '', '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end;
$$;

-- 한국 시간 기준 "오늘부터 p_days일 뒤 p_hour시"
create or replace function pg_temp.kst(p_days integer, p_hour integer)
returns timestamptz
language sql
as $$
  select (date_trunc('day', now() at time zone 'Asia/Seoul') + make_interval(days => p_days, hours => p_hour))
         at time zone 'Asia/Seoul';
$$;

-- 지난 상담 하나를 통째로 만든다: 시간 → 완료된 예약 → 후기. 반환값: 예약 id
create or replace function pg_temp.past_booking(p_youth uuid, p_expert uuid, p_days_ago integer, p_topic text, p_rating integer, p_review text)
returns bigint
language plpgsql
as $$
declare
  v_slot bigint;
  v_booking bigint;
  v_price integer;
begin
  select price_points into v_price from public.experts where id = p_expert;
  insert into public.availability_slots (expert_id, start_at, end_at, is_booked)
  values (p_expert, pg_temp.kst(-p_days_ago, 19), pg_temp.kst(-p_days_ago, 20), true)
  returning id into v_slot;
  insert into public.bookings (slot_id, youth_id, expert_id, topic, price_points, status, created_at)
  values (v_slot, p_youth, p_expert, p_topic, v_price, 'completed', pg_temp.kst(-p_days_ago - 3, 10))
  returning id into v_booking;
  -- 지난 상담 수익을 베테랑에게 지급 (포인트 내역의 "상담 수익", 010 적용 전 DB에서는 건너뜀)
  if to_regprocedure('public.set_point_reason(text,jsonb)') is not null then
    perform public.set_point_reason('booking_payout', jsonb_build_object('booking_id', v_booking));
    update public.profiles set points = points + v_price where id = p_expert;
  end if;
  if p_rating is not null then
    insert into public.reviews (booking_id, youth_id, expert_id, rating, content, created_at)
    values (v_booking, p_youth, p_expert, p_rating, p_review, pg_temp.kst(-p_days_ago, 21));
  end if;
  return v_booking;
end;
$$;


do $seed$
declare
  -- 청년
  v_kim  uuid := pg_temp.demo_user('kim@example.com',  '김대표', 'youth');
  v_park uuid := pg_temp.demo_user('park@example.com', '박청년', 'youth');
  -- 베테랑
  v_lee   uuid := pg_temp.demo_user('lee@example.com',   '이정훈', 'veteran');
  v_mk    uuid := pg_temp.demo_user('mk@example.com',    '박미경', 'veteran');
  v_choi  uuid := pg_temp.demo_user('choi@example.com',  '최동수', 'veteran');
  v_ys    uuid := pg_temp.demo_user('ys@example.com',    '김영숙', 'veteran');
  v_jung  uuid := pg_temp.demo_user('jung@example.com',  '정성호', 'veteran');
  v_han   uuid := pg_temp.demo_user('han@example.com',   '한상철', 'veteran');
  v_oh    uuid := pg_temp.demo_user('oh@example.com',    '오명수', 'veteran');
  -- 관리자 (014 적용 전 DB에서는 일반 회원으로만 만들어짐)
  v_admin uuid := pg_temp.demo_user('admin@example.com', '관리자', 'youth');

  v_note    bigint;
  v_booking bigint;
  v_slot    bigint;
  v_expert  uuid;
  v_buy     record;
  d         integer;
begin
  -- ---------- 포인트 ----------
  -- 데모 중에 이것저것 사볼 수 있게 넉넉히 (포인트 내역에는 "이벤트 보너스"로 기록 → 하루 충전 한도와 무관, 010 적용 전 DB에서도 동작)
  if to_regprocedure('public.set_point_reason(text,jsonb)') is not null then
    perform public.set_point_reason('bonus');
  end if;
  update public.profiles set points = 50000 where id = v_kim;
  if to_regprocedure('public.set_point_reason(text,jsonb)') is not null then
    perform public.set_point_reason('bonus');
  end if;
  update public.profiles set points = 20000 where id = v_park;

  -- ---------- 베테랑 정보 ----------
  insert into public.experts (id, headline, industry, career_years, career_summary, keywords, price_points, verification) values
  (v_lee, '자동차 부품사 구매팀 30년', '제조', 30,
   E'1994~2024 국내 자동차 부품사 구매팀 (팀장 12년)\n협력사 200여 곳과 납품 계약·단가 협상 담당\n신규 협력사 발굴 및 품질 문제로 인한 계약 해지 분쟁 다수 경험',
   '{제조공정,납품계약,단가협상,협력사관리}', 3000, 'approved'),
  (v_mk, '대형마트 MD 25년', '유통', 25,
   E'대형마트 가공식품·생활용품 MD 25년\n중소기업 신규 입점 심사 연 300건 이상 검토\nPB 상품 기획 및 납품업체 재고·물류 관리',
   '{유통,입점,판로개척,재고관리}', 2500, 'approved'),
  (v_choi, '세무서 출신 세무사 28년', '세무', 28,
   E'국세청 세무서 조사과 15년, 이후 세무사 사무소 운영 13년\n스타트업·소상공인 기장 및 세무조사 대응\n정부 지원사업 사업비 정산 자문',
   '{세무,부가세,법인세,지원금정산}', 3000, 'approved'),
  (v_ys, '대기업 인사팀 27년', '인사·노무', 27,
   E'제조 대기업 인사팀 27년 (채용·노무·평가 담당)\n노사 협의 및 노동 분쟁 대응\n현재 스타트업 대상 인사 제도 자문',
   '{노무,채용,근로계약,조직관리}', 2500, 'approved'),
  (v_jung, '종합상사 해외영업 32년', '무역', 32,
   E'종합상사 해외영업 32년 (동남아·중동·남미 주재원 11년)\n40여 개국 바이어 발굴 및 수출 계약\n무역 사기·대금 미회수 사고 대응',
   '{수출,해외판로,무역사기,바이어}', 3500, 'approved'),
  (v_han, '외식 프랜차이즈 운영 22년', '외식', 22,
   E'외식 프랜차이즈 본사 점포개발팀 15년, 직영점 운영 7년\n매장 300곳 이상 상권 분석 및 출점 심사\n폐점 매장 원인 분석 및 회생 컨설팅',
   '{외식창업,상권분석,프랜차이즈,임대차}', 2000, 'approved'),
  (v_oh, '건설사 현장소장 26년', '건설', 26,
   E'중견 건설사 현장소장 26년\n하도급 계약 및 공정 관리',
   '{건설,하도급,공정관리}', 3000, 'pending');

  -- ---------- 상담 가능 시간 (내일부터 7일간) ----------
  foreach v_expert in array array[v_lee, v_mk, v_choi, v_ys, v_jung, v_han] loop
    for d in 1..7 loop
      if (d + ascii(v_expert::text)) % 3 <> 0 then  -- 베테랑마다 쉬는 날이 다르게
        insert into public.availability_slots (expert_id, start_at, end_at) values
          (v_expert, pg_temp.kst(d, 14), pg_temp.kst(d, 15)),
          (v_expert, pg_temp.kst(d, 19), pg_temp.kst(d, 20));
      end if;
    end loop;
  end loop;

  -- ---------- 오답 노트 ----------
  insert into public.notes (author_id, title, summary, industry, keywords, price_points, is_published, created_at)
  values (v_lee, '초보 창업가가 제조사 계약 시 놓치면 100% 손해 보는 조항 5가지',
    '첫 양산 계약에서 공장이 내미는 표준계약서, 그대로 도장 찍으면 안 됩니다. 30년간 구매팀에서 계약서를 검토하며 창업 기업이 가장 많이 당한 조항 5가지를 정리했습니다.',
    '제조', '{납품계약,제조공정,단가협상}', 2000, true, now() - interval '20 days')
  returning id into v_note;
  insert into public.note_contents (note_id, body) values (v_note,
E'1. 단가 조정 조항\n"원자재 가격 변동 시 협의하여 조정한다"는 문구는 결국 힘 있는 쪽이 정합니다. 조정 기준(원자재 지수, 변동 폭)과 주기를 숫자로 적어 두세요. 그래야 나중에 단가 인하 압박을 받았을 때 근거로 버틸 수 있습니다.\n\n2. 최소 발주 수량(MOQ)\n공장 입장에서 MOQ는 생산 라인을 돌리는 최소 조건입니다. 계약서에 연간 MOQ가 들어가 있으면 판매가 부진해도 그 수량만큼 사야 합니다. 첫 계약은 분기 단위로 짧게 잡으세요.\n\n3. 금형 소유권\n금형비를 우리가 냈는데 계약서에 소유권 언급이 없으면, 거래를 끊을 때 금형을 못 가져오는 경우가 많습니다. "금형 소유권은 발주자에게 있다"를 반드시 명시하세요.\n\n4. 불량 판정 기준과 책임\n불량률 기준(예: 0.5% 이하)과 검수 방법, 불량 발생 시 재생산 비용을 누가 내는지 적어야 합니다. 이게 없으면 불량이 나도 다음 발주 단가에 슬쩍 얹어집니다.\n\n5. 납기 지연 페널티는 양쪽 모두에게\n우리 쪽 대금 지급 지연에만 지연이자가 붙고, 공장 납기 지연에는 아무 조항이 없는 계약서가 흔합니다. 납기 지연 시 지체상금을 넣어 균형을 맞추세요.\n\n[체크리스트]\n- 단가 조정 기준이 숫자로 적혀 있는가\n- MOQ 기간이 사업 단계에 맞는가\n- 금형 소유권이 명시되어 있는가\n- 불량 기준과 비용 부담 주체가 있는가\n- 납기 지연 페널티가 양방향인가');

  insert into public.notes (author_id, title, summary, industry, keywords, price_points, is_published, created_at)
  values (v_jung, '해외 판로 개척 때 실제로 당한 무역 사기 4가지 유형',
    '"대량 주문하겠다"는 첫 이메일이 가장 위험합니다. 32년간 직접 겪거나 후배들이 당한 사기 수법과, 계약 전에 확인해야 할 신호를 정리했습니다.',
    '무역', '{수출,무역사기,바이어,해외판로}', 3000, true, now() - interval '15 days')
  returning id into v_note;
  insert into public.note_contents (note_id, body) values (v_note,
E'1. 샘플비·등록비 요구형\n큰 주문을 약속한 뒤 "우리 나라 수입 등록비", "인증 대행비"를 먼저 보내 달라고 합니다. 정상 바이어는 판매자에게 등록비를 요구하지 않습니다.\n\n2. 이메일 계정 탈취형 (BEC)\n실제 거래 중인 바이어의 메일을 해킹해 "계좌가 바뀌었다"고 보냅니다. 메일 주소 한 글자만 다른 경우도 많습니다. 계좌 변경 통보는 반드시 전화나 기존 연락처로 다시 확인하세요.\n\n3. 선적 후 대금 미지급형\n첫 거래부터 후불(T/T 선적 후 송금)을 고집하는 신규 바이어는 위험합니다. 첫 거래는 선수금 비율을 높이거나 신용장(L/C) 거래를 요구하세요.\n\n4. 위조 신용장형\n신용장을 받았다고 안심하면 안 됩니다. 반드시 거래 은행을 통해 발행 은행과 진위를 확인한 뒤 생산을 시작하세요.\n\n[계약 전 확인할 것]\n- 바이어 회사의 실제 주소, 홈페이지 개설 시기, 무역협회·코트라 조회\n- 첫 거래 결제 조건 (선수금 또는 L/C)\n- 계좌 변경 요청은 무조건 이중 확인');

  insert into public.notes (author_id, title, summary, industry, keywords, price_points, is_published, created_at)
  values (v_choi, '정부 지원사업 선정 후 정산 단계에서 돈을 토해내는 실수',
    '선정보다 무서운 게 정산입니다. 사업비를 다 쓰고도 증빙 문제로 환수 통보를 받는 창업자를 많이 봤습니다. 협약 직후부터 챙겨야 할 것들입니다.',
    '세무', '{지원금정산,세무,증빙}', 2500, true, now() - interval '10 days')
  returning id into v_note;
  insert into public.note_contents (note_id, body) values (v_note,
E'1. 협약 전 지출\n협약일 이전에 쓴 돈은 대부분 인정되지 않습니다. 급하다고 미리 결제하지 마세요.\n\n2. 비목 간 임의 전용\n재료비로 잡은 돈을 외주비로 쓰는 식의 변경은 사전 승인이 필요한 경우가 많습니다. 사업계획을 바꿔야 하면 먼저 전담기관에 변경 신청을 하세요.\n\n3. 개인 카드·현금 결제\n사업비 전용 카드나 계좌가 정해져 있다면 그 외 결제는 인정받기 어렵습니다. 대표 개인 카드로 결제하고 나중에 정리하겠다는 생각은 버리세요.\n\n4. 특수관계인 거래\n가족 회사나 지인 회사에 외주를 주면 불인정되거나 소명 요구를 받습니다.\n\n5. 증빙 누락\n세금계산서, 거래명세서, 결과물(납품 사진·보고서), 이체 확인증이 한 세트입니다. 하나라도 빠지면 정산 때 다시 받으러 다녀야 합니다. 지출할 때마다 폴더 하나에 모아 두세요.\n\n※ 세부 기준은 사업마다 다르니 반드시 해당 사업의 운영지침을 확인하세요.');

  insert into public.notes (author_id, title, summary, industry, keywords, price_points, is_published, created_at)
  values (v_ys, '첫 직원 채용, 근로계약서 하나로 노동청에 불려간 이야기',
    '"우리끼리 믿고 하자"며 계약서 없이 시작한 첫 직원이 퇴사하면서 진정을 넣었습니다. 첫 채용 전에 반드시 챙겨야 할 서류와 조항입니다.',
    '인사·노무', '{근로계약,채용,노무}', 2000, true, now() - interval '7 days')
  returning id into v_note;
  insert into public.note_contents (note_id, body) values (v_note,
E'1. 근로계약서는 작성하고 반드시 한 부를 준다\n임금, 근로시간, 휴일, 연차 등 법이 정한 내용을 적고 직원에게 교부해야 합니다. 안 주면 그 자체로 법 위반입니다.\n\n2. 수습 기간은 계약서에 적어야 효력이 있다\n말로만 "3개월 수습"이라고 하면 인정받기 어렵습니다.\n\n3. 포괄임금제는 만능이 아니다\n"야근수당 포함"이라고 적어도 실제 연장근로가 더 많으면 차액을 줘야 합니다. 출퇴근 기록은 꼭 남기세요.\n\n4. 4대보험 가입\n주 15시간 이상 일하는 직원은 원칙적으로 가입 대상입니다. 두루누리 같은 소규모 사업장 보험료 지원 제도도 확인하세요.\n\n5. 퇴사할 때 정산\n1년 이상 근무했다면 퇴직금, 남은 연차수당을 퇴사일로부터 14일 안에 지급해야 합니다.\n\n※ 개별 상황은 노무사 상담으로 한 번 더 확인하세요.');

  insert into public.notes (author_id, title, summary, industry, keywords, price_points, is_published, created_at)
  values (v_mk, '대형마트 입점 제안서, MD가 3초 만에 거르는 유형',
    '하루에도 제안서 수십 개가 들어옵니다. 25년간 입점 심사를 하면서 첫 장에서 탈락시킨 제안서들의 공통점을 알려드립니다.',
    '유통', '{입점,판로개척,유통}', 1500, true, now() - interval '4 days')
  returning id into v_note;
  insert into public.note_contents (note_id, body) values (v_note,
E'1. 첫 장에 회사 소개만 있다\nMD가 궁금한 건 회사 연혁이 아니라 "이 상품이 우리 매대에서 얼마나 팔릴까"입니다. 첫 장에 상품 사진, 가격, 경쟁 상품 대비 차별점을 넣으세요.\n\n2. 공급 가능 물량이 없다\n전국 점포에 깔리면 한 번에 필요한 물량이 큽니다. 월 공급 가능 수량과 리드타임을 숫자로 적으세요.\n\n3. 마진 구조를 모른다\n판매가에서 유통 마진, 판촉비, 물류비를 빼고도 남는지 계산이 안 된 제안서는 바로 티가 납니다.\n\n4. 판매 데이터가 없다\n온라인 판매 실적, 재구매율, 리뷰 같은 근거가 있으면 테스트 입점 가능성이 크게 올라갑니다.\n\n[팁] 처음부터 전 점포를 노리지 말고 일부 점포 테스트 입점을 제안하세요.');

  insert into public.notes (author_id, title, summary, industry, keywords, price_points, is_published, created_at)
  values (v_han, '상권분석 없이 계약한 매장이 6개월 만에 문 닫은 이유',
    '권리금과 인테리어에 1억을 쓰고 6개월 만에 폐업한 사례를 바탕으로, 매장 계약 전에 꼭 봐야 할 것들을 정리했습니다.',
    '외식', '{상권분석,외식창업,임대차}', 2000, true, now() - interval '2 days')
  returning id into v_note;
  insert into public.note_contents (note_id, body) values (v_note,
E'1. 유동인구가 아니라 "내 손님"의 동선을 봐라\n역 앞 유동인구가 많아도 출퇴근으로 지나가기만 하는 사람들이면 점심 장사가 안 됩니다. 요일·시간대별로 직접 서서 세어 보세요.\n\n2. 임대차 계약 기간과 갱신 조건\n인테리어 비용을 회수하려면 최소 몇 년이 필요한지 계산하고, 계약 기간이 그보다 짧으면 다시 생각하세요.\n\n3. 원상복구 조항\n폐업할 때 원상복구 비용이 수천만 원 나오는 경우가 있습니다. 계약 전에 범위를 명확히 하세요.\n\n4. 주변 폐업 이력\n같은 자리에 1~2년 단위로 가게가 바뀌었다면 이유가 있습니다. 주변 상인에게 물어보세요.\n\n5. 고정비 비율\n월세와 인건비가 예상 매출의 몇 %인지 먼저 계산하세요. 이 비율이 높으면 매출이 조금만 빠져도 버티기 어렵습니다.');

  -- 아직 공개 안 한 초안 (베테랑 본인 화면 데모용)
  insert into public.notes (author_id, title, summary, industry, keywords, price_points, is_published)
  values (v_choi, '부가세 신고 첫해, 가산세 피하는 법 (작성 중)', '초안입니다.', '세무', '{부가세,세무}', 2000, false)
  returning id into v_note;
  insert into public.note_contents (note_id, body) values (v_note, '작성 중');

  -- 김대표는 이 위원의 계약 노트를 이미 구매함 (시나리오 Step 2)
  insert into public.note_purchases (user_id, note_id, price_points)
  select v_kim, id, price_points from public.notes where author_id = v_lee;
  insert into public.note_purchases (user_id, note_id, price_points)
  select v_park, id, price_points from public.notes where author_id in (v_jung, v_mk);
  -- 인기순 데모: 베테랑끼리도 서로 노트를 사 본 것으로 구매 수 차이를 만든다
  -- (이 위원 계약 노트 4 > 무역 사기 3 > 입점 제안서 2 > 상권분석 1)
  insert into public.note_purchases (user_id, note_id, price_points)
  select b.buyer, n.id, n.price_points
  from public.notes n
  join (values
    (v_choi, v_lee), (v_ys, v_lee), (v_han, v_lee),
    (v_lee, v_jung), (v_han, v_jung),
    (v_ys, v_mk),
    (v_mk, v_han)
  ) as b(buyer, author) on n.author_id = b.author
  where n.is_published;

  -- 위 구매들의 포인트 이동 (구매자 차감 → 작성자 판매 수익, 010 적용 전 DB에서는 건너뜀)
  if to_regprocedure('public.set_point_reason(text,jsonb)') is not null then
    for v_buy in
      select np.user_id, np.note_id, np.price_points, n.author_id
      from public.note_purchases np join public.notes n on n.id = np.note_id
      where n.author_id in (v_lee, v_mk, v_choi, v_ys, v_jung, v_han)
    loop
      perform public.set_point_reason('note_purchase', jsonb_build_object('note_id', v_buy.note_id));
      update public.profiles set points = points - v_buy.price_points where id = v_buy.user_id;
      perform public.set_point_reason('note_sale', jsonb_build_object('note_id', v_buy.note_id));
      update public.profiles set points = points + v_buy.price_points where id = v_buy.author_id;
    end loop;
  end if;

  -- ---------- 한 줄 조언 ----------
  insert into public.tips (expert_id, content, created_at) values
  (v_lee,  '계약서는 단가 조항부터 보세요. 나머지는 그다음입니다.', now() - interval '9 days'),
  (v_lee,  '금형비를 냈다면 금형 소유권 문구가 있는지 꼭 확인하세요.', now() - interval '3 days'),
  (v_mk,   '입점 제안서 첫 장에는 회사 소개 말고 상품 사진과 가격을 넣으세요.', now() - interval '6 days'),
  (v_mk,   '전 점포보다 테스트 입점 10곳이 훨씬 잘 뚫립니다.', now() - interval '1 day'),
  (v_choi, '지원사업 사업비는 협약일 이후에 쓰세요. 그 전 지출은 대부분 인정 안 됩니다.', now() - interval '8 days'),
  (v_choi, '영수증은 쓸 때마다 사진 찍어서 폴더 하나에 모으세요.', now() - interval '2 days'),
  (v_ys,   '첫 직원이라도 근로계약서는 꼭 쓰고 한 부를 주세요.', now() - interval '5 days'),
  (v_jung, '계좌가 바뀌었다는 바이어 메일은 무조건 전화로 다시 확인하세요.', now() - interval '7 days'),
  (v_jung, '신규 바이어와 첫 거래는 선수금이나 신용장으로 하세요.', now() - interval '1 day'),
  (v_han,  '매장 계약 전에 평일 점심, 저녁, 주말에 각각 한 시간씩 서 있어 보세요.', now() - interval '4 days');

  -- ---------- 지난 상담 + 후기 (평점 데모용) ----------
  -- 기획서 시나리오 Step 3~4: 김대표 × 이 위원
  v_booking := pg_temp.past_booking(v_kim, v_lee, 5, '첫 양산 계약을 앞두고 공장 측 계약서 조항이 불리한 것 같아 검토 부탁드립니다.',
    5, '단가 조항을 고치라는 조언 덕분에 불리한 계약을 피했습니다. 30년 내공이 느껴졌어요.');
  insert into public.messages (booking_id, sender_id, content, created_at) values
  (v_booking, v_kim, '안녕하세요 위원님, 미리 보내드린 계약서 3조 단가 조항이 걱정됩니다.', pg_temp.kst(-5, 19)),
  (v_booking, v_lee, '네 봤습니다. "협의하여 조정한다"는 문구는 나중에 단가 인하 압박의 빌미가 되니 반드시 수정하세요.', pg_temp.kst(-5, 19) + interval '2 minutes'),
  (v_booking, v_kim, '어떻게 고치면 될까요?', pg_temp.kst(-5, 19) + interval '3 minutes'),
  (v_booking, v_lee, '원자재 가격 지수 기준으로 5% 이상 변동 시에만 분기별로 조정한다고 숫자로 적으세요. 그리고 금형 소유권 조항도 빠져 있네요.', pg_temp.kst(-5, 19) + interval '6 minutes'),
  (v_booking, v_kim, '금형비는 저희가 내는데 그것도 넣어야 하는군요. 바로 수정 요청하겠습니다!', pg_temp.kst(-5, 19) + interval '8 minutes'),
  (v_booking, v_lee, '네, 그리고 MOQ는 첫 계약이니 연간 말고 분기 단위로 잡으세요. 수정본 오면 한 번 더 봐 드릴게요.', pg_temp.kst(-5, 19) + interval '10 minutes');
  insert into public.reports (booking_id, summary, checklist, risks, created_at) values (v_booking,
    '공장 측 표준계약서의 단가 조정 조항이 모호해 향후 단가 인하 압박의 근거가 될 수 있음. 조정 기준을 수치화하고 금형 소유권, MOQ 기간을 수정해야 함.',
    '["3조 단가 조정 조항을 원자재 지수 5% 이상 변동 시 분기별 조정으로 수정 요청", "금형 소유권은 발주자에게 있다는 조항 추가", "MOQ를 연간에서 분기 단위로 변경", "수정본 수령 후 이 위원에게 재검토 요청"]',
    '["단가 조항을 그대로 두면 2년 차부터 일방적 단가 인하 요구 가능", "금형 소유권 미기재 시 거래 중단 때 금형 회수 불가", "연간 MOQ는 판매 부진 시 재고 부담으로 이어짐"]',
    pg_temp.kst(-5, 20) + interval '5 minutes');

  perform pg_temp.past_booking(v_park, v_lee, 12, '협력사 품질 문제로 계약 해지를 고민 중입니다.', 5, '감정 말고 계약서 근거로 대응하는 법을 배웠습니다.');
  perform pg_temp.past_booking(v_park, v_mk, 9, '편의점 입점 제안서 피드백 부탁드립니다.', 5, '제안서 첫 장을 바꾸고 테스트 입점 미팅이 잡혔어요!');
  perform pg_temp.past_booking(v_kim, v_mk, 20, '온라인에서 잘 팔리는 제품을 오프라인으로 넓히고 싶어요.', 4, '현실적인 마진 계산을 알려주셨어요. 조금 냉정하지만 도움이 됐습니다.');
  perform pg_temp.past_booking(v_park, v_choi, 15, '창업 첫해 부가세 신고가 처음이라 막막합니다.', 5, '헷갈리던 매입세액 공제를 한 번에 정리해 주셨어요.');
  perform pg_temp.past_booking(v_kim, v_ys, 8, '첫 직원 채용 전에 준비할 서류가 궁금합니다.', 5, '근로계약서 양식까지 꼼꼼히 봐주셨어요.');
  perform pg_temp.past_booking(v_park, v_jung, 18, '동남아 바이어가 샘플비를 먼저 보내라고 합니다.', 5, '사기일 뻔했습니다. 정말 감사합니다.');
  perform pg_temp.past_booking(v_kim, v_jung, 6, '첫 수출 계약 결제 조건을 어떻게 잡아야 할까요?', 4, '신용장 거래 방법을 자세히 알려주셨습니다.');
  perform pg_temp.past_booking(v_park, v_han, 10, '카페 자리 두 곳 중 어디가 나을까요?', 4, '직접 가서 세어보라는 조언 덕분에 결정했어요.');

  -- ---------- 진행 중인 예약 (채팅 데모용) ----------
  -- 김대표 × 최동수: seed를 실행한 시점부터 3시간 동안 "상담 중" (채팅은 상담 시간에만 보낼 수 있어서)
  -- → 발표 직전에 seed.sql을 다시 실행하면 바로 실시간 채팅을 시연할 수 있다.
  insert into public.availability_slots (expert_id, start_at, end_at, is_booked)
  values (v_choi, date_trunc('minute', now()) - interval '5 minutes', date_trunc('minute', now()) + interval '3 hours', true)
  returning id into v_slot;
  insert into public.bookings (slot_id, youth_id, expert_id, topic, price_points)
  values (v_slot, v_kim, v_choi, '청년창업 지원사업에 선정됐는데 사업비 정산을 어떻게 준비해야 할지 모르겠어요.', 3000)
  returning id into v_booking;
  insert into public.messages (booking_id, sender_id, content, created_at) values
  (v_booking, v_kim,  '안녕하세요 세무사님, 상담 전에 협약서를 먼저 보내드려도 될까요?', now() - interval '1 hour'),
  (v_booking, v_choi, '네 좋습니다. 사업비 비목표도 같이 보내주시면 미리 보고 들어가겠습니다.', now() - interval '40 minutes');

  -- ---------- 관리자 지정 ----------
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_admin') then
    execute 'update public.profiles set is_admin = true, role_confirmed = true where id = $1' using v_admin;
  end if;
end;
$seed$;
