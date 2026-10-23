// 상담 예약, AI 보고서, 후기
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase.js';
import { unwrap } from './_utils.js';
import { getCurrentUser } from './auth.js';

// 예약과 함께 상담 시간, 청년 이름, 베테랑 이름·소개를 가져온다.
// 결과: booking.slot = { start_at, end_at }, booking.youth = { name }, booking.expert = { headline, profiles: { name } }
const BOOKING_WITH_DETAILS =
  '*, slot:availability_slots(start_at, end_at), youth:profiles(name), expert:experts(headline, profiles(name))';

/**
 * 상담 예약 (포인트 차감 후 보관). 실패하면 '이미 예약된 시간입니다.' 같은 메시지로 throw
 * @returns {Promise<number>} 예약 id
 */
export async function createBooking(slotId, topic) {
  return unwrap(await supabase.rpc('create_booking', { p_slot_id: slotId, p_topic: topic }));
}

/** 내 예약 목록 (청년이면 내가 한 예약, 베테랑이면 나에게 들어온 예약). 최신순 */
export async function getMyBookings() {
  const user = await getCurrentUser();
  if (!user) return [];
  return unwrap(await supabase
    .from('bookings')
    .select(BOOKING_WITH_DETAILS)
    .or(`youth_id.eq.${user.id},expert_id.eq.${user.id}`)
    .order('created_at', { ascending: false }));
}

/** 예약 하나 (당사자만 조회 가능, 아니면 null) */
export async function getBooking(bookingId) {
  return unwrap(await supabase.from('bookings').select(BOOKING_WITH_DETAILS).eq('id', bookingId).maybeSingle());
}

/** 상담 완료 처리 (청년만). 보관 중이던 포인트가 베테랑에게 지급된다. */
export async function completeBooking(bookingId) {
  unwrap(await supabase.rpc('complete_booking', { p_booking_id: bookingId }));
}

/** 예약 취소 (상담 시작 전, 당사자만). 청년에게 포인트 환불 */
export async function cancelBooking(bookingId) {
  unwrap(await supabase.rpc('cancel_booking', { p_booking_id: bookingId }));
}

/** 한 예약당 일정 변경 가능 횟수 */
export const MAX_RESCHEDULE = 2;

/**
 * 예약 일정 변경 (청년만, 상담 시작 전, 한 예약당 2번까지)
 * 같은 베테랑의 빈 시간으로 옮긴다. 포인트·채팅방은 그대로, 원래 시간은 다시 예약 가능해진다.
 * 실패하면 '이미 예약된 시간이에요. 다른 시간을 골라 주세요.' 같은 메시지로 throw
 * @param {number} bookingId
 * @param {number} newSlotId  getSlots(booking.expert_id)에서 고른 시간 id
 */
export async function rescheduleBooking(bookingId, newSlotId) {
  unwrap(await supabase.rpc('reschedule_booking', { p_booking_id: bookingId, p_new_slot_id: newSlotId }));
}

/**
 * AI 전략 보고서 만들기 (Gemini). 완료된 상담의 청년·베테랑만 가능, 상담당 하나.
 * 이미 있으면 새로 만들지 않고 그대로 돌려준다. 보통 몇 초 걸린다.
 * @returns {Promise<{ booking_id, summary, checklist: string[], risks: string[], created_at }>}
 *   실패하면 '상담을 완료한 뒤에 보고서를 만들 수 있어요.' 같은 메시지로 throw
 */
export async function generateReport(bookingId) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('로그인이 필요합니다.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ booking_id: bookingId }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || '보고서를 만들지 못했어요.');
  return body.report;
}

/** AI 전략 보고서 { summary, checklist[], risks[] } (아직 없으면 null) */
export async function getReport(bookingId) {
  return unwrap(await supabase.from('reports').select('*').eq('booking_id', bookingId).maybeSingle());
}


// ---------- 후기 ----------

/** 베테랑의 후기 목록 (최신순). review.youth = { name } */
export async function getReviews(expertId) {
  return unwrap(await supabase
    .from('reviews')
    .select('id, booking_id, rating, content, created_at, youth:profiles(name)')
    .eq('expert_id', expertId)
    .order('created_at', { ascending: false }));
}

/** 이 상담에 내가 쓴 후기 (안 썼으면 null) — 후기 쓰기 버튼을 보여줄지 정할 때 */
export async function getMyReview(bookingId) {
  return unwrap(await supabase
    .from('reviews')
    .select('id, rating, content, created_at')
    .eq('booking_id', bookingId)
    .maybeSingle());
}

/**
 * 전체 최근 후기 (모든 베테랑, 최신순) — "후기 보기" 화면용
 * @returns {Promise<Array<{ id, rating, content, created_at, expert_id, youth: { name }, expert: { headline, industry, profiles: { name } } }>>}
 */
export async function getRecentReviews({ limit = 20 } = {}) {
  return unwrap(await supabase
    .from('reviews')
    .select('id, rating, content, created_at, expert_id, youth:profiles(name), expert:experts(headline, industry, profiles(name))')
    .order('created_at', { ascending: false })
    .limit(limit));
}

/** 후기 작성 (완료된 상담의 청년만, 상담 1건당 1개) */
export async function addReview(bookingId, rating, content) {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  const booking = await getBooking(bookingId);
  if (!booking) throw new Error('존재하지 않는 예약입니다.');
  return unwrap(await supabase
    .from('reviews')
    .insert({ booking_id: bookingId, youth_id: user.id, expert_id: booking.expert_id, rating, content })
    .select()
    .single());
}
