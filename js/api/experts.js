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
  const deleted = unwrap(await supabase.from('availability_slots').delete().eq('id', slotId).select());
  if (deleted.length === 0) throw new Error('이미 예약된 시간은 삭제할 수 없습니다.');
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
