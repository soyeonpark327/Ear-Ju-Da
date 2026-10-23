// 신고 · 차단 · 찜 (016)
import { supabase } from '../supabase.js';
import { unwrap } from './_utils.js';
import { getCurrentUser } from './auth.js';

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error('로그인이 필요합니다.');
  return user.id;
}

/**
 * 신고 (관리자가 확인). 같은 대상은 처리 전까지 한 번만
 * @param {'user' | 'note' | 'booking'} targetType
 * @param {string | number} targetId 회원 id / 노트 id / 예약 id
 * @param {string} reason 2~500자
 */
export async function report(targetType, targetId, reason) {
  const { error } = await supabase.from('user_reports')
    .insert({ reporter_id: await me(), target_type: targetType, target_id: String(targetId), reason: reason.trim() });
  if (error?.code === '23505') throw new Error('이미 신고했어요. 관리자가 확인하고 있어요.');
  if (error?.code === '23514') throw new Error('신고 사유를 2자 이상 적어 주세요.');
  unwrap({ error });
}

/** 차단: 그 사람과 채팅 메시지를 주고받을 수 없어요 */
export async function blockUser(userId) {
  const { error } = await supabase.from('blocks').insert({ blocker_id: await me(), blocked_id: userId });
  if (error && error.code !== '23505') unwrap({ error });
}
export async function unblockUser(userId) {
  unwrap(await supabase.from('blocks').delete().eq('blocker_id', await me()).eq('blocked_id', userId));
}
/** 내가 차단한 사람 [{ blocked_id, created_at, user: { name } }] */
export async function getMyBlocks() {
  return unwrap(await supabase.from('blocks').select('blocked_id, created_at, user:profiles!blocks_blocked_id_fkey(name)')
    .order('created_at', { ascending: false }));
}
export async function isBlocked(userId) {
  return (await supabase.from('blocks').select('blocked_id').eq('blocked_id', userId).maybeSingle()).data != null;
}

/**
 * 찜 켜기/끄기. 바뀐 상태(true = 찜함)를 돌려줌
 * @param {'expert' | 'note'} targetType
 */
export async function toggleFavorite(targetType, targetId) {
  const user = await me();
  const key = { user_id: user, target_type: targetType, target_id: String(targetId) };
  const { data } = await supabase.from('favorites').select('target_id').match(key).maybeSingle();
  if (data) { unwrap(await supabase.from('favorites').delete().match(key)); return false; }
  unwrap(await supabase.from('favorites').insert(key));
  return true;
}
export async function isFavorite(targetType, targetId) {
  const user = await getCurrentUser();
  if (!user) return false;
  return (await supabase.from('favorites').select('target_id')
    .match({ user_id: user.id, target_type: targetType, target_id: String(targetId) }).maybeSingle()).data != null;
}
/** 찜 목록: { experts: [카드 정보], notes: [노트 정보] } (최근 찜한 순) */
export async function getMyFavorites() {
  const rows = unwrap(await supabase.from('favorites').select('target_type, target_id, created_at').order('created_at', { ascending: false }));
  const ids = (t) => rows.filter((r) => r.target_type === t).map((r) => r.target_id);
  const order = (list, t) => ids(t).map((id) => list.find((x) => String(x.id) === id)).filter(Boolean);
  const [experts, notes] = await Promise.all([
    ids('expert').length ? unwrap(await supabase.from('expert_cards').select('id, name, headline, industry, trust_label, price_points').in('id', ids('expert'))) : [],
    ids('note').length ? unwrap(await supabase.from('notes').select('id, title, summary, price_points').in('id', ids('note').map(Number))) : [],
  ]);
  return { experts: order(experts, 'expert'), notes: order(notes, 'note') };
}
