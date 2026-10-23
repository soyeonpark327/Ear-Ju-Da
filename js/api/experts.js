// 베테랑 목록·상세, 상담 가능 시간, 한 줄 조언
import { supabase } from '../supabase.js';
import { unwrap, splitKeywords } from './_utils.js';
import { getCurrentUser } from './auth.js';

// ---------- 청년이 보는 화면 ----------

/**
 * 승인된 베테랑 목록 (평점 높은 순)
 * @param {{ keyword?: string, industry?: string }} [filter]
 *   keyword: 이름·소개·업종·경력·키워드 중 어디에든 포함된 단어 (예: '계약', '이정훈', '#제조공정 #납품계약')
 *            띄어쓰기로 여러 단어를 넣으면 모두 포함된 베테랑만 찾는다.
 * @returns {Promise<Array<{ id, name, avatar_url, headline, industry, career_years, keywords, price_points, rating, review_count }>>}
 */
export async function getExperts({ keyword, industry } = {}) {
  let query = supabase.from('expert_cards').select('*');
  for (const word of splitKeywords(keyword)) query = query.ilike('search_text', `%${word}%`);
  if (industry) query = query.eq('industry', industry);
  return unwrap(await query.order('rating', { ascending: false }).order('review_count', { ascending: false }));
}

/** 베테랑 상세: 목록 카드 정보 + 상세 경력(career_summary). 없거나 미승인이면 null */
export async function getExpert(id) {
  const card = unwrap(await supabase.from('expert_cards').select('*').eq('id', id).maybeSingle());
  if (!card) return null;
  const detail = unwrap(await supabase.from('experts').select('career_summary').eq('id', id).single());
  return { ...card, career_summary: detail.career_summary };
}

/** 예약 가능한 시간 (앞으로 남은 것만, 빠른 순) */
export async function getSlots(expertId) {
  return unwrap(await supabase
    .from('availability_slots')
    .select('id, start_at, end_at')
    .eq('expert_id', expertId)
    .eq('is_booked', false)
    .gt('start_at', new Date().toISOString())
    .order('start_at'));
}

/** 한 줄 조언 (최신순) */
export async function getTips(expertId) {
  return unwrap(await supabase
    .from('tips')
    .select('id, content, created_at')
    .eq('expert_id', expertId)
    .order('created_at', { ascending: false }));
}


// ---------- 베테랑 본인이 쓰는 화면 ----------

/** 내 전문가 정보 (아직 작성 안 했으면 null). verification으로 승인 상태 확인 */
export async function getMyExpert() {
  const user = await getCurrentUser();
  if (!user) return null;
  return unwrap(await supabase.from('experts').select('*').eq('id', user.id).maybeSingle());
}

/**
 * 전문가 정보 처음 작성 (베테랑 회원만). 작성 후 관리자 승인 전까지는 목록에 안 보인다.
 * @param {{ headline: string, industry: string, career_years: number, career_summary?: string, keywords?: string[], price_points?: number }} info
 */
export async function registerExpert(info) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  return unwrap(await supabase.from('experts').insert({ ...info, id: user.id }).select().single());
}

/** 내 전문가 정보 수정. 바꿀 값만 넘긴다. */
export async function updateMyExpert(changes) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  return unwrap(await supabase.from('experts').update(changes).eq('id', user.id).select().single());
}

/**
 * 베테랑 대시보드 (본인). 한 번에 활동 요약을 돌려준다.
 * @returns {Promise<{ registered: false } | {
 *   registered: true,
 *   profile: { name, headline, verification, has_certificate, trust_grade, trust_label, badges, rating, review_count, no_show_count },
 *   bookings: { today, this_week, upcoming, completed, no_show },
 *   next_booking: { id, start_at, end_at, topic, youth_name } | null,
 *   points: { balance, pending, earned_total, earned_this_month },
 *   notes: { published, drafts, sold_count, sales_total },
 *   recent_reviews: Array<{ rating, content, created_at, youth_name }>
 * }>}
 *   registered가 false면 전문가 정보 등록 화면으로 안내. 승인 전이면 trust_grade 등은 null
 *   points.pending: 진행 중 예약에 보관된 금액(상담 끝나면 지급 예정)
 */
export async function getMyDashboard() {
  return unwrap(await supabase.rpc('get_my_expert_dashboard'));
}

// ---------- 경력 증명서 (비공개 Storage 버킷 certificates) ----------
const CERT_BUCKET = 'certificates';
const CERT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const CERT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 경력 증명서 업로드 (베테랑만). <input type="file">에서 고른 File을 넘긴다.
 * 전문가 정보가 이미 있으면 certificate_path를 바로 연결하고, 반려 상태였다면 승인 대기로 돌아간다.
 * 전문가 정보가 아직 없으면 돌려받은 path를 registerExpert({ ..., certificate_path: path })에 넣는다.
 * @param {File} file PDF·JPG·PNG·WEBP·HEIC, 10MB 이하
 * @returns {Promise<string>} 저장된 경로 (예: '<내 id>/1730000000000.pdf')
 */
export async function uploadCertificate(file) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  if (!file) throw new Error('파일을 선택해주세요.');
  if (!CERT_TYPES.includes(file.type)) throw new Error('PDF 또는 사진(JPG·PNG·WEBP·HEIC) 파일만 올릴 수 있어요.');
  if (file.size > CERT_MAX_BYTES) throw new Error('10MB 이하 파일만 올릴 수 있어요.');

  // 파일 이름은 한글·공백 문제를 피하려고 시간+확장자로 만든다
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(CERT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    if (/row-level security|Unauthorized|403/i.test(error.message)) throw new Error('베테랑 회원만 증명서를 올릴 수 있어요.');
    if (/mime|type/i.test(error.message)) throw new Error('PDF 또는 사진 파일만 올릴 수 있어요.');
    if (/size|large/i.test(error.message)) throw new Error('10MB 이하 파일만 올릴 수 있어요.');
    throw new Error(error.message);
  }

  // 전문가 정보가 있으면 바로 연결 (없으면 registerExpert 때 넣기)
  const mine = await getMyExpert();
  if (mine) {
    const old = mine.certificate_path;
    unwrap(await supabase.from('experts').update({ certificate_path: path }).eq('id', user.id));
    if (old && old !== path) await supabase.storage.from(CERT_BUCKET).remove([old]); // 이전 파일 정리
  }
  return path;
}

/**
 * 내가 올린 증명서를 잠깐 볼 수 있는 링크 (1분 유효). 없으면 null
 * @returns {Promise<string | null>}
 */
export async function getMyCertificateUrl() {
  const mine = await getMyExpert();
  if (!mine?.certificate_path) return null;
  const { data, error } = await supabase.storage.from(CERT_BUCKET).createSignedUrl(mine.certificate_path, 60);
  if (error) throw new Error('증명서를 불러오지 못했어요.');
  return data.signedUrl;
}

/** 내가 열어둔 시간 전체 (예약된 것 포함) */
export async function getMySlots() {
  const user = await getCurrentUser();
  if (!user) return [];
  return unwrap(await supabase
    .from('availability_slots')
    .select('*')
    .eq('expert_id', user.id)
    .order('start_at'));
}

/**
 * 상담 가능 시간 추가
 * @param {Date | string} startAt
 * @param {Date | string} endAt
 */
export async function addSlot(startAt, endAt) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  return unwrap(await supabase
    .from('availability_slots')
    .insert({ expert_id: user.id, start_at: new Date(startAt).toISOString(), end_at: new Date(endAt).toISOString() })
    .select()
    .single());
}

/** 상담 가능 시간 삭제 (예약된 시간은 삭제 안 됨) */
export async function deleteSlot(slotId) {
  const count = await deleteSlots([slotId]);
  if (count === 0) throw new Error('이미 예약된 시간은 삭제할 수 없습니다.');
}

/**
 * 여러 시간 한 번에 삭제 (예약된 시간은 건너뜀). 지운 개수를 돌려준다.
 * 취소된 예약 기록이 있는 시간은 지우지 않고 닫아서 목록·캘린더에서만 사라진다.
 * @param {number[]} slotIds
 */
export async function deleteSlots(slotIds) {
  return unwrap(await supabase.rpc('delete_my_slots', { p_ids: slotIds }));
}

/** 요일 번호 (JS getDay()와 같음) → 이름 */
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 매주 반복 일정 한 번에 만들기 (한국 시간 기준)
 * 이미 연 시간과 겹치거나 지난 시간은 건너뛴다. 한 번에 최대 300개.
 * @param {{ weekdays: number[], start: string, end: string, minutes?: number, weeks?: number, from?: string }} opts
 *   weekdays: 0=일 ~ 6=토, start·end: '14:00', minutes: 한 번 상담 길이(30~180, 기본 60),
 *   weeks: 반복 주 수(1~12, 기본 4), from: 시작 날짜 '2026-11-02' (기본 오늘)
 * @returns {Promise<{ created: number, skipped_overlap: number, skipped_past: number }>}
 * @example addWeeklySlots({ weekdays: [2, 4], start: '14:00', end: '18:00' })  // 매주 화·목 14~18시, 1시간씩, 4주
 */
export async function addWeeklySlots({ weekdays, start, end, minutes = 60, weeks = 4, from = null }) {
  return unwrap(await supabase.rpc('add_weekly_slots', {
    p_weekdays: weekdays, p_start: start, p_end: end, p_minutes: minutes, p_weeks: weeks, p_from: from,
  }));
}

/**
 * 베테랑 본인 일정 (기간은 최대 62일)
 * state: 'open'(예약 가능) | 'confirmed'(예약됨) | 'completed'(완료) | 'no_show'(노쇼)
 * @param {Date | string} from
 * @param {Date | string} to
 * @returns {Promise<Array<{ slot_id, start_at, end_at, state, booking_id, youth_name, topic }>>}
 * @example getMyCalendar(new Date(2026, 10, 1), new Date(2026, 11, 1))  // 2026년 11월
 */
export async function getMyCalendar(from, to) {
  const start = new Date(from), end = new Date(to);
  if (end - start > 62 * 864e5) throw new Error('일정은 62일까지 한 번에 볼 수 있어요.');
  return unwrap(await supabase.rpc('get_my_calendar', { p_from: start.toISOString(), p_to: end.toISOString() }));
}

/** 일정을 한국 날짜별로 묶기: { '2026-11-03': [slot, ...] } (캘린더 칸에 넣을 때) */
export function groupByDay(slots) {
  const key = (v) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(v));
  return slots.reduce((days, slot) => {
    (days[key(slot.start_at)] ??= []).push(slot);
    return days;
  }, {});
}

/** 한 줄 조언 작성 (승인된 베테랑만, 200자 이내) */
export async function addTip(content) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  return unwrap(await supabase.from('tips').insert({ expert_id: user.id, content }).select().single());
}

export async function deleteTip(tipId) {
  unwrap(await supabase.from('tips').delete().eq('id', tipId));
}
